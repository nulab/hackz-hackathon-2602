import { parseUpstreamMessage, serializeMessage } from "@hackz/shared";
import type { UpstreamMessage, DownstreamMessage } from "@hackz/shared";

export type ProjectorConnectionState = "waiting" | "connecting" | "connected" | "disconnected";

type MessageHandler = (msg: UpstreamMessage) => void;
type StateHandler = (state: ProjectorConnectionState) => void;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

const HEARTBEAT_INTERVAL = 5_000;
const HEARTBEAT_TIMEOUT = 15_000;

export class ProjectorConnection {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private state: ProjectorConnectionState = "disconnected";
  private messageHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;

  private setState(next: ProjectorConnectionState) {
    this.state = next;
    for (const h of this.stateHandlers) {
      h(next);
    }
  }

  getState(): ProjectorConnectionState {
    return this.state;
  }

  /** シグナリングで Admin 参加通知を受けた後に呼ぶ */
  async createOffer(): Promise<string> {
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.setState("connecting");

    this.pc.oniceconnectionstatechange = () => {
      if (
        this.pc?.iceConnectionState === "disconnected" ||
        this.pc?.iceConnectionState === "failed"
      ) {
        this.setState("disconnected");
        this.stopHeartbeat();
      }
    };

    this.dataChannel = this.pc.createDataChannel("admin", { ordered: true });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return JSON.stringify(offer);
  }

  /** Admin の answer SDP を受け取る */
  async handleAnswer(answerPayload: string) {
    if (!this.pc) {
      return;
    }
    const answer = JSON.parse(answerPayload) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answer);
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

  send(msg: DownstreamMessage) {
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

  disconnectAdmin() {
    this.send({ type: "DISCONNECT", reason: "Disconnected by projector" });
    setTimeout(() => this.cleanup(), 100);
  }

  close() {
    this.cleanup();
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      this.setState("connected");
      this.startHeartbeat();
    };
    dc.onclose = () => {
      this.setState("disconnected");
      this.stopHeartbeat();
    };
    dc.onmessage = (e) => {
      try {
        const msg = parseUpstreamMessage(e.data as string);
        if (msg.type === "PONG") {
          this.lastPongAt = Date.now();
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

  private startHeartbeat() {
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "PING" });
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT) {
        this.setState("disconnected");
        this.cleanup();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
    this.setState("disconnected");
  }
}
