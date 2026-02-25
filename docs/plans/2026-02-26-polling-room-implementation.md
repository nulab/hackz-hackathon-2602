# Polling Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PeerJS（WebRTC）と tRPC SSE subscription を全廃し、インメモリ Room + tRPC polling に統一する。

**Architecture:** サーバー上の `RoomStore`（Map ベース）でルームとメッセージキューを管理。tRPC `room` router で CRUD + polling API を提供。フロントエンドは `useRoomPolling` hook で定期取得。

**Tech Stack:** tRPC (query/mutation のみ), Zod, TanStack Query refetchInterval, crypto.randomUUID()

**Design doc:** `docs/plans/2026-02-26-polling-room-design.md`

---

### Task 1: Shared — Room 用 Zod スキーマ追加

**Files:**

- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: `schemas.ts` に Room 関連スキーマを追加**

ファイル末尾（SSE Event Schemas セクションの後）に追加:

```ts
// === Room Polling Schemas ===

export const roomChannelSchema = z.enum(["upstream", "downstream", "projector"]);
export type RoomChannel = z.infer<typeof roomChannelSchema>;

export const roomRoleSchema = z.enum(["admin", "projector"]);
export type RoomRole = z.infer<typeof roomRoleSchema>;

export const roomMessageSchema = z.object({
  id: z.number(),
  type: z.string(),
  payload: z.unknown(),
  createdAt: z.number(),
});
export type RoomMessage = z.infer<typeof roomMessageSchema>;

// Procedure inputs
export const roomJoinInputSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomSendInputSchema = z.object({
  roomId: z.string().uuid(),
  channel: roomChannelSchema,
  message: z.object({
    type: z.string(),
    payload: z.unknown(),
  }),
});

export const roomPollInputSchema = z.object({
  roomId: z.string().uuid(),
  channel: z.string(), // "upstream" | "downstream" | "projector" | "session:{id}"
  afterId: z.number().optional(),
});

export const roomHeartbeatInputSchema = z.object({
  roomId: z.string().uuid(),
  role: roomRoleSchema,
});

export const roomDisconnectInputSchema = z.object({
  roomId: z.string().uuid(),
  role: roomRoleSchema,
});

// Procedure outputs
export const roomCreateOutputSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomPollOutputSchema = z.object({
  messages: z.array(roomMessageSchema),
  lastId: z.number(),
});

export const roomHeartbeatOutputSchema = z.object({
  peerConnected: z.boolean(),
  peerLastSeen: z.number(),
});
```

**Step 2: lint & format**

Run: `bun run lint:fix && bun run format:fix`

**Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat: add room polling Zod schemas"
```

---

### Task 2: Server — RoomStore 実装

**Files:**

- Create: `packages/server/src/room-store.ts`
- Create: `packages/server/src/room-store.test.ts`

**Step 1: テストを書く**

`room-store.test.ts`:

```ts
import { describe, test, expect, beforeEach } from "bun:test";
import { RoomStore } from "./room-store";

describe("RoomStore", () => {
  let store: RoomStore;

  beforeEach(() => {
    store = new RoomStore();
  });

  test("createRoom returns a uuid roomId", () => {
    const roomId = store.createRoom();
    expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test("joinRoom succeeds for existing room", () => {
    const roomId = store.createRoom();
    expect(store.joinRoom(roomId)).toBe(true);
  });

  test("joinRoom fails for non-existent room", () => {
    expect(store.joinRoom("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  test("send and poll messages", () => {
    const roomId = store.createRoom();
    const msgId = store.send(roomId, "upstream", {
      type: "NFC_SCANNED",
      payload: { nfcId: "abc" },
    });
    expect(msgId).toBe(1);

    const result = store.poll(roomId, "upstream");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("NFC_SCANNED");
    expect(result.lastId).toBe(1);
  });

  test("poll with afterId returns only new messages", () => {
    const roomId = store.createRoom();
    store.send(roomId, "upstream", { type: "A", payload: {} });
    store.send(roomId, "upstream", { type: "B", payload: {} });

    const result = store.poll(roomId, "upstream", 1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("B");
  });

  test("poll returns empty for unknown room", () => {
    const result = store.poll("00000000-0000-0000-0000-000000000000", "upstream");
    expect(result.messages).toHaveLength(0);
    expect(result.lastId).toBe(0);
  });

  test("broadcast sends to all rooms projector channel", () => {
    const r1 = store.createRoom();
    const r2 = store.createRoom();
    store.broadcast("projector", { type: "gacha:result", payload: { costumeId: "x" } });

    expect(store.poll(r1, "projector").messages).toHaveLength(1);
    expect(store.poll(r2, "projector").messages).toHaveLength(1);
  });

  test("heartbeat tracks peer activity", () => {
    const roomId = store.createRoom();
    const result = store.heartbeat(roomId, "admin");
    expect(result.peerConnected).toBe(false); // projector hasn't heartbeated yet

    store.heartbeat(roomId, "projector");
    const result2 = store.heartbeat(roomId, "admin");
    expect(result2.peerConnected).toBe(true);
  });

  test("disconnect marks role as disconnected", () => {
    const roomId = store.createRoom();
    store.heartbeat(roomId, "admin");
    store.heartbeat(roomId, "projector");

    store.disconnect(roomId, "admin");
    const result = store.heartbeat(roomId, "projector");
    expect(result.peerConnected).toBe(false);
  });

  test("messages are capped at 100 per channel", () => {
    const roomId = store.createRoom();
    for (let i = 0; i < 110; i++) {
      store.send(roomId, "upstream", { type: "msg", payload: { i } });
    }
    const result = store.poll(roomId, "upstream");
    expect(result.messages).toHaveLength(100);
    expect(result.messages[0].id).toBe(11); // oldest 10 trimmed
  });

  test("cleanup removes expired rooms", () => {
    const roomId = store.createRoom();
    // Force room to be expired
    store._getRoom(roomId)!.lastActivity = Date.now() - 31 * 60 * 1000;
    store.cleanup();
    expect(store.joinRoom(roomId)).toBe(false);
  });
});
```

**Step 2: テスト失敗を確認**

Run: `cd packages/server && bun test src/room-store.test.ts`
Expected: FAIL — `room-store` module not found

**Step 3: RoomStore を実装**

`room-store.ts`:

```ts
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
    if (!room) return 0;

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

    // Cap at MAX_MESSAGES_PER_CHANNEL
    if (ch.length > MAX_MESSAGES_PER_CHANNEL) {
      ch.splice(0, ch.length - MAX_MESSAGES_PER_CHANNEL);
    }

    return id;
  }

  poll(roomId: string, channel: string, afterId?: number): { messages: Message[]; lastId: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { messages: [], lastId: 0 };

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
    if (!room) return { peerConnected: false, peerLastSeen: 0 };

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
    if (!room) return false;

    if (role === "admin") {
      room.adminLastSeen = 0;
    } else {
      room.projectorLastSeen = 0;
    }

    // Both disconnected → remove room
    if (room.adminLastSeen === 0 && room.projectorLastSeen === 0) {
      this.rooms.delete(roomId);
    }
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

  /** テスト用: Room を直接取得 */
  _getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
}

// Singleton instance
export const roomStore = new RoomStore();
```

**Step 4: テスト通過を確認**

Run: `cd packages/server && bun test src/room-store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/room-store.ts packages/server/src/room-store.test.ts
git commit -m "feat: add RoomStore with in-memory room management and tests"
```

---

### Task 3: Server — tRPC `room` router 実装

**Files:**

- Create: `packages/server/src/trpc/routers/room.ts`
- Modify: `packages/server/src/trpc/routers/_app.ts`

**Step 1: `room.ts` を作成**

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  roomJoinInputSchema,
  roomSendInputSchema,
  roomPollInputSchema,
  roomHeartbeatInputSchema,
  roomDisconnectInputSchema,
  roomCreateOutputSchema,
  roomPollOutputSchema,
  roomHeartbeatOutputSchema,
} from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { roomStore } from "../../room-store";

export const roomRouter = router({
  create: publicProcedure.output(roomCreateOutputSchema).mutation(() => {
    const roomId = roomStore.createRoom();
    return { roomId };
  }),

  join: publicProcedure
    .input(roomJoinInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(({ input }) => {
      if (!roomStore.joinRoom(input.roomId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }
      return { ok: true };
    }),

  send: publicProcedure
    .input(roomSendInputSchema)
    .output(z.object({ messageId: z.number() }))
    .mutation(({ input }) => {
      const messageId = roomStore.send(input.roomId, input.channel, input.message);
      if (messageId === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }
      return { messageId };
    }),

  poll: publicProcedure
    .input(roomPollInputSchema)
    .output(roomPollOutputSchema)
    .query(({ input }) => {
      return roomStore.poll(input.roomId, input.channel, input.afterId);
    }),

  heartbeat: publicProcedure
    .input(roomHeartbeatInputSchema)
    .output(roomHeartbeatOutputSchema)
    .mutation(({ input }) => {
      return roomStore.heartbeat(input.roomId, input.role);
    }),

  disconnect: publicProcedure
    .input(roomDisconnectInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(({ input }) => {
      roomStore.disconnect(input.roomId, input.role);
      return { ok: true };
    }),
});
```

**Step 2: `_app.ts` に room router を追加**

```ts
import { roomRouter } from "./room";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  gacha: gachaRouter,
  costumes: costumesRouter,
  sessions: sessionsRouter,
  synthesis: synthesisRouter,
  sub: subscriptionRouter, // 後で削除（Task 6）
  room: roomRouter,
});
```

**Step 3: lint & format**

Run: `bun run lint:fix && bun run format:fix`

**Step 4: ビルド確認**

Run: `bun run build`
Expected: 成功

**Step 5: Commit**

```bash
git add packages/server/src/trpc/routers/room.ts packages/server/src/trpc/routers/_app.ts
git commit -m "feat: add tRPC room router for polling-based communication"
```

---

### Task 4: Server — gacha router を roomStore.broadcast に移行

**Files:**

- Modify: `packages/server/src/trpc/routers/gacha.ts`

**Step 1: `emitProjectorEvent` → `roomStore.broadcast` に変更**

```ts
// Before:
import { emitProjectorEvent } from "../ee";
// ...
emitProjectorEvent({ type: "gacha:result", ... });

// After:
import { roomStore } from "../../room-store";
// ...
roomStore.broadcast("projector", {
  type: "gacha:result",
  payload: {
    userId: ctx.userId,
    costumeId: costume.id,
    costumeName: costume.name,
    rarity: costume.rarity,
    category: costume.category,
  },
});
```

**Step 2: ビルド確認**

Run: `bun run build`

**Step 3: Commit**

```bash
git add packages/server/src/trpc/routers/gacha.ts
git commit -m "refactor: migrate gacha broadcast from EventEmitter to RoomStore"
```

---

### Task 5: Server — RoomStore クリーンアップタイマー起動

**Files:**

- Modify: `packages/server/src/index.ts`

**Step 1: クリーンアップ interval を追加**

`index.ts` の `server.listen` の後に追加:

```ts
import { roomStore } from "./room-store";

// Room cleanup every 60 seconds
setInterval(() => {
  roomStore.cleanup();
}, 60_000);
```

**Step 2: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat: add periodic room cleanup timer"
```

---

### Task 6: Server — 旧リアルタイム基盤を削除

**Files:**

- Delete: `packages/server/src/trpc/routers/subscriptions.ts`
- Delete: `packages/server/src/trpc/ee.ts`
- Modify: `packages/server/src/trpc/routers/_app.ts` — `sub` を削除
- Modify: `packages/server/src/index.ts` — `ExpressPeerServer` と `createAdaptorServer` を削除

**Step 1: `_app.ts` から `sub` router を削除**

`subscriptionRouter` の import と `sub: subscriptionRouter` 行を削除。

**Step 2: `index.ts` から PeerJS を削除**

Before:

```ts
import { createAdaptorServer } from "@hono/node-server";
import { ExpressPeerServer } from "peer";
// ...
const server = createAdaptorServer(app);
ExpressPeerServer(server, { path: "/peerjs", allow_discovery: false });
server.listen(port, () => { ... });
```

After:

```ts
import { serve } from "@hono/node-server";
// ...
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

注意: `createAdaptorServer` は PeerJS が http.Server を必要としたから使っていた。PeerJS を消したので `serve` に簡略化できる。

**Step 3: `subscriptions.ts` と `ee.ts` を削除**

```bash
rm packages/server/src/trpc/routers/subscriptions.ts
rm packages/server/src/trpc/ee.ts
```

**Step 4: ビルド確認**

Run: `bun run build`
Expected: 成功（フロントエンドは subscription の import 部分で warning が出る可能性あり。次タスクで修正）

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove PeerJS server, SSE subscriptions, and EventEmitter"
```

---

### Task 7: 全アプリ — tRPC Provider から SSE subscription link を削除

**Files:**

- Modify: `apps/admin/src/lib/trpc-provider.tsx`
- Modify: `apps/mobile/src/lib/trpc-provider.tsx`
- Modify: `apps/projector/src/lib/trpc-provider.tsx`

**Step 1: 3ファイルとも同一変更**

Before:

```ts
import { httpBatchLink, splitLink, unstable_httpSubscriptionLink } from "@trpc/client";
// ...
links: [
  splitLink({
    condition: (op) => op.type === "subscription",
    true: unstable_httpSubscriptionLink({ url: API_URL }),
    false: httpBatchLink({ url: API_URL, headers: getAuthHeaders }),
  }),
],
```

After:

```ts
import { httpBatchLink } from "@trpc/client";
// ...
links: [
  httpBatchLink({
    url: API_URL,
    headers: getAuthHeaders,
  }),
],
```

**Step 2: ビルド確認**

Run: `bun run build`

**Step 3: Commit**

```bash
git add apps/*/src/lib/trpc-provider.tsx
git commit -m "refactor: remove SSE subscription link from all tRPC providers"
```

---

### Task 8: Projector — useRoomConnection hook 実装

**Files:**

- Create: `apps/projector/src/hooks/useRoomConnection.ts`

**Step 1: hook を実装**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

export type RoomConnectionState = "disconnected" | "waiting" | "connected";

type Message = { id: number; type: string; payload: unknown; createdAt: number };

export const useRoomConnection = (options?: {
  pollInterval?: number;
  heartbeatInterval?: number;
}) => {
  const pollInterval = options?.pollInterval ?? 1000;
  const heartbeatInterval = options?.heartbeatInterval ?? 5000;

  const [state, setState] = useState<RoomConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const cursorRef = useRef<Record<string, number>>({});
  const messageHandlersRef = useRef<Map<string, Set<(msgs: Message[]) => void>>>(new Map());

  const createMutation = trpc.room.create.useMutation();
  const heartbeatMutation = trpc.room.heartbeat.useMutation();
  const disconnectMutation = trpc.room.disconnect.useMutation();

  // Create room
  const open = useCallback(async () => {
    const result = await createMutation.mutateAsync();
    setRoomId(result.roomId);
    setState("waiting");
  }, [createMutation]);

  // Close room
  const close = useCallback(() => {
    if (roomId) {
      disconnectMutation.mutate({ roomId, role: "projector" });
    }
    setRoomId(null);
    setState("disconnected");
    setPeerConnected(false);
    cursorRef.current = {};
  }, [roomId, disconnectMutation]);

  // Disconnect admin only
  const disconnectAdmin = useCallback(() => {
    // No direct action needed — admin's heartbeat will timeout
    // Optionally send a message
    setPeerConnected(false);
    setState("waiting");
  }, []);

  // Register message handler for a channel
  const onChannelMessages = useCallback((channel: string, handler: (msgs: Message[]) => void) => {
    let handlers = messageHandlersRef.current.get(channel);
    if (!handlers) {
      handlers = new Set();
      messageHandlersRef.current.set(channel, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers!.delete(handler);
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        const result = await heartbeatMutation.mutateAsync({ roomId, role: "projector" });
        setPeerConnected(result.peerConnected);
        setState(result.peerConnected ? "connected" : "waiting");
      } catch {
        // Room may have been deleted
      }
    }, heartbeatInterval);
    return () => clearInterval(interval);
  }, [roomId, heartbeatInterval, heartbeatMutation]);

  return { state, roomId, peerConnected, open, close, disconnectAdmin, onChannelMessages };
};
```

**Step 2: Commit**

```bash
git add apps/projector/src/hooks/useRoomConnection.ts
git commit -m "feat: add useRoomConnection hook for projector polling"
```

---

### Task 9: Projector — useRoomPolling hook 実装

**Files:**

- Create: `apps/projector/src/hooks/useRoomPolling.ts`

**Step 1: hook を実装**

```ts
import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";

type Message = { id: number; type: string; payload: unknown; createdAt: number };

export const useRoomPolling = (
  roomId: string | null,
  channel: string,
  intervalMs: number,
  onMessages: (messages: Message[]) => void,
) => {
  const cursorRef = useRef(0);
  const onMessagesRef = useRef(onMessages);
  onMessagesRef.current = onMessages;

  const { data } = trpc.room.poll.useQuery(
    { roomId: roomId!, channel, afterId: cursorRef.current },
    {
      enabled: !!roomId,
      refetchInterval: intervalMs,
    },
  );

  useEffect(() => {
    if (!data || data.messages.length === 0) return;
    cursorRef.current = data.lastId;
    onMessagesRef.current(data.messages);
  }, [data]);
};
```

**Step 2: Commit**

```bash
git add apps/projector/src/hooks/useRoomPolling.ts
git commit -m "feat: add useRoomPolling hook for channel-based message polling"
```

---

### Task 10: Projector — ルート移行（index.tsx, pair.tsx）

**Files:**

- Modify: `apps/projector/src/routes/index.tsx`
- Modify: `apps/projector/src/routes/pair.tsx`

**Step 1: `index.tsx` を移行**

`useProjectorConnection` → `useRoomConnection` + `useRoomPolling` に置き換え。

- import を変更
- `open/close/disconnectAdmin` はそのまま使える（同名）
- `onMessage` → `useRoomPolling(roomId, "upstream", 1000, handler)` に変更
- 接続状態の型は `RoomConnectionState` に変更（"waiting" | "connected" | "disconnected"）
- QR コードの value は `roomId`（UUID）ではなく、Admin の接続 URL にする:
  `${ADMIN_BASE}/connect/${roomId}`

**Step 2: `pair.tsx` を同様に移行**

同じパターンで `useProjectorConnection` → `useRoomConnection` + `useRoomPolling` に変更。

**Step 3: ビルド確認**

Run: `bun run build`

**Step 4: Commit**

```bash
git add apps/projector/src/routes/index.tsx apps/projector/src/routes/pair.tsx
git commit -m "refactor: migrate projector routes from PeerJS to room polling"
```

---

### Task 11: Admin — useRoomConnection hook 実装

**Files:**

- Create: `apps/admin/src/hooks/useRoomConnection.ts`

**Step 1: hook を実装**

```ts
import { useCallback, useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

export type AdminConnectionState = "disconnected" | "connecting" | "connected";

export const useAdminRoomConnection = () => {
  const [state, setState] = useState<AdminConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);

  const joinMutation = trpc.room.join.useMutation();
  const sendMutation = trpc.room.send.useMutation();
  const heartbeatMutation = trpc.room.heartbeat.useMutation();
  const disconnectMutation = trpc.room.disconnect.useMutation();

  // Join room
  const connect = useCallback(
    async (targetRoomId: string) => {
      setState("connecting");
      try {
        await joinMutation.mutateAsync({ roomId: targetRoomId });
        setRoomId(targetRoomId);
        setState("connected");
      } catch {
        setState("disconnected");
      }
    },
    [joinMutation],
  );

  // Disconnect
  const disconnect = useCallback(() => {
    if (roomId) {
      disconnectMutation.mutate({ roomId, role: "admin" });
    }
    setRoomId(null);
    setState("disconnected");
  }, [roomId, disconnectMutation]);

  // Send NFC scan
  const sendNfcScan = useCallback(
    (nfcId: string) => {
      if (!roomId) return;
      sendMutation.mutate({
        roomId,
        channel: "upstream",
        message: { type: "NFC_SCANNED", payload: { nfcId } },
      });
    },
    [roomId, sendMutation],
  );

  // Send QR scan
  const sendQrScan = useCallback(
    (data: string) => {
      if (!roomId) return;
      sendMutation.mutate({
        roomId,
        channel: "upstream",
        message: { type: "QR_SCANNED", payload: { data } },
      });
    },
    [roomId, sendMutation],
  );

  // Heartbeat
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        await heartbeatMutation.mutateAsync({ roomId, role: "admin" });
      } catch {
        setState("disconnected");
        setRoomId(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, heartbeatMutation]);

  return { state, roomId, connect, disconnect, sendNfcScan, sendQrScan };
};
```

**Step 2: Commit**

```bash
git add apps/admin/src/hooks/useRoomConnection.ts
git commit -m "feat: add useAdminRoomConnection hook for admin polling"
```

---

### Task 12: Admin — useRoomPolling hook 実装

**Files:**

- Create: `apps/admin/src/hooks/useRoomPolling.ts`

**Step 1: Task 9 と同じ内容のファイルを作成**

import パスだけ `"../lib/trpc"` に合わせる（同一）。

**Step 2: Commit**

```bash
git add apps/admin/src/hooks/useRoomPolling.ts
git commit -m "feat: add useRoomPolling hook for admin"
```

---

### Task 13: Admin — ルート移行（index.tsx, connect.$roomId.tsx）

**Files:**

- Modify: `apps/admin/src/routes/index.tsx`
- Modify: `apps/admin/src/routes/connect.$roomId.tsx`

**Step 1: `index.tsx` を移行**

- `useAdminConnection` → `useAdminRoomConnection` に変更
- QR スキャンで取得した URL から roomId を抽出（URL の最後のパスセグメント）
- `connect(decodedText)` → URL パース → `connect(roomId)` に変更
- `AdminConnectionState` の型変更: "reconnecting" は不要になる（polling なので再接続は自動）

**Step 2: `connect.$roomId.tsx` を移行**

- `useAdminConnection` → `useAdminRoomConnection` に変更
- `useRoomPolling(roomId, "downstream", 1000, handler)` でスキャン結果を受信
- `sendNfcScan` / `sendQrScan` はそのまま使える

**Step 3: ビルド確認**

Run: `bun run build`

**Step 4: Commit**

```bash
git add apps/admin/src/routes/index.tsx apps/admin/src/routes/connect.\$roomId.tsx
git commit -m "refactor: migrate admin routes from PeerJS to room polling"
```

---

### Task 14: WebRTC / PeerJS ファイル・パッケージ削除

**Files:**

- Delete: `apps/projector/src/webrtc/` ディレクトリ
- Delete: `apps/admin/src/webrtc/` ディレクトリ
- Delete: `packages/shared/src/peer-config.ts`
- Delete: `packages/shared/src/webrtc-protocol.ts`
- Modify: `packages/shared/src/index.ts` — peer-config と webrtc-protocol の re-export を削除

**Step 1: ファイル削除**

```bash
rm -rf apps/projector/src/webrtc
rm -rf apps/admin/src/webrtc
rm packages/shared/src/peer-config.ts
rm packages/shared/src/webrtc-protocol.ts
```

**Step 2: `shared/src/index.ts` を修正**

削除:

```ts
export * from "./webrtc-protocol";
export * from "./peer-config";
```

**Step 3: パッケージ削除**

```bash
cd apps/projector && bun remove peerjs
cd ../admin && bun remove peerjs
cd ../../packages/server && bun remove peer @hono/node-server
```

注意: `@hono/node-server` は `createAdaptorServer` が不要になったので削除。ただし `serve` を使うなら残す。Task 6 での `index.ts` の変更次第で判断。`serve` 関数を `@hono/node-server` からインポートするなら残す。

**Step 4: ビルド確認**

Run: `bun run build`

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove PeerJS, WebRTC protocol, and peer-config from all packages"
```

---

### Task 15: Terraform — `/peerjs/*` behavior 削除

**Files:**

- Modify: `terraform/cloudfront.tf` — `/peerjs/*` ordered_cache_behavior ブロック (L208-L227) を削除
- Modify: `terraform/alb.tf` — `idle_timeout = 300` を `idle_timeout = 60` に変更（任意）

**Step 1: cloudfront.tf から PeerJS behavior を削除**

L208-L227 の `/peerjs/*` ordered_cache_behavior ブロック全体を削除。
コメント `# /peerjs/* → ALB（PeerJS WebSocket シグナリング）` も削除。

**Step 2: alb.tf の idle_timeout を 60 に戻す（任意）**

SSE の長時間接続がなくなったので 300 は不要。60（デフォルト）で十分。
コメントも `# SSE サブスクリプションの長時間接続に対応するため 300 秒に設定` → `# polling API 用` に変更。

**Step 3: Commit**

```bash
git add terraform/cloudfront.tf terraform/alb.tf
git commit -m "infra: remove PeerJS WebSocket behavior and reduce ALB idle timeout"
```

---

### Task 16: 最終確認

**Step 1: 全テスト実行**

Run: `bun test`

**Step 2: ビルド確認**

Run: `bun run build`

**Step 3: lint & format**

Run: `bun run lint && bun run format`

**Step 4: 不要な SSE Event Schema の確認**

`schemas.ts` の以下が他で使われていなければ削除を検討:

- `projectorEventSchema`, `sessionEventSchema` — room polling のメッセージとして payload 内で使うなら残す
- 判断: 既存の gacha router が直接 payload を構築しているので、型安全性のために残しても良い

**Step 5: 最終 Commit**

もし修正があれば:

```bash
git add -A
git commit -m "chore: final cleanup after polling migration"
```
