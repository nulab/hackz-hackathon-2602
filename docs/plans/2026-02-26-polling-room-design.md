# Polling Room Design — PeerJS / SSE subscription 全廃 + polling 化

## 概要

CloudFront + ECS + Bun 構成で SSE / WebSocket の制約を回避するため、
PeerJS（WebRTC シグナリング）と tRPC SSE subscription を全廃し、
インメモリ Room + tRPC polling に統一する。

## 前提

- ECS タスク数: 1（インメモリで問題なし）
- サーバー発行のランダム UUID を roomId とし、推測不可能にする
- polling 間隔 1〜3 秒で十分（遅延許容）

## データ構造

```ts
type Room = {
  id: string; // crypto.randomUUID()
  createdAt: number;
  lastActivity: number;
  adminConnected: boolean;
  adminLastSeen: number;
  projectorLastSeen: number;
  upstream: Message[]; // Admin → Projector
  downstream: Message[]; // Projector → Admin
  projector: Message[]; // broadcast（ガチャ結果等）
  sessions: Map<string, Message[]>; // sessionId → messages
  nextMessageId: number;
};

type Message = {
  id: number;
  type: string;
  payload: unknown;
  createdAt: number;
};
```

各チャネルに連番 id を振り、クライアントは afterId カーソルで差分取得。

## tRPC API（`room` router）

| Procedure         | 種別     | 入力                            | 出力                              | 説明                   |
| ----------------- | -------- | ------------------------------- | --------------------------------- | ---------------------- |
| `room.create`     | mutation | —                               | `{ roomId }`                      | Projector がルーム作成 |
| `room.join`       | mutation | `{ roomId }`                    | `{ ok }`                          | Admin がルーム参加     |
| `room.send`       | mutation | `{ roomId, channel, message }`  | `{ messageId }`                   | メッセージ送信         |
| `room.poll`       | query    | `{ roomId, channel, afterId? }` | `{ messages[], lastId }`          | メッセージ取得         |
| `room.heartbeat`  | mutation | `{ roomId, role }`              | `{ peerConnected, peerLastSeen }` | 死活監視               |
| `room.disconnect` | mutation | `{ roomId, role }`              | `{ ok }`                          | 明示的切断             |

### Broadcast 連携

- `gacha.pull` → `roomStore.broadcast("projector", message)`（全ルームに配信）
- `synthesis` 完了 → `roomStore.sendToSession(sessionId, message)`

## クライアント polling パターン

```ts
usePolling(roomId, channel, intervalMs, onMessages);
// TanStack Query の useQuery + refetchInterval
// afterId をステートで保持し差分取得
```

| アプリ    | チャネル     | 間隔 | 用途                |
| --------- | ------------ | ---- | ------------------- |
| Projector | upstream     | 1s   | NFC/QR スキャン受信 |
| Projector | projector    | 2s   | ガチャ結果受信      |
| Admin     | downstream   | 1s   | スキャン結果受信    |
| Mobile    | session:{id} | 3s   | 合成進捗            |

### Heartbeat

5 秒間隔で `room.heartbeat` を呼び出し。返り値で相手の接続状態を判定。

### ペアリングフロー

1. Projector: `room.create()` → roomId 取得 → QR コード表示
2. Admin: QR スキャン → `room.join({ roomId })` → polling 開始
3. Projector: heartbeat で Admin 接続を検知

## Room ライフサイクル

- TTL: lastActivity から 30 分で自動削除
- クリーンアップ: `setInterval(60_000)` で期限切れチェック
- 明示的切断: 両方切断済みなら即削除
- メッセージ上限: 各チャネル 100 件（古いものから破棄）

## 削除対象

### パッケージ

- `peerjs`（projector, admin）
- `peer`（server）
- `qrcode.react` は残す（QR 表示は継続）

### ファイル

- `packages/server/src/index.ts` — ExpressPeerServer 削除、`createAdaptorServer` → Bun.serve 等に簡略化可能
- `packages/server/src/trpc/routers/subscriptions.ts` — 削除（room router に置換）
- `packages/server/src/trpc/ee.ts` — 削除（roomStore に置換）
- `packages/shared/src/peer-config.ts` — 削除
- `packages/shared/src/webrtc-protocol.ts` — 削除（room メッセージ型に置換）
- `apps/projector/src/webrtc/` — ディレクトリ削除
- `apps/admin/src/webrtc/` — ディレクトリ削除

### Terraform

- `terraform/cloudfront.tf` — `/peerjs/*` ordered_cache_behavior 削除
- `terraform/alb.tf` — `idle_timeout` をデフォルト(60)に戻す（任意）

## 置き換えマッピング

| 旧                                   | 新                                    |
| ------------------------------------ | ------------------------------------- |
| `ProjectorConnection.open()`         | `room.create` + polling 開始          |
| `AdminConnection.connect(peerId)`    | `room.join` + polling 開始            |
| `conn.send({ type: "NFC_SCANNED" })` | `room.send({ channel: "upstream" })`  |
| `conn.on("data", handler)`           | `usePolling(roomId, channel)`         |
| `emitProjectorEvent(...)`            | `roomStore.broadcast("projector")`    |
| `ee.on("projector", ...)` + SSE      | `room.poll({ channel: "projector" })` |
| PING/PONG                            | `room.heartbeat`                      |
| `getPeerServerConfig()`              | 不要                                  |
