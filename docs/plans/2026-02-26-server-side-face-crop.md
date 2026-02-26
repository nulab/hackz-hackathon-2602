# Server-Side Face Crop with Rekognition — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** face-api.js をクライアントから削除し、サーバー側で Amazon Rekognition DetectFaces + sharp で顔クロップを行う。

**Architecture:** モバイルは撮影した dataURL をそのまま送信。サーバーで Rekognition → 顔クロップ → Nova Canvas の順に処理する。

**Tech Stack:** @aws-sdk/client-rekognition, sharp, Bun test runner

---

### Task 1: サーバーに依存パッケージを追加

**Files:**

- Modify: `packages/server/package.json`

**Step 1: パッケージ追加**

Run:

```bash
cd packages/server && bun add @aws-sdk/client-rekognition sharp && bun add -d @types/sharp
```

**Step 2: インストール確認**

Run: `cd /path/to/root && bun install`
Expected: エラーなし

**Step 3: Commit**

```bash
git add packages/server/package.json bun.lock
git commit -m "chore: add @aws-sdk/client-rekognition and sharp to server"
```

---

### Task 2: Rekognition サービスを作成

**Files:**

- Create: `packages/server/src/services/rekognition.ts`

**Step 1: テストを書く**

Create: `packages/server/src/services/rekognition.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { detectFaceBoundingBox } from "./rekognition";

// Note: Rekognition はモック不要のユニットテストが難しいため、
// domain/face-crop.ts の純粋関数側でテストを厚くする。
// ここでは型と export の確認のみ。
describe("rekognition service", () => {
  test("detectFaceBoundingBox is exported as a function", () => {
    expect(typeof detectFaceBoundingBox).toBe("function");
  });
});
```

**Step 2: 実装**

Create: `packages/server/src/services/rekognition.ts`

```typescript
import { RekognitionClient, DetectFacesCommand } from "@aws-sdk/client-rekognition";

export type BoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

export const detectFaceBoundingBox = async (
  imageBytes: Uint8Array,
): Promise<BoundingBox | null> => {
  const response = await rekognition.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ["DEFAULT"],
    }),
  );

  const face = response.FaceDetails?.[0];
  if (!face?.BoundingBox) {
    return null;
  }

  const { Left, Top, Width, Height } = face.BoundingBox;
  return {
    left: Left ?? 0,
    top: Top ?? 0,
    width: Width ?? 0,
    height: Height ?? 0,
  };
};
```

**Step 3: テスト実行**

Run: `cd packages/server && bun test src/services/rekognition.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/services/rekognition.ts packages/server/src/services/rekognition.test.ts
git commit -m "feat: add Rekognition detectFaceBoundingBox service"
```

---

### Task 3: サーバー側の顔クロップ domain 関数を作成

**Files:**

- Create: `packages/server/src/domain/face-crop.ts`
- Create: `packages/server/src/domain/face-crop.test.ts`

**Step 1: テストを書く**

```typescript
import { describe, expect, test } from "bun:test";
import { computeCropRegion } from "./face-crop";

describe("computeCropRegion", () => {
  test("adds padding around bounding box and returns square crop", () => {
    // Image: 1000x1000, face at center 200x200
    const result = computeCropRegion({ left: 0.4, top: 0.4, width: 0.2, height: 0.2 }, 1000, 1000);
    // Face is 200x200, padding = 200 * 0.4 = 80
    // cropSize = 200 + 80*2 = 360
    // centerX = 400 + 100 = 500, centerY = 400 + 100 = 500
    // cropX = 500 - 180 = 320, cropY = 500 - 180 = 320
    expect(result.x).toBe(320);
    expect(result.y).toBe(320);
    expect(result.size).toBe(360);
  });

  test("clamps crop region to image bounds", () => {
    // Face near top-left corner
    const result = computeCropRegion({ left: 0, top: 0, width: 0.3, height: 0.3 }, 100, 100);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.x + result.size).toBeLessThanOrEqual(100);
    expect(result.y + result.size).toBeLessThanOrEqual(100);
  });

  test("returns null crop region when bounding box is null (fallback center crop)", () => {
    const result = computeCropRegion(null, 1000, 800);
    // Fallback: 70% of min(1000,800) = 560
    expect(result.size).toBe(560);
    // Centered: x = (1000 - 560) / 2 = 220
    expect(result.x).toBe(220);
  });
});
```

**Step 2: テスト実行（失敗を確認）**

Run: `cd packages/server && bun test src/domain/face-crop.test.ts`
Expected: FAIL — `computeCropRegion` not found

**Step 3: 実装**

```typescript
import type { BoundingBox } from "../services/rekognition";

export type CropRegion = {
  x: number;
  y: number;
  size: number;
};

const PADDING_RATIO = 0.4;
const FALLBACK_CROP_RATIO = 0.7;

export const computeCropRegion = (
  box: BoundingBox | null,
  imageWidth: number,
  imageHeight: number,
): CropRegion => {
  if (!box) {
    const cropSize = Math.min(imageWidth, imageHeight) * FALLBACK_CROP_RATIO;
    return {
      x: Math.round((imageWidth - cropSize) / 2),
      y: Math.round(Math.max(0, (imageHeight - cropSize) / 2 - imageHeight * 0.1)),
      size: Math.round(cropSize),
    };
  }

  const pixelX = box.left * imageWidth;
  const pixelY = box.top * imageHeight;
  const pixelW = box.width * imageWidth;
  const pixelH = box.height * imageHeight;

  const padding = Math.max(pixelW, pixelH) * PADDING_RATIO;
  let cropSize = Math.max(pixelW, pixelH) + padding * 2;

  const centerX = pixelX + pixelW / 2;
  const centerY = pixelY + pixelH / 2;
  let cropX = centerX - cropSize / 2;
  let cropY = centerY - cropSize / 2;

  cropX = Math.max(0, Math.min(cropX, imageWidth - cropSize));
  cropY = Math.max(0, Math.min(cropY, imageHeight - cropSize));
  cropSize = Math.min(cropSize, imageWidth, imageHeight);

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    size: Math.round(cropSize),
  };
};
```

**Step 4: テスト実行（成功を確認）**

Run: `cd packages/server && bun test src/domain/face-crop.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/domain/face-crop.ts packages/server/src/domain/face-crop.test.ts
git commit -m "feat: add computeCropRegion domain function with tests"
```

---

### Task 4: generateFace mutation にサーバー側クロップを統合

**Files:**

- Modify: `packages/server/src/trpc/routers/users.ts`
- Modify: `packages/server/src/services/face-generation.ts`

**Step 1: face-generation サービスにクロップ処理を追加**

Modify `packages/server/src/services/face-generation.ts`:

```typescript
import sharp from "sharp";
import { buildNovaCanvasRequest } from "../domain/face-generation";
import { computeCropRegion } from "../domain/face-crop";
import { detectFaceBoundingBox } from "./rekognition";
import { invokeBedrock } from "./bedrock";
import { uploadFile } from "./s3";

const CROP_OUTPUT_SIZE = 512;

export const cropFaceFromImage = async (base64Image: string): Promise<string> => {
  const imageBuffer = Buffer.from(base64Image, "base64");
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const boundingBox = await detectFaceBoundingBox(new Uint8Array(imageBuffer));
  const region = computeCropRegion(boundingBox, width, height);

  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left: region.x, top: region.y, width: region.size, height: region.size })
    .resize(CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE)
    .jpeg({ quality: 85 })
    .toBuffer();

  return croppedBuffer.toString("base64");
};

export const generateFaceIllustration = async (
  userId: string,
  base64Image: string,
): Promise<{ faceImageUrl: string }> => {
  const croppedBase64 = await cropFaceFromImage(base64Image);

  const request = buildNovaCanvasRequest(croppedBase64);
  const response = await invokeBedrock("amazon.nova-canvas-v1:0", request);
  const images = response.images as string[];

  if (!images || images.length === 0) {
    throw new Error("Nova Canvas returned no images");
  }

  const imageBuffer = Buffer.from(images[0], "base64");
  const faceImageUrl = await uploadFile(`face/${userId}.png`, imageBuffer, "image/png");

  return { faceImageUrl };
};
```

**Step 2: users.ts は変更不要であることを確認**

`trpc/routers/users.ts` の `generateFace` mutation はすでに `generateFaceIllustration(ctx.userId, base64)` を呼んでいるので、サービス層の変更だけで連携が完了する。変更不要。

**Step 3: ビルド確認**

Run: `cd /path/to/root && bun run build`
Expected: エラーなし

**Step 4: Commit**

```bash
git add packages/server/src/services/face-generation.ts
git commit -m "feat: integrate Rekognition face detection + sharp crop into generateFace"
```

---

### Task 5: クライアント側の face-api.js を削除

**Files:**

- Delete: `apps/mobile/src/lib/face-crop.ts`
- Delete: `apps/mobile/public/models/face-detection/` (ディレクトリごと)
- Modify: `apps/mobile/src/routes/u/$userId/index.tsx`
- Modify: `apps/mobile/package.json`

**Step 1: handleCapture から cropFace を除去**

Modify `apps/mobile/src/routes/u/$userId/index.tsx`:

- `import { cropFace }` の行を削除
- `handleCapture` を以下に変更:

```typescript
const handleCapture = async (dataURL: string) => {
  storage.savePhoto(dataURL);
  setPhoto(dataURL);
  setCameraOpen(false);
  setIsGenerating(true);

  generateFace.mutate({
    photo: dataURL,
    contentType: "image/jpeg",
  });
};
```

- `handleCapture` の `try/catch` は不要になるので削除（エラーハンドリングは `generateFace` の `onError` に既に存在）

**Step 2: face-crop.ts とモデルファイルを削除**

```bash
rm apps/mobile/src/lib/face-crop.ts
rm -rf apps/mobile/public/models/face-detection
```

**Step 3: face-api.js パッケージを削除**

```bash
cd apps/mobile && bun remove face-api.js
```

**Step 4: ビルド確認**

Run: `cd /path/to/root && bun run build`
Expected: エラーなし

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove client-side face-api.js, face cropping now handled server-side"
```

---

### Task 6: lint & 全テスト実行

**Step 1: lint**

Run: `bun run lint`
Expected: エラーなし

**Step 2: テスト**

Run: `bun test`
Expected: 全テスト PASS

**Step 3: フォーマット**

Run: `bun run format:fix`

**Step 4: 最終 Commit（必要な場合）**

```bash
git add -A
git commit -m "chore: fix lint and format"
```
