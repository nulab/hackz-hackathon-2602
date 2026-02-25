# WebRTC Admin-Projector 連携 実装プラン

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin 端末と Projector を WebRTC DataChannel で P2P 接続し、Admin は NFC/QR の読み取りデータだけを送信、Projector が全処理を担当するアーキテクチャを構築する。

**Architecture:** tRPC SSE + mutation でシグナリング（SDP/ICE 交換）を行い、確立後は WebRTC DataChannel で直接通信。Projector が offer 側（主導権）、Admin が answer 側（受動的センサー）。

**Tech Stack:** RTCPeerConnection (native API), tRPC SSE subscriptions, Zod, React hooks, qrcode (QR 生成), html5-qrcode (QR 読み取り)

**Design doc:** `docs/plans/2026-02-25-webrtc-admin-projector-design.md`

---

### Task 1: 共有スキーマ定義（WebRTC プロトコル + シグナリング）

**Files:**

- Create: `packages/shared/src/webrtc-protocol.ts`
- Create: `packages/shared/src/signaling-schemas.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: DataChannel メッセージスキーマを作成**

`packages/shared/src/webrtc-protocol.ts`:

```typescript
import { z } from "zod/v4";

// --- Upstream: Admin → Projector ---

export const nfcScannedMessage = z.object({
  type: z.literal("NFC_SCANNED"),
  nfcId: z.string(),
});

export const qrScannedMessage = z.object({
  type: z.literal("QR_SCANNED"),
  data: z.string(),
});

export const pongMessage = z.object({
  type: z.literal("PONG"),
});

export const upstreamMessageSchema = z.discriminatedUnion("type", [
  nfcScannedMessage,
  qrScannedMessage,
  pongMessage,
]);

export type UpstreamMessage = z.infer<typeof upstreamMessageSchema>;

// --- Downstream: Projector → Admin ---

export const scanResultMessage = z.object({
  type: z.literal("SCAN_RESULT"),
  success: z.boolean(),
  scanType: z.enum(["nfc", "qr"]),
  message: z.string().optional(),
});

export const pingMessage = z.object({
  type: z.literal("PING"),
});

export const disconnectMessage = z.object({
  type: z.literal("DISCONNECT"),
  reason: z.string(),
});

export const downstreamMessageSchema = z.discriminatedUnion("type", [
  scanResultMessage,
  pingMessage,
  disconnectMessage,
]);

export type DownstreamMessage = z.infer<typeof downstreamMessageSchema>;

// --- Serialization helpers ---

export const serializeMessage = (msg: UpstreamMessage | DownstreamMessage): string =>
  JSON.stringify(msg);

export const parseUpstreamMessage = (raw: string): UpstreamMessage =>
  upstreamMessageSchema.parse(JSON.parse(raw));

export const parseDownstreamMessage = (raw: string): DownstreamMessage =>
  downstreamMessageSchema.parse(JSON.parse(raw));
```

**Step 2: シグナリングスキーマを作成**

`packages/shared/src/signaling-schemas.ts`:

```typescript
import { z } from "zod/v4";

// --- Room management ---

export const createRoomOutputSchema = z.object({
  roomId: z.string(),
});

export const joinRoomInputSchema = z.object({
  roomId: z.string(),
});

// --- Signaling messages ---

export const sendSignalInputSchema = z.object({
  roomId: z.string(),
  type: z.enum(["offer", "answer", "ice-candidate"]),
  payload: z.string(),
  from: z.enum(["projector", "admin"]),
});

export const closeRoomInputSchema = z.object({
  roomId: z.string(),
});

// --- SSE events ---

export const signalingEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("joined") }),
  z.object({ type: z.literal("offer"), payload: z.string() }),
  z.object({ type: z.literal("answer"), payload: z.string() }),
  z.object({ type: z.literal("ice-candidate"), payload: z.string() }),
  z.object({ type: z.literal("closed") }),
]);

export type SignalingEvent = z.infer<typeof signalingEventSchema>;
```

**Step 3: index.ts に re-export を追加**

`packages/shared/src/index.ts` に以下を追加:

```typescript
export * from "./webrtc-protocol";
export * from "./signaling-schemas";
```

**Step 4: ビルド確認**

Run: `bun run build --filter=@hackz/shared`
Expected: 成功（型のみなのでエラーなし）

**Step 5: コミット**

```bash
git add packages/shared/src/webrtc-protocol.ts packages/shared/src/signaling-schemas.ts packages/shared/src/index.ts
git commit -m "feat: add WebRTC protocol and signaling schemas"
```

---

### Task 2: サーバー側シグナリング（ルーム管理 + tRPC ルーター）

**Files:**

- Create: `packages/server/src/trpc/rooms.ts`
- Create: `packages/server/src/trpc/routers/signaling.ts`
- Modify: `packages/server/src/trpc/ee.ts`
- Modify: `packages/server/src/trpc/routers/_app.ts`

**Step 1: ルーム管理モジュールを作成**

`packages/server/src/trpc/rooms.ts`:

```typescript
import { randomBytes } from "node:crypto";

interface Room {
  roomId: string;
  createdBy: string;
  adminConnected: boolean;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export const generateRoomId = (): string => randomBytes(4).toString("hex");

export const createRoom = (userId: string): Room => {
  const roomId = generateRoomId();
  const room: Room = {
    roomId,
    createdBy: userId,
    adminConnected: false,
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
};

export const getRoom = (roomId: string): Room | undefined => rooms.get(roomId);

export const markAdminConnected = (roomId: string): boolean => {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (room.adminConnected) return false; // 1:1 制限
  room.adminConnected = true;
  return true;
};

export const deleteRoom = (roomId: string): boolean => rooms.delete(roomId);
```

**Step 2: EventEmitter にシグナリングイベント発火関数を追加**

`packages/server/src/trpc/ee.ts` に追加:

```typescript
import type { SignalingEvent } from "@hackz/shared";

export const emitSignalToProjector = (roomId: string, event: SignalingEvent) => {
  ee.emit(`signal:${roomId}:projector`, event);
};

export const emitSignalToAdmin = (roomId: string, event: SignalingEvent) => {
  ee.emit(`signal:${roomId}:admin`, event);
};
```

**Step 3: シグナリングルーターを作成**

`packages/server/src/trpc/routers/signaling.ts`:

```typescript
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
  createRoomOutputSchema,
  joinRoomInputSchema,
  sendSignalInputSchema,
  closeRoomInputSchema,
  type SignalingEvent,
} from "@hackz/shared";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { ee, emitSignalToProjector, emitSignalToAdmin } from "../ee";
import { createRoom, getRoom, markAdminConnected, deleteRoom } from "../rooms";

export const signalingRouter = router({
  createRoom: protectedProcedure.output(createRoomOutputSchema).mutation(({ ctx }) => {
    const room = createRoom(ctx.userId);
    return { roomId: room.roomId };
  }),

  joinRoom: publicProcedure.input(joinRoomInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }
    if (!markAdminConnected(input.roomId)) {
      throw new TRPCError({ code: "CONFLICT", message: "Room already has an admin" });
    }
    emitSignalToProjector(input.roomId, { type: "joined" });
    return { success: true };
  }),

  sendSignal: publicProcedure.input(sendSignalInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }

    const event: SignalingEvent = {
      type: input.type as SignalingEvent["type"],
      ...(input.type !== "joined" && input.type !== "closed" ? { payload: input.payload } : {}),
    } as SignalingEvent;

    if (input.from === "admin") {
      emitSignalToProjector(input.roomId, event);
    } else {
      emitSignalToAdmin(input.roomId, event);
    }
    return { success: true };
  }),

  closeRoom: protectedProcedure.input(closeRoomInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }
    emitSignalToAdmin(input.roomId, { type: "closed" });
    deleteRoom(input.roomId);
    return { success: true };
  }),

  onSignalForProjector: protectedProcedure.input(joinRoomInputSchema).subscription(({ input }) =>
    observable<SignalingEvent>((emit) => {
      const key = `signal:${input.roomId}:projector`;
      const handler = (event: SignalingEvent) => emit.next(event);
      ee.on(key, handler);
      return () => {
        ee.off(key, handler);
      };
    }),
  ),

  onSignalForAdmin: publicProcedure.input(joinRoomInputSchema).subscription(({ input }) =>
    observable<SignalingEvent>((emit) => {
      const key = `signal:${input.roomId}:admin`;
      const handler = (event: SignalingEvent) => emit.next(event);
      ee.on(key, handler);
      return () => {
        ee.off(key, handler);
      };
    }),
  ),
});
```

**Step 4: AppRouter にシグナリングルーターを追加**

`packages/server/src/trpc/routers/_app.ts` に追加:

```typescript
import { signalingRouter } from "./signaling";

// appRouter 内に追加:
signaling: signalingRouter,
```

**Step 5: ビルド確認**

Run: `bun run build --filter=@hackz/server`
Expected: 成功

**Step 6: コミット**

```bash
git add packages/server/src/trpc/rooms.ts packages/server/src/trpc/routers/signaling.ts packages/server/src/trpc/ee.ts packages/server/src/trpc/routers/_app.ts
git commit -m "feat: add signaling tRPC router with room management"
```

---

### Task 3: Projector 側 WebRTC 接続クラス

**Files:**

- Create: `apps/projector/src/webrtc/ProjectorConnection.ts`
- Create: `apps/projector/src/webrtc/useProjectorConnection.ts`

**Step 1: ProjectorConnection クラスを作成**

`apps/projector/src/webrtc/ProjectorConnection.ts`:

```typescript
import {
  type UpstreamMessage,
  type DownstreamMessage,
  parseUpstreamMessage,
  serializeMessage,
} from "@hackz/shared";

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
    for (const h of this.stateHandlers) h(next);
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
    if (!this.pc) return;
    const answer = JSON.parse(answerPayload) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answer);
  }

  /** ICE candidate を受け取る */
  async handleIceCandidate(candidatePayload: string) {
    if (!this.pc) return;
    const candidate = JSON.parse(candidatePayload) as RTCIceCandidateInit;
    await this.pc.addIceCandidate(candidate);
  }

  /** ICE candidate 生成時のコールバックを設定 */
  onIceCandidate(handler: (candidate: string) => void) {
    if (!this.pc) return;
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
        for (const h of this.messageHandlers) h(msg);
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
```

**Step 2: React hook を作成**

`apps/projector/src/webrtc/useProjectorConnection.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { UpstreamMessage } from "@hackz/shared";
import { ProjectorConnection, type ProjectorConnectionState } from "./ProjectorConnection";
import { trpc } from "../lib/trpc";

export const useProjectorConnection = () => {
  const connectionRef = useRef<ProjectorConnection | null>(null);
  const [state, setState] = useState<ProjectorConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messageHandler, setMessageHandler] = useState<((msg: UpstreamMessage) => void) | null>(
    null,
  );

  const createRoomMutation = trpc.signaling.createRoom.useMutation();
  const sendSignalMutation = trpc.signaling.sendSignal.useMutation();
  const closeRoomMutation = trpc.signaling.closeRoom.useMutation();

  // Projector 向けシグナリング SSE
  trpc.signaling.onSignalForProjector.useSubscription(
    { roomId: roomId ?? "" },
    {
      enabled: !!roomId && state !== "connected",
      onData: async (event) => {
        const conn = connectionRef.current;
        if (!conn) return;

        switch (event.type) {
          case "joined": {
            const offerPayload = await conn.createOffer();
            conn.onIceCandidate((candidate) => {
              sendSignalMutation.mutate({
                roomId: roomId!,
                type: "ice-candidate",
                payload: candidate,
                from: "projector",
              });
            });
            sendSignalMutation.mutate({
              roomId: roomId!,
              type: "offer",
              payload: offerPayload,
              from: "projector",
            });
            break;
          }
          case "answer":
            await conn.handleAnswer(event.payload);
            break;
          case "ice-candidate":
            await conn.handleIceCandidate(event.payload);
            break;
        }
      },
    },
  );

  const open = useCallback(async () => {
    const conn = new ProjectorConnection();
    connectionRef.current = conn;
    conn.onStateChange(setState);

    const { roomId: newRoomId } = await createRoomMutation.mutateAsync();
    setRoomId(newRoomId);
    conn.onStateChange((s) => {
      setState(s);
    });
    setState("waiting");
  }, [createRoomMutation]);

  const disconnectAdmin = useCallback(() => {
    connectionRef.current?.disconnectAdmin();
  }, []);

  const close = useCallback(async () => {
    connectionRef.current?.close();
    connectionRef.current = null;
    if (roomId) {
      await closeRoomMutation.mutateAsync({ roomId });
      setRoomId(null);
    }
  }, [roomId, closeRoomMutation]);

  const onMessage = useCallback((handler: (msg: UpstreamMessage) => void) => {
    setMessageHandler(() => handler);
  }, []);

  // メッセージハンドラの登録
  useEffect(() => {
    if (!connectionRef.current || !messageHandler) return;
    return connectionRef.current.onMessage(messageHandler);
  }, [messageHandler, state]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      connectionRef.current?.close();
    };
  }, []);

  return { state, roomId, open, close, disconnectAdmin, onMessage };
};
```

**Step 3: ビルド確認**

Run: `bun run build --filter=@hackz/projector`
Expected: 成功

**Step 4: コミット**

```bash
git add apps/projector/src/webrtc/
git commit -m "feat: add ProjectorConnection class and React hook"
```

---

### Task 4: Admin 側 WebRTC 接続クラス

**Files:**

- Create: `apps/admin/src/webrtc/AdminConnection.ts`
- Create: `apps/admin/src/webrtc/useAdminConnection.ts`

**Step 1: AdminConnection クラスを作成**

`apps/admin/src/webrtc/AdminConnection.ts`:

```typescript
import {
  type DownstreamMessage,
  type UpstreamMessage,
  parseDownstreamMessage,
  serializeMessage,
} from "@hackz/shared";

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
    for (const h of this.stateHandlers) h(next);
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
    if (!this.pc) return;
    const candidate = JSON.parse(candidatePayload) as RTCIceCandidateInit;
    await this.pc.addIceCandidate(candidate);
  }

  /** ICE candidate 生成時のコールバックを設定 */
  onIceCandidate(handler: (candidate: string) => void) {
    if (!this.pc) return;
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
          for (const h of this.messageHandlers) h(msg);
          return;
        }
        for (const h of this.messageHandlers) h(msg);
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
      for (const h of this.stateHandlers) h("reconnecting");
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
```

**Step 2: React hook を作成**

`apps/admin/src/webrtc/useAdminConnection.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { DownstreamMessage } from "@hackz/shared";
import { AdminConnection, type AdminConnectionState } from "./AdminConnection";
import { trpc } from "../lib/trpc";

export const useAdminConnection = () => {
  const connectionRef = useRef<AdminConnection | null>(null);
  const [state, setState] = useState<AdminConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messageHandler, setMessageHandler] = useState<((msg: DownstreamMessage) => void) | null>(
    null,
  );

  const joinRoomMutation = trpc.signaling.joinRoom.useMutation();
  const sendSignalMutation = trpc.signaling.sendSignal.useMutation();

  // Admin 向けシグナリング SSE
  trpc.signaling.onSignalForAdmin.useSubscription(
    { roomId: roomId ?? "" },
    {
      enabled: !!roomId && state !== "connected",
      onData: async (event) => {
        const conn = connectionRef.current;
        if (!conn) return;

        switch (event.type) {
          case "offer": {
            const answerPayload = await conn.handleOffer(event.payload);
            conn.onIceCandidate((candidate) => {
              sendSignalMutation.mutate({
                roomId: roomId!,
                type: "ice-candidate",
                payload: candidate,
                from: "admin",
              });
            });
            sendSignalMutation.mutate({
              roomId: roomId!,
              type: "answer",
              payload: answerPayload,
              from: "admin",
            });
            break;
          }
          case "ice-candidate":
            await conn.handleIceCandidate(event.payload);
            break;
          case "closed":
            conn.disconnect();
            setRoomId(null);
            break;
        }
      },
    },
  );

  const connect = useCallback(
    async (targetRoomId: string) => {
      const conn = new AdminConnection();
      connectionRef.current = conn;
      conn.setRoomId(targetRoomId);
      conn.onStateChange(setState);
      setRoomId(targetRoomId);

      await joinRoomMutation.mutateAsync({ roomId: targetRoomId });
      // SSE subscription が有効になり、offer を待つ
    },
    [joinRoomMutation],
  );

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setRoomId(null);
  }, []);

  const sendNfcScan = useCallback((nfcId: string) => {
    connectionRef.current?.send({ type: "NFC_SCANNED", nfcId });
  }, []);

  const sendQrScan = useCallback((data: string) => {
    connectionRef.current?.send({ type: "QR_SCANNED", data });
  }, []);

  const onMessage = useCallback((handler: (msg: DownstreamMessage) => void) => {
    setMessageHandler(() => handler);
  }, []);

  // メッセージハンドラの登録
  useEffect(() => {
    if (!connectionRef.current || !messageHandler) return;
    return connectionRef.current.onMessage(messageHandler);
  }, [messageHandler, state]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  return { state, roomId, connect, disconnect, sendNfcScan, sendQrScan, onMessage };
};
```

**Step 3: ビルド確認**

Run: `bun run build --filter=@hackz/admin`
Expected: 成功

**Step 4: コミット**

```bash
git add apps/admin/src/webrtc/
git commit -m "feat: add AdminConnection class and React hook"
```

---

### Task 5: QR コードライブラリ導入

**Files:**

- Modify: `apps/projector/package.json` (via bun add)
- Modify: `apps/admin/package.json` (via bun add)

**Step 1: Projector に QR コード生成ライブラリを追加**

Run: `cd apps/projector && bun add qrcode.react`

**Step 2: Admin に QR コード読み取りライブラリを追加**

Run: `cd apps/admin && bun add html5-qrcode`

**Step 3: コミット**

```bash
git add apps/projector/package.json apps/admin/package.json bun.lock
git commit -m "feat: add QR code libraries (qrcode.react, html5-qrcode)"
```

---

### Task 6: Projector UI（QR 表示 + 接続管理 + 切断ボタン）

**Files:**

- Modify: `apps/projector/src/routes/index.tsx`

**Step 1: Projector ページを実装**

`apps/projector/src/routes/index.tsx` を以下に置き換え:

```typescript
import { useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { UpstreamMessage } from "@hackz/shared";
import { useProjectorConnection } from "../webrtc/useProjectorConnection";

const ProjectorPage = () => {
  const { state, roomId, open, close, disconnectAdmin, onMessage } = useProjectorConnection();

  // 起動時にルームを作成
  useEffect(() => {
    open();
    return () => {
      close();
    };
  }, []);

  // Admin からのメッセージを処理
  const handleMessage = useCallback((msg: UpstreamMessage) => {
    switch (msg.type) {
      case "NFC_SCANNED":
        console.log("NFC scanned:", msg.nfcId);
        // TODO: tRPC で auth.nfcLogin を呼んで結果を Admin に返す
        break;
      case "QR_SCANNED":
        console.log("QR scanned:", msg.data);
        // TODO: QR データを処理して結果を Admin に返す
        break;
    }
  }, []);

  useEffect(() => {
    onMessage(handleMessage);
  }, [onMessage, handleMessage]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      {/* 接続ステータス */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            state === "connected"
              ? "bg-green-500"
              : state === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : state === "waiting"
                  ? "bg-blue-500 animate-pulse"
                  : "bg-red-500"
          }`}
        />
        <span className="text-sm text-gray-400">
          {state === "connected"
            ? "Admin 接続中"
            : state === "connecting"
              ? "接続中..."
              : state === "waiting"
                ? "Admin 待ち"
                : "未接続"}
        </span>
        {state === "connected" && (
          <button
            type="button"
            onClick={disconnectAdmin}
            className="ml-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
          >
            Admin を切断
          </button>
        )}
      </div>

      {/* メインコンテンツ */}
      {state !== "connected" ? (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">Idol Interactive Demo</h1>
          {roomId && (
            <>
              <QRCodeSVG value={roomId} size={256} bgColor="#111827" fgColor="#ffffff" level="M" />
              <p className="text-gray-400">Admin 端末でこの QR コードを読み取ってください</p>
              <p className="text-xs text-gray-600">Room: {roomId}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold">Idol Interactive Demo</h1>
          <p className="text-xl text-gray-400">Projector Display</p>
          <p className="text-green-400">Admin 端末が接続されています</p>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: ProjectorPage,
});
```

**Step 2: ビルド確認**

Run: `bun run build --filter=@hackz/projector`
Expected: 成功

**Step 3: コミット**

```bash
git add apps/projector/src/routes/index.tsx
git commit -m "feat: add Projector UI with QR code display and connection management"
```

---

### Task 7: Admin UI（QR スキャン + 接続 + スキャン結果表示）

**Files:**

- Modify: `apps/admin/src/routes/index.tsx`

**Step 1: Admin ページを実装**

`apps/admin/src/routes/index.tsx` を以下に置き換え:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import type { DownstreamMessage } from "@hackz/shared";
import { useAdminConnection } from "../webrtc/useAdminConnection";

type ScanFeedback = { success: boolean; message: string } | null;

const AdminPage = () => {
  const { state, connect, disconnect, sendNfcScan, onMessage } = useAdminConnection();
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // スキャン結果のフィードバック処理
  const handleMessage = useCallback((msg: DownstreamMessage) => {
    if (msg.type === "SCAN_RESULT") {
      setFeedback({ success: msg.success, message: msg.message ?? (msg.success ? "成功" : "失敗") });
      setTimeout(() => setFeedback(null), 3000);
    }
    if (msg.type === "DISCONNECT") {
      setFeedback({ success: false, message: `切断: ${msg.reason}` });
    }
  }, []);

  useEffect(() => {
    onMessage(handleMessage);
  }, [onMessage, handleMessage]);

  // QR コードスキャン開始
  const startQrScan = useCallback(async () => {
    if (scannerRef.current) return;
    setScanning(true);
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        await scanner.stop();
        scannerRef.current = null;
        setScanning(false);
        // QR の中身が roomId → Projector に接続
        await connect(decodedText);
      },
      () => {}, // scan failure (continuous, not an error)
    );
  }, [connect]);

  // NFC スキャン（テスト用ボタン）
  const handleNfcInput = useCallback(() => {
    const nfcId = prompt("NFC ID を入力:");
    if (nfcId) {
      sendNfcScan(nfcId);
    }
  }, [sendNfcScan]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      {/* 接続ステータス */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            state === "connected"
              ? "bg-green-500"
              : state === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : state === "reconnecting"
                  ? "bg-orange-500 animate-pulse"
                  : "bg-red-500"
          }`}
        />
        <span className="text-sm text-gray-600">
          {state === "connected"
            ? "接続済み"
            : state === "connecting"
              ? "接続中..."
              : state === "reconnecting"
                ? "再接続中..."
                : "未接続"}
        </span>
      </div>

      {/* フィードバック */}
      {feedback && (
        <div
          className={`fixed top-16 inset-x-4 p-4 rounded-lg text-center text-white font-bold text-lg ${
            feedback.success ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 未接続: QR スキャン画面 */}
      {state === "disconnected" && (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin 端末</h2>
          <p className="text-gray-600">Projector の QR コードをスキャンして接続</p>
          <div id="qr-reader" className="w-[300px] h-[300px]" />
          {!scanning && (
            <button
              type="button"
              onClick={startQrScan}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              QR コードをスキャン
            </button>
          )}
        </div>
      )}

      {/* 接続中 */}
      {(state === "connecting" || state === "reconnecting") && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">
            {state === "connecting" ? "Projector に接続中..." : "再接続中..."}
          </p>
        </div>
      )}

      {/* 接続済み: スキャン待ち画面 */}
      {state === "connected" && (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-gray-800">スキャン待ち</h2>
          <p className="text-gray-600">NFC タグをかざすか QR コードを読み取ってください</p>

          <button
            type="button"
            onClick={handleNfcInput}
            className="w-full max-w-xs px-6 py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700"
          >
            NFC スキャン（テスト）
          </button>

          <button
            type="button"
            onClick={disconnect}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            切断
          </button>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: AdminPage,
});
```

**Step 2: ビルド確認**

Run: `bun run build --filter=@hackz/admin`
Expected: 成功

**Step 3: コミット**

```bash
git add apps/admin/src/routes/index.tsx
git commit -m "feat: add Admin UI with QR scanning and NFC input"
```

---

### Task 8: 結合テスト（手動）

**Step 1: DynamoDB Local 起動**

Run: `docker compose up -d`

**Step 2: テーブル初期化**

Run: `bun run db:init`

**Step 3: 開発サーバー起動**

Run: `bun run dev`

**Step 4: 動作確認チェックリスト**

1. Projector（`http://localhost:5174`）を開く → QR コードが表示される
2. Admin（`http://localhost:5173`）を開く → 「QR コードをスキャン」ボタンが表示される
3. Admin で QR コードをスキャン → 接続状態が「接続中...」→「接続済み」に変わる
4. Projector 側も「Admin 接続中」（緑バッジ）に変わる
5. Admin で「NFC スキャン（テスト）」ボタン → ID 入力 → Projector のコンソールにログ表示
6. Projector の「Admin を切断」ボタン → 双方が切断状態に戻る
7. Projector は新しい QR コードを表示する
8. Admin で再度 QR スキャン → 再接続できる

**Step 5: 確認完了後コミット**

```bash
git commit --allow-empty -m "test: verify WebRTC admin-projector connection manually"
```

---

### Task 9: リント・フォーマット・ビルド最終確認

**Step 1: リント**

Run: `bun run lint`
Expected: エラーなし

**Step 2: フォーマット**

Run: `bun run format:fix`

**Step 3: ビルド**

Run: `bun run build`
Expected: 全アプリ成功

**Step 4: コミット（必要な場合）**

```bash
git add -A
git commit -m "chore: fix lint and format issues"
```
