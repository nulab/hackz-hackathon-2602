import { parseDownstreamMessage, serializeMessage } from "@hackz/shared";
import type { DownstreamMessage, UpstreamMessage } from "@hackz/shared";

export type AdminConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

type MessageHandler = (msg: DownstreamMessage) => void;
type StateHandler = (state: AdminConnectionState) => void;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 10000];

export class AdminConnection {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private state: AdminConnectionState = "disconnected";
  private messageHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private roomId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  private setState(next: AdminConnectionState) {
    this.state = next;
    for (const h of this.stateHandlers) {
      h(next);
    }
  }

  getState(): AdminConnectionState {
    return this.state;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  /** シグナリングで offer を受け取った後に呼ぶ */
  async handleOffer(offerPayload: string): Promise<string> {
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.setState("connecting");

    this.pc.oniceconnectionstatechange = () => {
      if (
        this.pc?.iceConnectionState === "disconnected" ||
        this.pc?.iceConnectionState === "failed"
      ) {
        if (!this.intentionalDisconnect) {
          this.attemptReconnect();
        }
      }
    };

    this.pc.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel(this.dataChannel);
    };

    const offer = JSON.parse(offerPayload) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return JSON.stringify(answer);
  }

  /** ICE candidate を受け取る */
  async handleIceCandidate(candidatePayload: string) {
    if (!this.pc) {
      return;
    }
    const candidate = JSON.parse(candidatePayload) as RTCIceCandidateInit;
    await this.pc.addIceCandidate(candidate);
  }

  /** ICE candidate 生成時のコールバックを設定 */
  onIceCandidate(handler: (candidate: string) => void) {
    if (!this.pc) {
      return;
    }
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        handler(JSON.stringify(e.candidate));
      }
    };
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  send(msg: UpstreamMessage) {
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(serializeMessage(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.cancelReconnect();
    this.cleanup();
  }

  /** 再接続が必要かどうか（外部から再接続フローを呼ぶため） */
  shouldReconnect(): boolean {
    return !this.intentionalDisconnect && this.reconnectAttempt < MAX_RECONNECT_ATTEMPTS;
  }

  resetReconnect() {
    this.reconnectAttempt = 0;
    this.intentionalDisconnect = false;
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      this.setState("connected");
      this.reconnectAttempt = 0;
    };
    dc.onclose = () => {
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      } else {
        this.setState("disconnected");
      }
    };
    dc.onmessage = (e) => {
      try {
        const msg = parseDownstreamMessage(e.data as string);
        if (msg.type === "PING") {
          this.send({ type: "PONG" });
          return;
        }
        if (msg.type === "DISCONNECT") {
          this.intentionalDisconnect = true;
          this.cleanup();
          for (const h of this.messageHandlers) {
            h(msg);
          }
          return;
        }
        for (const h of this.messageHandlers) {
          h(msg);
        }
      } catch {
        // invalid message, ignore
      }
    };
  }

  private attemptReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.setState("disconnected");
      return;
    }
    this.setState("reconnecting");
    const delay = RECONNECT_DELAYS[this.reconnectAttempt] ?? 10000;
    this.reconnectAttempt++;
    this.cleanup();
    this.reconnectTimer = setTimeout(() => {
      // hook 側で再接続フローを実行する
      for (const h of this.stateHandlers) {
        h("reconnecting");
      }
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanup() {
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
  }
}
