# ============================================================
# Hono + tRPC サーバー (App Runner 用)
# Bun ランタイム、モノレポのワークスペース依存を解決
# ============================================================

FROM oven/bun:1.3.9-slim AS deps

WORKDIR /app

# ワークスペース設定と依存関係のマニフェストをコピー
COPY bun.lockb bunfig.toml turbo.json ./
COPY package.json ./
COPY packages/server/package.json  ./packages/server/
COPY packages/shared/package.json  ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# 本番依存のみインストール（devDependencies を除外）
RUN bun install --frozen-lockfile --production

# ============================================================
FROM oven/bun:1.3.9-slim AS runner

WORKDIR /app

# インストール済み依存をコピー
COPY --from=deps /app/node_modules ./node_modules

# サーバー実行に必要なソースコードをコピー
COPY packages/server  ./packages/server
COPY packages/shared  ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY package.json bunfig.toml ./

EXPOSE 3000

# Bun は TypeScript をそのまま実行できるためビルド不要
CMD ["bun", "run", "packages/server/src/index.ts"]
