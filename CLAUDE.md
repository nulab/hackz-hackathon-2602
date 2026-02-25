# Project Guidelines

## Runtime & Package Manager

**Bun** (1.3.9) を使用。npm/yarn/pnpm は使わない。

- `bun install` — 依存関係インストール
- `bun add <pkg>` / `bun add -d <pkg>` — パッケージ追加
- `bun remove <pkg>` — パッケージ削除
- `bun run <script>` — スクリプト実行
- `bunfig.toml` で `exact = true` が設定済み（バージョン固定）

## Monorepo Structure

Turbo でワークスペースを管理するモノレポ。

```
apps/
  admin/        — @hackz/admin   NFC管理画面 (React + Vite)
  mobile/       — @hackz/mobile  来場者スマホ画面 (React + Vite)
  projector/    — @hackz/projector  プロジェクター画面 (React + Vite)
packages/
  server/       — @hackz/server     Hono + tRPC バックエンド
  shared/       — @hackz/shared     Zod スキーマ・定数
  tsconfig/     — @hackz/tsconfig   共有 tsconfig (base/react/bun)
```

## Key Commands

| コマンド             | 説明                          |
| -------------------- | ----------------------------- |
| `bun run dev`        | 全アプリ並列起動 (Turbo)      |
| `bun run build`      | 全アプリビルド                |
| `bun run lint`       | oxlint でリント               |
| `bun run lint:fix`   | oxlint で自動修正             |
| `bun run format`     | oxfmt でフォーマットチェック  |
| `bun run format:fix` | oxfmt で自動フォーマット      |
| `bun run db:init`    | DynamoDB Local テーブル初期化 |
| `bun test`           | テスト実行                    |
| `bun test --watch`   | テスト watch モード           |

## Testing

Bun 組み込みテストランナーを使用。

- ファイル命名: `*.test.ts` / `*.test.tsx`
- 配置: ソースファイルと同階層、または `__tests__/` ディレクトリ

## Lint & Format

- **oxlint** (1.50.0) — リンター
- **oxfmt** (0.35.0) — フォーマッター
- **lefthook** — pre-commit フック (sort-package-json → oxlint --fix → oxfmt)

## API Architecture

**tRPC** で End-to-End 型安全な API を構築。Zod スキーマが型の Single Source of Truth。

### スキーマ定義

`packages/shared/src/schemas.ts` に全 Zod スキーマを定義。型は `z.infer<>` で導出。

- Domain models: `userSchema`, `costumeSchema`, `userCostumeSchema`, `costumeBuildSchema`, `sessionSchema` 等
- Procedure inputs: `nfcLoginInputSchema`, `equipBuildInputSchema`, `createBuildInputSchema`, `updateBuildInputSchema` 等
- SSE event types: `projectorEventSchema`, `sessionEventSchema`

### tRPC Router 構成

`packages/server/src/trpc/` に配置:

- `trpc.ts` — initTRPC, `publicProcedure`, `protectedProcedure`（JWT 認証 middleware）
- `context.ts` — リクエストから JWT トークンを解析しコンテキストに userId を設定
- `ee.ts` — EventEmitter ベースのリアルタイムイベント配信（Socket.IO rooms の代替）
- `routers/_app.ts` — `AppRouter` 型を export（フロントエンドの型推論に使用）
- `routers/auth.ts` — NFC ログイン
- `routers/users.ts` — ユーザー情報取得・写真アップロード
- `routers/gacha.ts` — ガチャ（結果を projector に broadcast）
- `routers/costumes.ts` — コスチューム一覧・装備
- `routers/sessions.ts` — セッション作成・取得
- `routers/synthesis.ts` — 合成開始・ステータス確認
- `routers/subscriptions.ts` — SSE サブスクリプション + NFC スキャン mutation

### リアルタイム通信

Socket.IO の代わりに tRPC SSE subscriptions を使用:

- `sub.onProjector` — プロジェクター向けイベント（NFC スキャン結果、ガチャ結果）
- `sub.onSession` — セッション単位の更新（ステータス変更、合成完了）
- `sub.nfcScan` — NFC スキャン報告（admin → projector へ broadcast）

### フロントエンド tRPC クライアント

各アプリに共通パターン:

- `src/lib/trpc.ts` — `createTRPCReact<AppRouter>()` でクライアント作成
- `src/lib/trpc-provider.tsx` — QueryClient + tRPC Provider
  - `httpBatchLink` で query/mutation
  - `httpSubscriptionLink` で SSE subscription
- `src/routes/__root.tsx` で `<TRPCProvider>` ラップ

## Server

- フレームワーク: **Hono** (`packages/server/src/index.ts`)
- API: **tRPC** (`/trpc/*` にマウント、`@hono/trpc-server` アダプタ)
- 認証: JWT (jose, HS256, 24h 有効期限) — tRPC middleware で自動検証
- ミドルウェア: `src/middleware/cors.ts`
- ドメイン層: `src/domain/` — ビジネスロジック（純粋関数、インフラ非依存）
- リポジトリ層: `src/repositories/` — データアクセス抽象化 + DynamoDB 実装（楽観的ロック付き）
- サービス: `src/services/` (dynamodb, s3, bedrock)
- ローカル開発時: `DYNAMODB_ENDPOINT` 設定時に `.local/uploads/` でファイル配信

### Server Architecture Rules

- tRPC ルーターにビジネスロジックを書かない → `domain/` に純粋関数として配置
- 入力バリデーションは tRPC の `.input()` + Zod スキーマ（`packages/shared/src/schemas.ts`）で実施
- DynamoDB 更新は `version` フィールドによる楽観的ロック必須（`OptimisticLockError`）
- SSE subscription で送信するデータは受信者に応じてフィルタリング（不要な内部情報を含めない）

## Environment Variables (Server)

| 変数                    | 説明                    | ローカル開発時の値      |
| ----------------------- | ----------------------- | ----------------------- |
| `DYNAMODB_ENDPOINT`     | DynamoDB エンドポイント | `http://localhost:8787` |
| `AWS_REGION`            | AWS リージョン          | `ap-northeast-1`        |
| `AWS_ACCESS_KEY_ID`     | AWS アクセスキー        | `local`                 |
| `AWS_SECRET_ACCESS_KEY` | AWS シークレットキー    | `local`                 |
| `S3_BUCKET`             | S3 バケット名           | `hackz-nulab-26`        |
| `JWT_SECRET`            | JWT 署名キー            | 任意の文字列            |
| `PORT`                  | サーバーポート          | `3000`                  |

## DynamoDB Tables

| テーブル      | PK     | SK        | GSI                               |
| ------------- | ------ | --------- | --------------------------------- |
| Users         | id     | —         | nfcId-index (nfcId)               |
| Costumes      | id     | —         | rarity-index (rarity)             |
| UserCostumes  | userId | costumeId | —                                 |
| CostumeBuilds | userId | buildId   | —                                 |
| Sessions      | id     | —         | userId-index (userId + createdAt) |

`docker compose up -d` で DynamoDB Local を起動（ポート 8787）し、`bun run db:init` でテーブル作成。

## Frontend Apps

3 アプリとも同一構成: React 19 + Vite + TanStack Router + Tailwind CSS 4 + tRPC。

- tsconfig は `@hackz/tsconfig/react.json` を継承
- API 呼び出しは tRPC React hooks (`trpc.xxx.useQuery()`, `trpc.xxx.useMutation()`)
- リアルタイム通信は `trpc.sub.onProjector.useSubscription()` 等

## CI

GitHub Actions (`.github/workflows/ci.yml`) で push / PR 時に実行:
`bun install` → `bun run lint` → `bun run format` → `bun run build` → `bun test`
