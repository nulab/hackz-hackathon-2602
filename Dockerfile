# ============================================================
# Hono + tRPC サーバー (App Runner 用)
# Bun ランタイム、モノレポのワークスペース依存を解決
# ============================================================

FROM oven/bun:1.3.9-slim AS deps

WORKDIR /app

# ワークスペース設定と依存関係のマニフェストをコピー
COPY bun.lock bunfig.toml turbo.json ./
COPY package.json ./
COPY packages/server/package.json  ./packages/server/
COPY packages/shared/package.json  ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# 依存関係をインストール（lefthook 等の lifecycle script をスキップ）
RUN bun install --ignore-scripts

# ============================================================
FROM oven/bun:1.3.9-slim AS runner

WORKDIR /app

# サーバー実行に必要なソースコードをコピー
COPY packages/server  ./packages/server
COPY packages/shared  ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY package.json bunfig.toml ./

# インストール済み依存をコピー（root + ワークスペース）
# ソースコードの後にコピーすることで .dockerignore で除外した
# ホストの node_modules ではなく deps stage の正しい依存を使用
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

EXPOSE 3000

# Bun は TypeScript をそのまま実行できるためビルド不要
CMD ["bun", "run", "packages/server/src/index.ts"]
