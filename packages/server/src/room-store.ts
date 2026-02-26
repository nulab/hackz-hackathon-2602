const MAX_MESSAGES_PER_CHANNEL = 100;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_TIMEOUT_MS = 15_000;

type MessageInput = { type: string; payload: unknown };

type Message = {
  id: number;
  type: string;
  payload: unknown;
  createdAt: number;
};

type Room = {
  id: string;
  createdAt: number;
  lastActivity: number;
  adminLastSeen: number;
  projectorLastSeen: number;
  channels: Map<string, Message[]>;
  nextMessageId: number;
};

export class RoomStore {
  private rooms = new Map<string, Room>();

  createRoom(): string {
    const id = crypto.randomUUID();
    this.rooms.set(id, {
      id,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      adminLastSeen: 0,
      projectorLastSeen: 0,
      channels: new Map(),
      nextMessageId: 1,
    });
    return id;
  }

  joinRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  send(roomId: string, channel: string, message: MessageInput): number {
    const room = this.rooms.get(roomId);
    if (!room) {
      return 0;
    }

    room.lastActivity = Date.now();
    const id = room.nextMessageId++;
    const msg: Message = {
      id,
      type: message.type,
      payload: message.payload,
      createdAt: Date.now(),
    };

    let ch = room.channels.get(channel);
    if (!ch) {
      ch = [];
      room.channels.set(channel, ch);
    }
    ch.push(msg);

    if (ch.length > MAX_MESSAGES_PER_CHANNEL) {
      ch.splice(0, ch.length - MAX_MESSAGES_PER_CHANNEL);
    }

    return id;
  }

  poll(roomId: string, channel: string, afterId?: number): { messages: Message[]; lastId: number } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { messages: [], lastId: 0 };
    }

    room.lastActivity = Date.now();
    const ch = room.channels.get(channel) ?? [];
    const cursor = afterId ?? 0;
    const messages = ch.filter((m) => m.id > cursor);
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : cursor;
    return { messages, lastId };
  }

  broadcast(channel: string, message: MessageInput): void {
    for (const room of this.rooms.values()) {
      this.send(room.id, channel, message);
    }
  }

  sendToSession(sessionId: string, message: MessageInput): void {
    this.broadcast(`session:${sessionId}`, message);
  }

  heartbeat(
    roomId: string,
    role: "admin" | "projector",
  ): { peerConnected: boolean; peerLastSeen: number } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { peerConnected: false, peerLastSeen: 0 };
    }

    const now = Date.now();
    room.lastActivity = now;

    if (role === "admin") {
      room.adminLastSeen = now;
      const peerLastSeen = room.projectorLastSeen;
      return { peerConnected: now - peerLastSeen < HEARTBEAT_TIMEOUT_MS, peerLastSeen };
    }
    room.projectorLastSeen = now;
    const peerLastSeen = room.adminLastSeen;
    return { peerConnected: now - peerLastSeen < HEARTBEAT_TIMEOUT_MS, peerLastSeen };
  }

  disconnect(roomId: string, role: "admin" | "projector"): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    if (role === "projector") {
      room.projectorLastSeen = 0;
      // Only delete room if projector disconnects and no admin has been seen recently
      if (room.adminLastSeen === 0) {
        this.rooms.delete(roomId);
      }
    }
    // Admin disconnect is a no-op: other admin devices may still be connected.
    // Staleness is detected via heartbeat timeout; room is cleaned up by TTL.
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        this.rooms.delete(id);
      }
    }
  }

  /** For testing: get room directly */
  _getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
}

export const roomStore = new RoomStore();
