# Nova Pro Dynamic Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nova Pro で顔画像をテキスト化し、その出力を Nova Canvas のプロンプトに動的に組み込んでテクスチャ精度を向上させる。

**Architecture:** `generateFaceIllustration` パイプラインに Nova Pro 呼び出しステップを挿入。domain 層に 2 つの純粋関数を追加/変更し、service 層で呼び出す。

**Tech Stack:** Amazon Nova Pro (`amazon.nova-pro-v1:0`), Amazon Nova Canvas, AWS Bedrock InvokeModel API

---

### Task 1: domain に Nova Pro リクエストビルダーを追加

**Files:**

- Modify: `packages/server/src/domain/face-generation.ts`

**Step 1: `buildNovaProDescribeRequest` 関数を追加**

Nova Pro の InvokeModel 形式で、画像から顔特徴をテクスチャマップ向けに記述させるリクエストを構築する。

```ts
export const buildNovaProDescribeRequest = (base64Image: string) => ({
  schemaVersion: "messages-v1",
  messages: [
    {
      role: "user",
      content: [
        {
          image: {
            format: "jpeg",
            source: { bytes: base64Image },
          },
        },
        {
          text: "Describe this person's face for a 3D texture map.",
        },
      ],
    },
  ],
  system: [
    {
      text: [
        "You are a 3D texture artist creating UV face texture maps for low-poly game characters (PS1/PS2 era).",
        "Given a face photo, describe ONLY the visual features needed for a flat texture map that fills an entire square canvas edge-to-edge:",
        "- Hair: color, style, coverage at top and side edges",
        "- Skin: tone, complexion",
        "- Eyes: color, shape, distinctive features",
        "- Facial hair: beard, mustache, stubble (if any)",
        "- Accessories: glasses, piercings (if any)",
        "- Face shape and proportions",
        "Output a single paragraph describing how these features should be arranged on the texture map.",
        "Do NOT mention the person's name, identity, age, ethnicity, or any personal information.",
        "Do NOT describe background, clothing, or anything below the neck.",
      ].join(" "),
    },
  ],
  inferenceConfig: {
    max_new_tokens: 300,
    temperature: 0.3,
  },
});
```

**Step 2: `buildNovaCanvasRequest` を `faceDescription` 引数付きに変更**

Nova Pro の出力テキストをプロンプトの先頭に組み込む。固定のスタイル/構図指示は維持。

```ts
export const buildNovaCanvasRequest = (base64Image: string, faceDescription: string) => ({
  taskType: "IMAGE_VARIATION",
  imageVariationParams: {
    text: [
      faceDescription,
      "COMPOSITION: A front-facing face filling the entire square canvas edge-to-edge. No background whatsoever. The face occupies 100% of the image area.",
      "EDGES: Top edge and left/right edges fade into dark brown hair (#2a1a0a). Bottom edge shows chin and neck skin. No gaps or margins between the face and canvas edges.",
      "STYLE: Early 2000s low-polygon 3D game texture (PS1/PS2 era). Limited color palette, flat matte shading, slightly simplified features, visible color banding. NOT photorealistic, NOT modern anime. Think Virtua Fighter, Final Fantasy VII-X face textures.",
    ].join(" "),
    negativeText:
      "background, scenery, wall, sky, shoulders, body, clothing, frame, border, margin, padding, photorealistic, high detail, smooth gradient, modern rendering, text, watermark, blurry, distorted",
    images: [base64Image],
    similarityStrength: 0.7,
  },
  imageGenerationConfig: {
    numberOfImages: 1,
    height: 512,
    width: 512,
    cfgScale: 8.0,
  },
});
```

**Step 3: Commit**

```bash
git add packages/server/src/domain/face-generation.ts
git commit -m "feat: add Nova Pro describe request builder and accept dynamic prompt in Canvas request"
```

---

### Task 2: service のパイプラインに Nova Pro 呼び出しを挿入

**Files:**

- Modify: `packages/server/src/services/face-generation.ts`

**Step 1: import に `buildNovaProDescribeRequest` を追加**

```ts
import { buildNovaCanvasRequest, buildNovaProDescribeRequest } from "../domain/face-generation";
```

**Step 2: `generateFaceIllustration` に Nova Pro ステップを追加**

クロップ後、Nova Canvas の前に Nova Pro を呼び出してテキスト記述を取得する。

```ts
export const generateFaceIllustration = async (
  userId: string,
  base64Image: string,
): Promise<{ faceImageUrl: string }> => {
  const croppedBase64 = await cropFaceFromImage(base64Image);

  // Step 1: Nova Pro で顔の特徴をテキスト化
  const describeRequest = buildNovaProDescribeRequest(croppedBase64);
  const describeResponse = await invokeBedrock("amazon.nova-pro-v1:0", describeRequest);
  const faceDescription =
    (describeResponse.output as { message?: { content?: { text?: string }[] } })?.message
      ?.content?.[0]?.text ?? "";

  // Step 2: テキスト記述を使って Nova Canvas でテクスチャ生成
  const request = buildNovaCanvasRequest(croppedBase64, faceDescription);
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

**Step 3: Commit**

```bash
git add packages/server/src/services/face-generation.ts
git commit -m "feat: integrate Nova Pro face description into face generation pipeline"
```

---

### Task 3: ビルド・リント検証

**Step 1:** `bun run build` — 全アプリビルド成功を確認
**Step 2:** `bun run lint` — 0 errors を確認
**Step 3:** 問題があれば修正してコミット
