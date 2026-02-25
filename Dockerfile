# ============================================================
# Hono + tRPC サーバー (ECS Fargate 用)
# Node.js ランタイム + tsx（WebSocket の ws パッケージ互換性のため）
# deps stage は Bun で高速インストール、runner は Node.js で実行
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
FROM node:22-slim AS runner

WORKDIR /app

# サーバー実行に必要なソースコードをコピー
COPY packages/server  ./packages/server
COPY packages/shared  ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY package.json bunfig.toml ./

# インストール済み依存をコピー（root + ワークスペース）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# tsx で TypeScript を直接実行
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "packages/server/src/index.ts"]
