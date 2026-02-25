# WebRTC Admin-Projector 連携設計

## 概要

Admin 端末（NFC/QR 読み取り専用）と Projector 端末（処理・表示担当）を WebRTC DataChannel で P2P 接続する。Admin は認証不要の「センサー」として動作し、Projector が認証済みの「頭脳」としてサーバーとの通信・ビジネスロジック実行を担う。

## 設計原則

- **Admin は認証不要** — 読み取ったデータ（NFC ID / QR テキスト）を Projector に送るだけ
- **Projector が主導権を持つ** — WebRTC の offer 側、接続管理、Admin の切断制御
- **シグナリングは既存 tRPC インフラを流用** — SSE subscription + mutation で SDP/ICE 交換。WebSocket 追加不要
- **WebRTC はブラウザネイティブ API** — RTCPeerConnection + DataChannel を直接使用。外部ライブラリなし
- **1:1 接続** — Projector 1 台に対し Admin 1 台のみ。2 台目以降は Reject

## 接続確立フロー

```
Projector                     Server                      Admin
  |                             |                           |
  | 1. createRoom() ---------->|                           |
  |<-- { roomId: "abc123" }    |                           |
  |                             |                           |
  | 2. QRコード表示              |                           |
  |    (roomId埋め込み)          |                           |
  |                             |                           |
  | 3. onSignalForProjector     |                           |
  |    subscribe -------------->|                           |
  |                             |                           |
  |                             |    4. QRスキャン → roomId  |
  |                             |<--- joinRoom("abc123") ---|
  |                             |                           |
  |                             |    5. onSignalForAdmin     |
  |                             |<--- subscribe ------------|
  |                             |                           |
  |<-- SSE: { type: "joined" } |                           |
  |                             |                           |
  | 6. new RTCPeerConnection    |                           |
  |    createDataChannel        |                           |
  |    createOffer()            |                           |
  |                             |                           |
  | 7. sendSignal(offer) ------>|                           |
  |                             |--- SSE: offer ----------->|
  |                             |                           |
  |                             |    8. new RTCPeerConnection
  |                             |       setRemoteDescription
  |                             |       createAnswer()
  |                             |                           |
  |                             |<--- sendSignal(answer) ---|
  |<-- SSE: answer ------------|                           |
  |    setRemoteDescription     |                           |
  |                             |                           |
  | 9. [ICE candidates 双方向交換]                           |
  |                             |                           |
  | 10. DataChannel open ============================== open|
  |                             |                           |
  | 11. SSE unsubscribe ------>|<--- SSE unsubscribe ------|
  |                             |                           |
  |=============== P2P 通信開始 ============================|
```

## スキャン処理フロー（DataChannel 経由）

```
Admin                          Projector                    Server
  |                              |                            |
  | NFC タッチ                    |                            |
  |-- { type: "NFC_SCANNED",    |                            |
  |    nfcId: "xxx" } --------->|                            |
  |                              |                            |
  |                              | tRPC でユーザー検索          |
  |                              |-- auth.nfcLogin() -------->|
  |                              |<-- { user, token } --------|
  |                              |                            |
  |                              | 結果を画面に表示             |
  |                              |                            |
  |<-- { type: "SCAN_RESULT",   |                            |
  |      success: true,          |                            |
  |      scanType: "nfc",        |                            |
  |      message: "田村さん" } --|                            |
  |                              |                            |
  | 成功表示                      |                            |
```

## DataChannel メッセージプロトコル

### Admin → Projector（Upstream）

| type          | payload         | 説明              |
| ------------- | --------------- | ----------------- |
| `NFC_SCANNED` | `nfcId: string` | NFC ID 読み取り   |
| `QR_SCANNED`  | `data: string`  | QR コード読み取り |
| `PONG`        | —               | ハートビート応答  |

### Projector → Admin（Downstream）

| type          | payload                                                       | 説明             |
| ------------- | ------------------------------------------------------------- | ---------------- |
| `SCAN_RESULT` | `success: boolean, scanType: "nfc" \| "qr", message?: string` | スキャン処理結果 |
| `PING`        | —                                                             | ハートビート     |
| `DISCONNECT`  | `reason: string`                                              | 意図的な切断通知 |

シリアライズ形式: JSON 文字列。Zod スキーマで送受信時にバリデーション。

## シグナリング層（tRPC ルーター）

### `routers/signaling.ts`

| Procedure              | 種別         | 認証 | 説明                                             |
| ---------------------- | ------------ | ---- | ------------------------------------------------ |
| `createRoom`           | mutation     | 必要 | ルーム作成、roomId 返却                          |
| `joinRoom`             | mutation     | 不要 | ルームに参加（1:1 チェック、2台目 Reject）       |
| `sendSignal`           | mutation     | 不要 | SDP offer/answer/ICE candidate 送信              |
| `closeRoom`            | mutation     | 必要 | ルーム閉鎖、Admin に切断通知                     |
| `onSignalForProjector` | subscription | 必要 | Projector 向け SSE（joinRoom 通知、answer、ICE） |
| `onSignalForAdmin`     | subscription | 不要 | Admin 向け SSE（offer、ICE、close 通知）         |

### ルーム管理（インメモリ）

```typescript
// packages/server/src/trpc/rooms.ts
Map<
  string,
  {
    roomId: string;
    createdBy: string; // userId
    adminConnected: boolean;
    createdAt: number;
  }
>;
```

サーバー再起動でクリア。永続化不要（WebRTC 接続も同時に切れるため）。

### EventEmitter チャネル

```
signal:${roomId}:projector  // Admin → Projector 向けイベント
signal:${roomId}:admin      // Projector → Admin 向けイベント
```

## WebRTC 接続管理

### ProjectorConnection クラス

```typescript
class ProjectorConnection {
  // ライフサイクル
  open(roomId: string); // SSE subscribe → joinRoom 待ち → offer 作成
  close(); // DataChannel + PC 閉じる、closeRoom 呼ぶ
  disconnectAdmin(); // DISCONNECT メッセージ送信 → PC リセット

  // 通信
  send(msg: DownstreamMessage);
  onMessage(handler): unsubscribe;

  // 状態監視
  onStateChange(handler): unsubscribe;
  // states: "waiting" | "connecting" | "connected" | "disconnected"

  // ハートビート
  startHeartbeat(); // 5秒間隔 PING、15秒タイムアウト
  stopHeartbeat();
}
```

### AdminConnection クラス

```typescript
class AdminConnection {
  // ライフサイクル
  connect(roomId: string); // joinRoom → SSE subscribe → offer 待ち → answer
  disconnect();

  // 通信
  send(msg: UpstreamMessage);
  onMessage(handler): unsubscribe;

  // 状態監視
  onStateChange(handler): unsubscribe;
  // states: "disconnected" | "connecting" | "connected" | "reconnecting"

  // 再接続
  reconnect(); // 指数バックオフ 1s→2s→4s→8s→10s、最大5回
  // DISCONNECT 受信時は再接続しない
}
```

### RTCPeerConnection 設定

```typescript
const config: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};
```

## ファイル構成

### 新規ファイル

```
packages/shared/src/
  webrtc-protocol.ts          # DataChannel メッセージ型 + Zod スキーマ
  signaling-schemas.ts        # シグナリング用 tRPC input/event スキーマ

packages/server/src/trpc/
  rooms.ts                    # ルーム管理（Map ベースインメモリストア）
  routers/signaling.ts        # シグナリング tRPC ルーター

apps/projector/src/webrtc/
  ProjectorConnection.ts      # Projector 側 WebRTC 接続管理
  useProjectorConnection.ts   # React hook

apps/admin/src/webrtc/
  AdminConnection.ts          # Admin 側 WebRTC 接続管理
  useAdminConnection.ts       # React hook
```

### 既存ファイルの変更

```
packages/server/src/trpc/routers/_app.ts   → signaling ルーター追加
packages/server/src/trpc/ee.ts             → signal:* イベント型追加
apps/projector/src/routes/index.tsx        → QR 表示 + 接続管理 + 切断ボタン
apps/admin/src/routes/index.tsx            → QR スキャン + スキャン結果表示
```

### 追加パッケージ

- `apps/admin/` — QR コードリーダーライブラリ（カメラで読み取り）
- `apps/projector/` — QR コード生成ライブラリ

### 変更しないもの

- `apps/mobile/` — WebRTC 無関係。従来通り tRPC 経由
- DynamoDB テーブル — ルーム情報は永続化しない
- 既存 SSE subscription（`onProjector`, `onSession`）— そのまま維持

## UI

### Projector

| 状態     | 表示                                                           |
| -------- | -------------------------------------------------------------- |
| 初期     | QR コード + 「Admin 端末で読み取ってください」                 |
| 接続中   | 「接続しています...」                                          |
| 接続済み | 通常画面 + 接続ステータスバッジ（緑●）+ 「Admin を切断」ボタン |
| 切断後   | QR コードに戻る（新しい roomId で再生成）                      |

### Admin

| 状態         | 表示                                                  |
| ------------ | ----------------------------------------------------- |
| 初期         | 「QR コードをスキャンしてください」+ カメラ起動ボタン |
| 接続中       | 「Projector に接続中...」                             |
| 接続済み     | NFC/QR スキャン待ち画面 + 接続ステータスバッジ        |
| スキャン結果 | 成功/失敗のフィードバック表示                         |
| 切断         | 自動再接続中 → 失敗で QR 再スキャン画面に戻る         |

## セキュリティモデル

- Admin は認証不要。WebRTC で Projector に生データを送るだけ
- Projector が認証済みで、サーバーへの全 API 呼び出しを担当
- 不正な Admin が接続しても、送れるのは NFC ID / QR テキストのみ
- Projector 側からいつでも Admin を切断可能
- 1:1 制限で意図しない端末の接続を防止
- シグナリングの `createRoom` / `closeRoom` は `protectedProcedure`（認証必須）
