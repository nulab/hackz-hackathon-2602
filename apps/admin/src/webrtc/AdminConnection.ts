import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { parseDownstreamMessage, serializeMessage } from "@hackz/shared";
import type { DownstreamMessage, UpstreamMessage, PeerServerConfig } from "@hackz/shared";

export type AdminConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

type MessageHandler = (msg: DownstreamMessage) => void;
type StateHandler = (state: AdminConnectionState) => void;

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 10000];

export class AdminConnection {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private state: AdminConnectionState = "disconnected";
  private messageHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private targetPeerId: string | null = null;
  private peerConfig: PeerServerConfig | null = null;
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

  /** Projector の peerId に接続する */
  connect(projectorPeerId: string, config: PeerServerConfig) {
    this.targetPeerId = projectorPeerId;
    this.peerConfig = config;
    this.intentionalDisconnect = false;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  send(msg: UpstreamMessage) {
    if (this.conn?.open) {
      this.conn.send(serializeMessage(msg));
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
    this.setState("disconnected");
  }

  private doConnect() {
    this.cleanup();
    this.setState("connecting");

    if (!this.peerConfig) {
      return;
    }
    const peer = new Peer(this.peerConfig);
    this.peer = peer;

    peer.on("open", () => {
      if (!this.targetPeerId) {
        return;
      }
      const conn = peer.connect(this.targetPeerId, { reliable: true });
      this.conn = conn;
      this.setupConnection(conn);
    });

    peer.on("error", (err) => {
      if (err.type === "peer-unavailable" || err.type === "network") {
        if (!this.intentionalDisconnect) {
          this.attemptReconnect();
        }
      }
    });

    peer.on("disconnected", () => {
      if (!this.intentionalDisconnect && this.state !== "reconnecting") {
        peer.reconnect();
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on("open", () => {
      this.setState("connected");
      this.reconnectAttempt = 0;
    });

    conn.on("close", () => {
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      } else {
        this.setState("disconnected");
      }
    });

    conn.on("error", () => {
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      }
    });

    conn.on("data", (raw) => {
      try {
        const msg = parseDownstreamMessage(raw as string);
        if (msg.type === "PING") {
          this.send({ type: "PONG" });
          return;
        }
        if (msg.type === "DISCONNECT") {
          this.intentionalDisconnect = true;
          this.cleanup();
          this.setState("disconnected");
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
    });
  }

  private attemptReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.setState("disconnected");
      return;
    }
    this.setState("reconnecting");
    const delay = RECONNECT_DELAYS[this.reconnectAttempt] ?? 10000;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanup() {
    this.cancelReconnect();
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
  }
}
