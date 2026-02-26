# Mobile Auth Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mobile アプリの `/u/$userId` 配下の全ページで認証チェックし、未認証時は 404、チェック中はローディング UI を表示する。

**Architecture:** TanStack Router の `beforeLoad` で vanilla fetch による `users.me` 呼び出し。認証失敗時は `notFound()` を throw し、子ルートのレンダリングを完全にブロック。`pendingComponent` でローディング UI を表示。

**Tech Stack:** TanStack Router (`beforeLoad`, `pendingComponent`, `notFound`), vanilla fetch (tRPC batch format), CSS Modules

---

### Task 1: LoadingScreen コンポーネント作成

**Files:**

- Create: `apps/mobile/src/components/LoadingScreen.tsx`
- Create: `apps/mobile/src/components/LoadingScreen.module.css`

**Step 1: LoadingScreen コンポーネントを作成**

```tsx
// apps/mobile/src/components/LoadingScreen.tsx
import { uiImages } from "../assets/images";
import styles from "./LoadingScreen.module.css";

export const LoadingScreen = () => (
  <div className={styles.container}>
    <div className={styles.content}>
      <img src={uiImages.logo} alt="こらぼりずむ" className={styles.logo} />
      <div className={styles.spinner} />
    </div>
  </div>
);
```

```css
/* apps/mobile/src/components/LoadingScreen.module.css */
.container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-pink);
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
  z-index: 200;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.logo {
  width: min(60vw, 240px);
  height: auto;
  animation: float 2s ease-in-out infinite;
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid rgba(255, 255, 255, 0.4);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
```

**Step 2: ビルド確認**

Run: `cd apps/mobile && bunx tsc --noEmit`
Expected: エラーなし

**Step 3: Commit**

```bash
git add apps/mobile/src/components/LoadingScreen.tsx apps/mobile/src/components/LoadingScreen.module.css
git commit -m "feat(mobile): add LoadingScreen component for auth guard"
```

---

### Task 2: `/u/$userId` ルートに beforeLoad 認証ガードを追加

**Files:**

- Modify: `apps/mobile/src/routes/u/$userId.tsx`

**背景知識:**

- `beforeLoad` は TRPCProvider の外で実行される（`__root.tsx` で TRPCProvider がラップされているが、`beforeLoad` は React レンダリング前に実行される）
- そのため tRPC React hooks は使えない → vanilla fetch で tRPC の batch endpoint を直接叩く
- tRPC の batch format: `GET /trpc/users.me` にヘッダー `X-User-Id`, `X-User-Token` を付与
- 現在 component 内でやっている `?token=` の localStorage 保存も `beforeLoad` に移動する

**Step 1: $userId.tsx を書き換え**

```tsx
// apps/mobile/src/routes/u/$userId.tsx
import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { LoadingScreen } from "../../components/LoadingScreen";

const API_URL = import.meta.env.VITE_API_URL || "/trpc";

const searchSchema = z.object({
  token: z.string().optional(),
});

const verifyAuth = async (userId: string): Promise<void> => {
  const userToken = localStorage.getItem("userToken");
  if (!userToken) {
    throw notFound();
  }

  const res = await fetch(`${API_URL}/users.me`, {
    headers: {
      "X-User-Id": userId,
      "X-User-Token": userToken,
    },
  });

  if (!res.ok) {
    throw notFound();
  }
};

const UserLayout = () => {
  return <Outlet />;
};

export const Route = createFileRoute("/u/$userId")({
  validateSearch: searchSchema,
  beforeLoad: async ({ params, search }) => {
    // URL の ?token= パラメータを localStorage に保存
    if (search.token) {
      localStorage.setItem("userToken", search.token);
    }
    localStorage.setItem("userId", params.userId);

    await verifyAuth(params.userId);
  },
  pendingComponent: LoadingScreen,
  component: UserLayout,
});
```

**ポイント:**

- `beforeLoad` で token の localStorage 保存を行う（component から移動）
- `verifyAuth` が失敗したら `notFound()` を throw → 子ルートは一切レンダリングされない
- `pendingComponent: LoadingScreen` で `beforeLoad` 実行中のローディング表示
- UserLayout は単純に `<Outlet />` を返すだけに（localStorage 処理は beforeLoad に移動済み）

**Step 2: ビルド確認**

Run: `cd apps/mobile && bunx tsc --noEmit`
Expected: エラーなし

**Step 3: 動作確認**

1. `bun run dev` で起動
2. localStorage をクリアして `/u/test-user` にアクセス → 404 表示を確認
3. 正規の NFC ログインフローで `/u/{userId}?token={token}` にアクセス → ローディング後にホーム画面表示を確認

**Step 4: Commit**

```bash
git add apps/mobile/src/routes/u/\$userId.tsx
git commit -m "feat(mobile): add auth guard with beforeLoad on /u/$userId route"
```
