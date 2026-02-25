---
name: server-architecture
description: Use when adding or modifying server-side code (routes, services, socket handlers, DynamoDB operations) to ensure adherence to architecture patterns
---

# Server Architecture Patterns

## Overview

サーバー (`packages/server/`) は以下のレイヤー構成に従う。ルートハンドラにビジネスロジックを直接書かず、ドメイン層・リポジトリ層に分離してテスタビリティとインフラ独立性を確保する。

## レイヤー構成

```
routes/          ← HTTP ルートハンドラ（バリデーション + レスポンス整形のみ）
socket/          ← Socket.IO イベントハンドラ（認証 + ルーム管理）
domain/          ← ビジネスロジック（純粋関数、インフラ非依存）
repositories/    ← データアクセス抽象化（インターフェース + DynamoDB 実装）
validators/      ← Zod スキーマによるリクエストバリデーション
services/        ← AWS SDK クライアント初期化（DynamoDB, S3, Bedrock）
middleware/      ← Hono ミドルウェア（CORS, JWT 認証）
lib/             ← ユーティリティ（JWT 署名/検証）
```

## 原則

### 1. ビジネスロジックはドメイン層に置く

ルートハンドラにロジックを書かない。`domain/` 配下に純粋関数として定義し、テスト可能にする。

<Good>
```typescript
// domain/gacha.ts — 純粋関数、テスト容易
export const pullGacha = (random: number = Math.random()): GachaResult => { ... };

// routes/gacha.ts — ドメインを呼ぶだけ
const { rarity } = pullGacha();

````
</Good>

<Bad>
```typescript
// routes/gacha.ts — ロジック埋め込み、テスト困難
gachaRoutes.post("/pull", async (c) => {
  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(GACHA_RATES)) { ... }
});
````

</Bad>

### 2. リポジトリパターンでデータアクセスを抽象化する

`repositories/types.ts` にインターフェースを定義し、`repositories/dynamodb/` に DynamoDB 実装を置く。テスト時にインメモリ実装に差し替え可能。

### 3. 楽観的ロック（Optimistic Locking）で並行制御

全エンティティに `version` フィールドを持たせ、更新時に `ConditionExpression` で検証する。競合時は `OptimisticLockError` を投げる。

```typescript
// 更新時: version が一致しなければ例外
UpdateCommand({
  ConditionExpression: "version = :currentVersion",
  ExpressionAttributeValues: {
    ":currentVersion": entity.version,
    ":nextVersion": entity.version + 1,
  },
});
```

### 4. リクエストボディは Zod でバリデーション

型アサーション (`c.req.json<T>()`) ではなく、Zod スキーマ + `@hono/zod-validator` で実行時に検証する。

```typescript
import { zValidator } from "@hono/zod-validator";
import { nfcLoginSchema } from "../validators/schemas";

authRoutes.post("/nfc-login", zValidator("json", nfcLoginSchema), async (c) => {
  const { nfcId } = c.req.valid("json"); // 型安全かつ実行時検証済み
});
```

### 5. Socket.IO は認証必須 + ロールベースのルーム制御

- 接続時に `handshake.auth.token` で JWT 認証
- `socket.data` にユーザーID・ロールを保持
- ルーム参加時にロール検証（admin のみ ADMIN ルーム等）
- 特権操作（NFC スキャン送信等）はロールチェック必須

### 6. Socket.IO で送信するデータは受信者に応じてフィルタリング

全クライアントに同じデータをブロードキャストしない。ユーザーに見せるべきでない情報（他ユーザーの内部状態等）はマスクまたは除外する。

## チェックリスト（新規コード追加時）

- [ ] ビジネスロジックは `domain/` に配置されているか
- [ ] ドメイン関数は純粋関数でインフラ非依存か
- [ ] ドメイン関数のテストが書かれているか
- [ ] リクエストボディに Zod バリデーションが適用されているか
- [ ] DynamoDB 更新に楽観的ロック（version チェック）が含まれているか
- [ ] Socket イベントにロールチェックが適用されているか
- [ ] Socket で送信するデータに不要な情報が含まれていないか
