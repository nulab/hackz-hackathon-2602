import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { parseUpstreamMessage, serializeMessage } from "@hackz/shared";
import type { UpstreamMessage, DownstreamMessage, PeerServerConfig } from "@hackz/shared";

export type ProjectorConnectionState = "waiting" | "connecting" | "connected" | "disconnected";

type MessageHandler = (msg: UpstreamMessage) => void;
type StateHandler = (state: ProjectorConnectionState) => void;

const HEARTBEAT_INTERVAL = 5_000;
const HEARTBEAT_TIMEOUT = 15_000;

export class ProjectorConnection {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
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

  /** PeerJS サーバーに接続し、peerId を返す */
  open(config: PeerServerConfig): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const peer = new Peer(crypto.randomUUID(), config);
      this.peer = peer;
      this.setState("waiting");

      peer.on("open", (id) => {
        resolve(id);
      });

      peer.on("connection", (conn) => {
        this.conn = conn;
        this.setState("connecting");
        this.setupConnection(conn);
      });

      peer.on("error", (err) => {
        if (this.state === "waiting" && !this.conn) {
          reject(err);
        }
      });

      peer.on("disconnected", () => {
        if (this.state !== "disconnected") {
          peer.reconnect();
        }
      });
    });
  }

  send(msg: DownstreamMessage) {
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

  /** Admin だけ切断し、Peer は維持（同じ QR で再接続可能） */
  disconnectAdmin() {
    this.send({ type: "DISCONNECT", reason: "Disconnected by projector" });
    setTimeout(() => {
      this.stopHeartbeat();
      this.conn?.close();
      this.conn = null;
      this.setState("waiting");
    }, 100);
  }

  /** Peer ごと完全に閉じる */
  close() {
    this.stopHeartbeat();
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
    this.setState("disconnected");
  }

  private setupConnection(conn: DataConnection) {
    conn.on("open", () => {
      this.setState("connected");
      this.startHeartbeat();
    });

    conn.on("close", () => {
      this.stopHeartbeat();
      this.conn = null;
      this.setState("waiting");
    });

    conn.on("error", () => {
      this.stopHeartbeat();
      this.conn = null;
      this.setState("waiting");
    });

    conn.on("data", (raw) => {
      try {
        const msg = parseUpstreamMessage(raw as string);
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
    });
  }

  private startHeartbeat() {
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "PING" });
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT) {
        this.stopHeartbeat();
        this.conn?.close();
        this.conn = null;
        this.setState("waiting");
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
