# Costume Texture Binding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 選択したコスチュームアイテムのテクスチャを 3D モデルに反映し、mobile と projector の両方で着せ替えが見えるようにする。

**Architecture:** アイテム ID → テクスチャ URL のマッピング関数を各アプリに配置。3D モデルコンポーネントに body part ごとのテクスチャ URL props を追加し、ページ側で解決済み URL を渡す。

**Tech Stack:** React, Three.js (FBX + custom shader), tRPC, Vite static assets

---

### Task 1: テクスチャ画像を projector にコピー

**Files:**

- Create: `apps/projector/public/costumes/` (12 PNG files)

**Step 1: コピー実行**

```bash
cp -r apps/mobile/public/costumes/ apps/projector/public/costumes/
```

**Step 2: 確認**

```bash
ls apps/projector/public/costumes/
```

Expected: 12 files (`texture_gal-lower.png`, `texture_gal-shoes.png`, `texture_gal-upper.png`, `texture_office-lower.png`, `texture_office-shoes.png`, `texture_office-upper.png`, `texture_princess-lower.png`, `texture_princess-shoes.png`, `texture_princess-upper.png`, `texture_ssr-lower.png`, `texture_ssr-shoes.png`, `texture_ssr-upper.png`)

**Step 3: Commit**

```bash
git add apps/projector/public/costumes/
git commit -m "chore: copy costume textures to projector public"
```

---

### Task 2: mobile の DancingModel にテクスチャ URL props を追加

**Files:**

- Modify: `apps/mobile/src/components/DancingModel.tsx`

**Step 1: Props 型を拡張**

`DancingModelProps` を変更:

```typescript
type DancingModelProps = {
  faceImageUrl?: string | null;
  topsUrl?: string;
  bottomsUrl?: string;
  shoesUrl?: string;
};
```

**Step 2: `applyHeightBasedTextures` にテクスチャ URL 引数を追加**

関数シグネチャを変更:

```typescript
const applyHeightBasedTextures = async (
  mesh: THREE.Mesh,
  faceImageUrl?: string | null,
  topsUrl?: string,
  bottomsUrl?: string,
  shoesUrl?: string,
) => {
```

4テクスチャ並行読み込み部分（line 200-206）を変更:

```typescript
const headTextureUrl = faceImageUrl || "/models/free_face.png";
const [headTex, topsTex, bottomsTex, shoesTex] = await Promise.all([
  loadProcessedTexture(headTextureUrl, { bgColor: "#2a1a0a" }),
  loadProcessedTexture(topsUrl || "/models/sozai_tops.png"),
  loadProcessedTexture(bottomsUrl || "/models/sozai_bottoms_vivid.png"),
  loadProcessedTexture(shoesUrl || "/models/sozai_shoes.png"),
]);
```

**Step 3: コンポーネントから props を透過**

`DancingModel` コンポーネント内、`applyHeightBasedTextures` 呼び出し（line 323）を変更:

```typescript
export const DancingModel = ({ faceImageUrl, topsUrl, bottomsUrl, shoesUrl }: DancingModelProps) => {
```

```typescript
for (const mesh of allMeshes) {
  await applyHeightBasedTextures(mesh, faceImageUrl, topsUrl, bottomsUrl, shoesUrl);
}
```

useEffect の依存配列にも追加:

```typescript
}, [faceImageUrl, topsUrl, bottomsUrl, shoesUrl]);
```

**Step 4: ビルド確認**

```bash
cd apps/mobile && bun run build
```

Expected: ビルド成功（まだ props を渡してないので既存動作は変わらない）

**Step 5: Commit**

```bash
git add apps/mobile/src/components/DancingModel.tsx
git commit -m "feat(mobile): add texture URL props to DancingModel"
```

---

### Task 3: DancingModelCanvas に props を透過

**Files:**

- Modify: `apps/mobile/src/components/DancingModelCanvas.tsx`

**Step 1: Props 型を拡張して DancingModel に透過**

```typescript
type Props = {
  faceImageUrl?: string | null;
  topsUrl?: string;
  bottomsUrl?: string;
  shoesUrl?: string;
};

export const DancingModelCanvas = ({ faceImageUrl, topsUrl, bottomsUrl, shoesUrl }: Props) => (
  <div style={{ width: "100%", aspectRatio: "1/2", position: "relative", zIndex: 1 }}>
    <Canvas
      camera={{ position: [0, 0.75, 1.8], fov: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <DancingModel
        faceImageUrl={faceImageUrl}
        topsUrl={topsUrl}
        bottomsUrl={bottomsUrl}
        shoesUrl={shoesUrl}
      />
    </Canvas>
  </div>
);
```

**Step 2: Commit**

```bash
git add apps/mobile/src/components/DancingModelCanvas.tsx
git commit -m "feat(mobile): pass texture URL props through DancingModelCanvas"
```

---

### Task 4: mobile コスチュームページでテクスチャ URL を解決して渡す

**Files:**

- Modify: `apps/mobile/src/routes/u/$userId/costumes.tsx`

**Step 1: テクスチャ解決ヘルパーを追加**

ファイル冒頭（imports の後）に追加:

```typescript
const TEXTURE_DEFAULTS = {
  upper: "/models/sozai_tops.png",
  lower: "/models/sozai_bottoms_vivid.png",
  shoes: "/models/sozai_shoes.png",
};

const resolveTextureUrl = (
  itemId: string | undefined,
  layer: keyof typeof TEXTURE_DEFAULTS,
): string => {
  if (!itemId) return TEXTURE_DEFAULTS[layer];
  return `/costumes/texture_${itemId}.png`;
};
```

**Step 2: DancingModelCanvas に解決済み URL を渡す**

`CostumesPage` コンポーネント内、`<DancingModelCanvas>` の呼び出しを変更:

```tsx
<DancingModelCanvas
  faceImageUrl={faceImageUrl}
  topsUrl={resolveTextureUrl(findByLayer(selectedItemIds, "upper"), "upper")}
  bottomsUrl={resolveTextureUrl(findByLayer(selectedItemIds, "lower"), "lower")}
  shoesUrl={resolveTextureUrl(findByLayer(selectedItemIds, "shoes"), "shoes")}
/>
```

**Step 3: ビルド確認**

```bash
cd apps/mobile && bun run build
```

**Step 4: Commit**

```bash
git add apps/mobile/src/routes/u/\$userId/costumes.tsx
git commit -m "feat(mobile): resolve costume textures on selection page"
```

---

### Task 5: mobile ホームページでもテクスチャ URL を解決して渡す

**Files:**

- Modify: `apps/mobile/src/routes/u/$userId/index.tsx`

**Step 1: 同じテクスチャ解決ヘルパーを追加**

```typescript
const TEXTURE_DEFAULTS = {
  upper: "/models/sozai_tops.png",
  lower: "/models/sozai_bottoms_vivid.png",
  shoes: "/models/sozai_shoes.png",
};

const resolveTextureUrl = (
  itemId: string | undefined,
  layer: keyof typeof TEXTURE_DEFAULTS,
): string => {
  if (!itemId) return TEXTURE_DEFAULTS[layer];
  return `/costumes/texture_${itemId}.png`;
};
```

**Step 2: DancingModelCanvas に解決済み URL を渡す**

`<DancingModelCanvas>` 呼び出しを変更:

```tsx
<DancingModelCanvas
  faceImageUrl={faceImageUrl}
  topsUrl={resolveTextureUrl(buildData?.upperId, "upper")}
  bottomsUrl={resolveTextureUrl(buildData?.lowerId, "lower")}
  shoesUrl={resolveTextureUrl(buildData?.shoesId, "shoes")}
/>
```

**Step 3: ビルド確認**

```bash
cd apps/mobile && bun run build
```

**Step 4: Commit**

```bash
git add apps/mobile/src/routes/u/\$userId/index.tsx
git commit -m "feat(mobile): resolve costume textures on home page"
```

---

### Task 6: projector の texture-resolver を更新

**Files:**

- Modify: `apps/projector/src/lib/texture-resolver.ts`

**Step 1: build データからテクスチャ URL を解決するように更新**

```typescript
type BuildTextures = {
  face: string;
  tops: string;
  bottoms: string;
  shoes: string;
};

const DEFAULTS: BuildTextures = {
  face: "/models/free_face.png",
  tops: "/models/sozai_tops.png",
  bottoms: "/models/sozai_bottoms_vivid.png",
  shoes: "/models/sozai_shoes.png",
};

type BuildData = {
  upperId?: string;
  lowerId?: string;
  shoesId?: string;
};

const resolveItemTexture = (itemId: string | undefined, fallback: string): string => {
  if (!itemId) return fallback;
  return `/costumes/texture_${itemId}.png`;
};

export const resolveTextures = (photoUrl?: string, build?: BuildData | null): BuildTextures => ({
  face: photoUrl || DEFAULTS.face,
  tops: resolveItemTexture(build?.upperId, DEFAULTS.tops),
  bottoms: resolveItemTexture(build?.lowerId, DEFAULTS.bottoms),
  shoes: resolveItemTexture(build?.shoesId, DEFAULTS.shoes),
});
```

**Step 2: Commit**

```bash
git add apps/projector/src/lib/texture-resolver.ts
git commit -m "feat(projector): resolve costume textures from build data"
```

---

### Task 7: projector の CharacterModel にテクスチャ URL props を追加

**Files:**

- Modify: `apps/projector/src/components/viewer/CharacterModel.tsx`

**Step 1: Props 型を拡張**

```typescript
type CharacterModelProps = {
  faceImageUrl?: string | null;
  topsUrl?: string;
  bottomsUrl?: string;
  shoesUrl?: string;
};
```

**Step 2: `applyHeightBasedTextures` のテクスチャ読み込みを引数化**

関数シグネチャを変更:

```typescript
const applyHeightBasedTextures = async (
  mesh: THREE.Mesh,
  faceUrl: string,
  topsUrl?: string,
  bottomsUrl?: string,
  shoesUrl?: string,
) => {
```

テクスチャ読み込み部分（line 180-185）を変更:

```typescript
const [headTex, topsTex, bottomsTex, shoesTex] = await Promise.all([
  loadProcessedTexture(faceUrl, { bgColor: "#2a1a0a" }),
  loadProcessedTexture(topsUrl || "/models/sozai_tops.png"),
  loadProcessedTexture(bottomsUrl || "/models/sozai_bottoms_vivid.png"),
  loadProcessedTexture(shoesUrl || "/models/sozai_shoes.png"),
]);
```

**Step 3: コンポーネントから props を透過**

```typescript
export const CharacterModel = ({ faceImageUrl, topsUrl, bottomsUrl, shoesUrl }: CharacterModelProps) => {
```

`applyHeightBasedTextures` 呼び出し（line 330-331）を変更:

```typescript
for (const mesh of allMeshes) {
  await applyHeightBasedTextures(mesh, headUrl, topsUrl, bottomsUrl, shoesUrl);
}
```

useEffect 依存配列にも追加:

```typescript
}, [faceImageUrl, topsUrl, bottomsUrl, shoesUrl, playRandomAnimation]);
```

**Step 4: ビルド確認**

```bash
cd apps/projector && bun run build
```

**Step 5: Commit**

```bash
git add apps/projector/src/components/viewer/CharacterModel.tsx
git commit -m "feat(projector): add texture URL props to CharacterModel"
```

---

### Task 8: projector の viewer ページでテクスチャを渡す

**Files:**

- Modify: `apps/projector/src/routes/viewer.tsx`

**Step 1: resolveTextures に build データを渡す**

```typescript
const ViewerPage = () => {
  const { data } = trpc.projectorViewer.getActiveUser.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const user = data?.user ?? null;
  const build = data?.build ?? null;
  const textures = resolveTextures(user?.photoUrl, build);
```

**Step 2: CharacterModel にテクスチャ props を渡す**

```tsx
{
  user && (
    <CharacterModel
      faceImageUrl={textures.face}
      topsUrl={textures.tops}
      bottomsUrl={textures.bottoms}
      shoesUrl={textures.shoes}
    />
  );
}
```

**Step 3: ビルド確認**

```bash
cd apps/projector && bun run build
```

**Step 4: Commit**

```bash
git add apps/projector/src/routes/viewer.tsx
git commit -m "feat(projector): pass resolved costume textures to CharacterModel"
```

---

### Task 9: 全体ビルド確認 & lint

**Step 1: lint & format**

```bash
bun run lint && bun run format
```

**Step 2: 全体ビルド**

```bash
bun run build
```

**Step 3: 最終 Commit（必要な場合）**

```bash
git add -A
git commit -m "chore: fix lint/format issues"
```
