# User Token Verification Design

## Goal

カードに印刷された QR コードからのみユーザーページにアクセスできるようにする。
URL の `?token=<uuid>` をサーバー側で検証し、不正アクセスを防ぐ。

## Data Model

Users テーブルに `token` (UUID v4) フィールドを追加。別テーブルは作らない（1:1 関係）。

```
Users テーブル
PK: id
- nfcId, name, token (NEW), photoUrl?, equippedBuildId?, totalScore, createdAt, version
```

- ユーザー作成時に `crypto.randomUUID()` で生成
- 1ユーザー1トークン、固定

## Flow

```
QRコード → /u/$userId?token=<uuid>
  → mobile が URL から token 取得 → localStorage に保存
  → tRPC リクエストに X-User-Token ヘッダー付与
  → protectedProcedure middleware で userId + token 検証
  → 不一致 → FORBIDDEN (403)
```

## Approach: Custom Header (A)

token はカスタムヘッダー `X-User-Token` で送信する。各 router の input 変更不要。

## Server Changes

1. **`shared/schemas.ts`**: `userSchema` に `token: z.string()` 追加
2. **Repository `User` 型**: `token: string` 追加
3. **`createContext`**: `X-User-Token` ヘッダーを `ctx.userToken` に格納
4. **`protectedProcedure` middleware**: DB から User 取得 → `user.token === ctx.userToken` 検証 → 不一致で `FORBIDDEN`
5. **auth router (`nfcLogin`)**: ユーザー作成時に `crypto.randomUUID()` で token 生成、レスポンスに含める

## Frontend Changes (mobile)

1. **`/u/$userId` ルート**: `?token=` search param を取得 → localStorage に保存
2. **`trpc-provider.tsx`**: `getAuthHeaders()` に `X-User-Token` ヘッダー追加
3. **`httpSubscriptionLink`**: 同じヘッダーを渡す

## Security

- UUID v4 (122-bit entropy) → brute force infeasible
- JWT + token 二重チェック
- QR コードリンクを知らない人はアクセス不可
