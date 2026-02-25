# NFC-QR Pairing Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** projector/pair ページで NFC カード ID と QR コード（userId + token）を受信し、「登録」ボタンで DB に User レコードを作成するペアリング機能を実装する。

**Architecture:** Admin が QR URL をパースして構造化データ `{ userId, token }` として送信 → Projector が最新の NFC/QR 値を保持 → 「登録」ボタンで server の `auth.registerPairing` mutation を呼び出し → DynamoDB に User レコード作成（nfcId/userId 重複チェック付き）。

**Tech Stack:** React, tRPC, Zod, DynamoDB, Bun test runner

---

### Task 1: Shared schema に registerPairingInputSchema を追加

**Files:**

- Modify: `packages/shared/src/schemas.ts`

**Step 1: スキーマ追加**

`packages/shared/src/schemas.ts` の `nfcScanInputSchema` の後に追加:

```typescript
export const registerPairingInputSchema = z.object({
  nfcId: z.string().min(1),
  userId: z.string().min(1),
  token: z.string().uuid(),
});
```

**Step 2: ビルド確認**

Run: `bun run build --filter=@hackz/shared`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat: add registerPairingInputSchema to shared schemas"
```

---

### Task 2: Admin で QR URL をパースして構造化データとして送信

**Files:**

- Modify: `apps/admin/src/hooks/useAdminRoomConnection.ts`
- Modify: `apps/admin/src/routes/connect.$roomId.tsx`

**Step 1: useAdminRoomConnection の sendQrScan を構造化データ送信に変更**

`apps/admin/src/hooks/useAdminRoomConnection.ts` の `sendQrScan` を修正:

```typescript
const sendQrScan = useCallback((data: string) => {
  if (!roomIdRef.current) {
    return;
  }
  // QR URL をパース: https://df1iy5670vkdy.cloudfront.net/u/{userId}?token={uuid}
  try {
    const url = new URL(data);
    const pathMatch = url.pathname.match(/\/u\/([^/]+)/);
    const userId = pathMatch?.[1];
    const token = url.searchParams.get("token");
    if (!userId || !token) {
      return;
    }
    sendRef.current({
      roomId: roomIdRef.current,
      channel: "upstream",
      message: { type: "QR_SCANNED", payload: { userId, token } },
    });
  } catch {
    // 無効な URL は無視
  }
}, []);
```

**Step 2: connect.$roomId.tsx の scanLog 表示を調整**

`apps/admin/src/routes/connect.$roomId.tsx` の `handleQrScan` は変更不要（raw data を sendQrScan に渡す）。scanLog の表示も raw URL のままで OK。

**Step 3: ビルド確認**

Run: `bun run build --filter=@hackz/admin`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/admin/src/hooks/useAdminRoomConnection.ts
git commit -m "feat: parse QR URL in admin and send structured userId/token"
```

---

### Task 3: Server に auth.registerPairing mutation を追加

**Files:**

- Modify: `packages/server/src/trpc/routers/auth.ts`

**Step 1: registerPairing mutation を追加**

`packages/server/src/trpc/routers/auth.ts` の `authRouter` に追加:

```typescript
import { registerPairingInputSchema } from "@hackz/shared";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

// ... existing nfcLogin ...

registerPairing: publicProcedure
  .input(registerPairingInputSchema)
  .output(z.object({ user: userSchema }))
  .mutation(async ({ input }) => {
    const { nfcId, userId, token } = input;

    // nfcId 重複チェック
    const existingByNfc = await userRepository.findByNfcId(nfcId);
    if (existingByNfc) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `この NFC カードは既に登録済みです (user: ${existingByNfc.id})`,
      });
    }

    // User 作成（id 重複は DynamoDB の attribute_not_exists で防止）
    try {
      const user = await userRepository.create({
        id: userId,
        nfcId,
        name: `User-${userId}`,
        token,
        totalScore: 0,
        createdAt: new Date().toISOString(),
      });

      return {
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
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `このユーザー ID は既に登録済みです (id: ${userId})`,
        });
      }
      throw err;
    }
  }),
```

**Step 2: import 追加確認**

`auth.ts` の先頭に `TRPCError` と `registerPairingInputSchema` の import が必要。既存の import を確認して追加。

**Step 3: ビルド確認**

Run: `bun run build --filter=@hackz/server`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/server/src/trpc/routers/auth.ts
git commit -m "feat: add auth.registerPairing mutation with duplicate checks"
```

---

### Task 4: Projector /pair ページにペアリング登録 UI を追加

**Files:**

- Modify: `apps/projector/src/routes/pair.tsx`

**Step 1: 最新値の state と登録 mutation を追加**

`pair.tsx` を以下のように修正:

- `latestNfc` state: 最新の NFC ID を保持
- `latestQr` state: 最新の QR データ `{ userId, token }` を保持
- `trpc.auth.registerPairing.useMutation()` で登録
- `handleMessages` でスキャンログに加えて最新値を更新
- 「登録」ボタン（NFC と QR 両方揃った時のみ有効）
- 登録成功/エラーのフィードバック表示
- 登録成功後に `latestNfc` と `latestQr` をリセット

**Step 2: handleMessages の修正**

```typescript
case "NFC_SCANNED":
  setLatestNfc((msg.payload as { nfcId: string }).nfcId);
  // + existing scan log logic
  break;
case "QR_SCANNED":
  setLatestQr(msg.payload as { userId: string; token: string });
  // + existing scan log logic
  break;
```

**Step 3: 登録ボタン UI**

NFC と QR の最新値を表示するカードと、「登録」ボタンを配置。両方揃っていない場合はボタン disabled。登録中は loading 表示。成功時に緑、エラー時に赤のフィードバック。

**Step 4: ビルド確認**

Run: `bun run build --filter=@hackz/projector`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add apps/projector/src/routes/pair.tsx
git commit -m "feat: add pairing registration UI to projector pair page"
```

---

### Task 5: 統合テスト（手動確認）

**Step 1: ローカル環境起動**

```bash
docker compose up -d  # DynamoDB Local
bun run db:init       # テーブル初期化
bun run dev           # 全アプリ起動
```

**Step 2: 確認フロー**

1. Projector `/pair` を開く → QR コード表示
2. Admin で QR スキャン → 接続
3. Admin で NFC テスト入力 → Projector に nfcId 表示
4. Admin で QR テスト入力（`https://df1iy5670vkdy.cloudfront.net/u/123?token=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`）→ Projector に userId/token 表示
5. 「登録」ボタン押下 → 成功表示
6. 同じ NFC or userId で再度登録 → エラー表示

**Step 3: 最終 Commit**

全て動作確認後、必要に応じて微修正してコミット。
