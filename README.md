# Hackz Hackathon - Nulab Cup 2026

ハッカソン会場の展示ブースで、来場者が NFC カードをかざし、自撮り写真とガチャ衣装で「自分がアイドルになったダンス動画」を体験できるプロダクト。

## デバイス構成

```
[Android Device]      [User's Phone]       [Projector]
 NFC Scan + Admin  <-> Gacha + Photo UP <-> Dance Video
  (admin app)         (mobile app)        (projector app)
      |                    |                    |
                  [Server (Hono + Socket.IO)]
                  DynamoDB / S3 / Bedrock
```

## 技術スタック

| レイヤー        | 技術                                               |
| --------------- | -------------------------------------------------- |
| ランタイム      | Bun 1.3.9                                          |
| ビルド          | Turbo (monorepo)                                   |
| フロントエンド  | React 19 + Vite + TanStack Router + Tailwind CSS 4 |
| バックエンド    | Hono + Socket.IO                                   |
| DB / ストレージ | DynamoDB + S3                                      |
| AI              | AWS Bedrock                                        |
| API スキーマ    | TypeSpec → OpenAPI → openapi-typescript            |
| Lint / Format   | oxlint + oxfmt + lefthook                          |

## セットアップ

### 前提条件

- [Bun](https://bun.sh/) 1.3.9+
- [Docker](https://www.docker.com/)（ローカル DynamoDB 用）

### 手順

```sh
# 依存関係のインストール
bun install

# DynamoDB Local の起動
docker compose up -d

# テーブルの初期化
bun run db:init

# 全アプリを起動（Turbo で並列起動）
bun run dev
```

サーバーは `http://localhost:3000`、フロントエンドアプリは Vite の dev server で起動する。

### API クライアントの再生成

TypeSpec の定義を変更した場合:

```sh
bun run generate
```

## スクリプト一覧

| コマンド           | 説明                                            |
| ------------------ | ----------------------------------------------- |
| `bun run dev`      | 全アプリを並列で起動                            |
| `bun run build`    | 全アプリをビルド                                |
| `bun run generate` | TypeSpec → OpenAPI → API クライアント型を再生成 |
| `bun run lint`     | oxlint でリント                                 |
| `bun run format`   | oxfmt でフォーマットチェック                    |
| `bun run db:init`  | DynamoDB Local のテーブルを初期化               |
| `bun test`         | テストを実行                                    |

## モノレポ構成

```
apps/
  admin/       … NFC 読み取り・管理画面
  mobile/      … 来場者向けスマホ画面
  projector/   … プロジェクター投影画面
packages/
  server/      … Hono + Socket.IO バックエンド
  api-client/  … OpenAPI 自動生成クライアント
  shared/      … 共有型定義・Socket イベント・定数
  typespec/    … API スキーマ定義（TypeSpec）
  tsconfig/    … 共有 TypeScript 設定
```

## Claude Code

### Skills

> [!NOTE]
> プロジェクトの `.claude/skills` にインストールされたスキルは claude.ai/code でも利用できます。

- [obra/superpowers](https://github.com/obra/superpowers) - 複数の自律的なエージェントを指揮し、並列開発を行うスキル
- [claude-code/frontend-design](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design) - フロントエンドの設計と実装を支援するスキル

### Plugins

> [!WARNING]
> プラグインは claude.ai/code では利用できません。

- [commit-commands@claude-plugins-official](https://github.com/anthropics/claude-code/blob/main/plugins/commit-commands) - コードの変更をコミットするためのコマンドを提供するプラグイン
- [pr-review-toolkit@claude-plugins-official](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit) - プルリクエストのレビューを支援するためのツールキットを提供するプラグイン
