# Nova Pro Dynamic Prompt for Face Texture Generation

## Problem

Nova Canvas の IMAGE_VARIATION に固定プロンプトを渡しているため、個々の顔の特徴（髪色、メガネ、ヒゲ等）がテクスチャに反映されにくい。

## Solution

Nova Pro (マルチモーダル) で入力画像の顔特徴をテキスト化し、その出力を Nova Canvas のプロンプトに動的に組み込む。

## Flow

```
クロップ済み顔画像(512x512)
  → Nova Pro (amazon.nova-pro-v1:0) で顔特徴をテキスト記述
  → Nova Canvas (amazon.nova-canvas-v1:0) に動的プロンプト + 画像で生成
  → S3 アップロード
```

## Changes

### domain/face-generation.ts

- `buildNovaProDescribeRequest(base64Image)` 追加: 顔特徴をテクスチャマップ向けに記述させるリクエスト構築
- `buildNovaCanvasRequest(base64Image, faceDescription)` に変更: Nova Pro 出力をプロンプトに組み込み

### services/face-generation.ts

- `generateFaceIllustration` パイプラインに Nova Pro 呼び出しステップを挿入

### services/bedrock.ts

- 変更なし（既存の `invokeBedrock` で Nova Pro も呼び出し可能）

## Trade-offs

- レイテンシ: Nova Pro 呼び出し分（1-3秒）追加
- コスト: Nova Pro トークンコスト追加
- メリット: 個人の特徴に合わせた動的プロンプトでテクスチャ精度向上
