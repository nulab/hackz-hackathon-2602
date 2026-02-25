# User Token Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** カード QR コードの `?token=<uuid>` でユーザーページへのアクセスを制限する

**Architecture:** Users テーブルに `token` (UUID v4) フィールドを追加。フロントエンドは URL の `?token=` を `X-User-Token` ヘッダーとして全 tRPC リクエストに付与。サーバー側 `protectedProcedure` middleware で userId + token のペアを検証し、不一致なら FORBIDDEN を返す。

**Tech Stack:** tRPC middleware, DynamoDB (Users table), Zod, TanStack Router (search params), `crypto.randomUUID()`

---

### Task 1: shared スキーマに token フィールドを追加

**Files:**

- Modify: `packages/shared/src/schemas.ts:19-26`

**Step 1: userSchema に token を追加**

```typescript
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  token: z.string(),
  photoUrl: z.string().optional(),
  equippedBuildId: z.string().optional(),
  totalScore: z.number().default(0),
  createdAt: z.string(),
});
```

**Step 2: ビルドが通ることを確認**

Run: `bun run build`
Expected: SUCCESS (auth.ts の nfcLogin output が userSchema を使っているのでレスポンスに token が必要になるが、Task 4 で対応)

**Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat: add token field to userSchema"
```

---

### Task 2: User 型と UserRepository に token を追加

**Files:**

- Modify: `packages/server/src/repositories/types.ts:8-16`
- Modify: `packages/server/src/repositories/dynamodb/user-repository.ts`

**Step 1: User 型に token を追加**

`packages/server/src/repositories/types.ts` の User 型:

```typescript
export type User = {
  id: string;
  nfcId: string;
  name: string;
  token: string;
  photoUrl?: string;
  equippedBuildId?: string;
  totalScore: number;
  createdAt: string;
};
```

**Step 2: DynamoDB user-repository の update に token を含める**

`packages/server/src/repositories/dynamodb/user-repository.ts` の update メソッドの UpdateExpression に token を追加:

```typescript
UpdateExpression:
  "SET #name = :name, #token = :token, photoUrl = :photoUrl, equippedBuildId = :equippedBuildId, totalScore = :totalScore, version = :nextVersion",
ExpressionAttributeNames: { "#name": "name", "#token": "token" },
ExpressionAttributeValues: {
  ":name": user.name,
  ":token": user.token,
  ":photoUrl": user.photoUrl ?? null,
  ":equippedBuildId": user.equippedBuildId ?? null,
  ":totalScore": user.totalScore,
  ":currentVersion": user.version,
  ":nextVersion": nextVersion,
},
```

**Step 3: Commit**

```bash
git add packages/server/src/repositories/types.ts packages/server/src/repositories/dynamodb/user-repository.ts
git commit -m "feat: add token field to User type and repository"
```

---

### Task 3: tRPC context に userToken を追加

**Files:**

- Modify: `packages/server/src/trpc/context.ts`

**Step 1: X-User-Token ヘッダーを抽出して context に追加**

```typescript
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyToken } from "../lib/jwt";

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const authorization = req.headers.get("Authorization");
  const userToken = req.headers.get("X-User-Token");
  let userId: string | null = null;

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    userId = payload?.sub ?? null;
  }

  return { userId, userToken };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
```

**Step 2: Commit**

```bash
git add packages/server/src/trpc/context.ts
git commit -m "feat: extract X-User-Token header into tRPC context"
```

---

### Task 4: protectedProcedure middleware に token 検証を追加

**Files:**

- Modify: `packages/server/src/trpc/trpc.ts`

**Step 1: middleware に DB 検証を追加**

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { createDynamoDBUserRepository } from "../repositories/dynamodb/user-repository";

const t = initTRPC.context<Context>().create();

const userRepository = createDynamoDBUserRepository();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  if (!ctx.userToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "User token required" });
  }

  const user = await userRepository.findById(ctx.userId);
  if (!user || user.token !== ctx.userToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid user token" });
  }

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const protectedProcedure = publicProcedure.use(isAuthed);
```

**Step 2: Commit**

```bash
git add packages/server/src/trpc/trpc.ts
git commit -m "feat: add token verification to protectedProcedure middleware"
```

---

### Task 5: auth router で token を生成して返す

**Files:**

- Modify: `packages/server/src/trpc/routers/auth.ts`

**Step 1: nfcLogin で UUID token を生成**

```typescript
import { nfcLoginInputSchema, userSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { signToken } from "../../lib/jwt";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";

const userRepository = createDynamoDBUserRepository();

export const authRouter = router({
  nfcLogin: publicProcedure
    .input(nfcLoginInputSchema)
    .output(z.object({ token: z.string(), user: userSchema }))
    .mutation(async ({ input }) => {
      const { nfcId } = input;

      // Look up existing user by NFC ID
      let user = await userRepository.findByNfcId(nfcId);

      if (!user) {
        // Create new user with UUID token
        const userId = crypto.randomUUID();
        user = await userRepository.create({
          id: userId,
          nfcId,
          name: `User-${userId.slice(0, 6)}`,
          token: crypto.randomUUID(),
          totalScore: 0,
          createdAt: new Date().toISOString(),
        });
      }

      const jwtToken = await signToken(user.id);

      return {
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          token: user.token,
          photoUrl: user.photoUrl,
          equippedBuildId: user.equippedBuildId,
          totalScore: user.totalScore,
          createdAt: user.createdAt,
        },
      };
    }),
});
```

**Step 2: Commit**

```bash
git add packages/server/src/trpc/routers/auth.ts
git commit -m "feat: generate UUID token on user creation in nfcLogin"
```

---

### Task 6: mobile フロントエンドで token を URL から取得してヘッダーに付与

**Files:**

- Modify: `apps/mobile/src/routes/u/$userId.tsx`
- Modify: `apps/mobile/src/lib/trpc-provider.tsx`

**Step 1: /u/$userId ルートで ?token= を localStorage に保存**

`apps/mobile/src/routes/u/$userId.tsx`:

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/u/$userId")({
  validateSearch: searchSchema,
  component: UserLayout,
});

function UserLayout() {
  const { token } = Route.useSearch();

  if (token) {
    localStorage.setItem("userToken", token);
  }

  return <Outlet />;
}
```

**Step 2: trpc-provider に X-User-Token ヘッダーを追加**

`apps/mobile/src/lib/trpc-provider.tsx` の `getAuthHeaders`:

```typescript
const getAuthHeaders = () => {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const userToken = localStorage.getItem("userToken");
  if (userToken) {
    headers["X-User-Token"] = userToken;
  }
  return headers;
};
```

SSE subscription にもヘッダーを渡す:

```typescript
unstable_httpSubscriptionLink({
  url: API_URL,
  headers: getAuthHeaders,
}),
```

**Step 3: Commit**

```bash
git add apps/mobile/src/routes/u/\$userId.tsx apps/mobile/src/lib/trpc-provider.tsx
git commit -m "feat: extract token from URL and send as X-User-Token header"
```

---

### Task 7: ビルド & 動作確認

**Step 1: lint & format**

Run: `bun run lint:fix && bun run format:fix`

**Step 2: ビルド確認**

Run: `bun run build`
Expected: SUCCESS

**Step 3: テスト実行**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit (if lint/format changes)**

```bash
git add -u
git commit -m "chore: lint and format fixes"
```
