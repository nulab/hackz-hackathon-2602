# Server-Side Face Crop with Amazon Rekognition

## Problem

クライアント側の face-api.js (0.22.2) + @tensorflow/tfjs-core (1.7.0) が古く、最新ブラウザで `cropFace` が例外をスローし、`generateFace` リクエストが発火しない。

## Solution

face-api.js をクライアントから削除し、サーバー側で Amazon Rekognition `DetectFaces` を使って顔領域を抽出する。

## Data Flow (After)

```
Mobile: 撮影 → dataURL をそのまま generateFace.mutate() に送信
Server: dataURL → base64 抽出
      → Rekognition DetectFaces で BoundingBox 取得
      → BoundingBox 座標で顔部分を 512x512 にクロップ
      → Nova Canvas でイラスト生成
      → S3 にアップロード → URL 返却
```

## Changes

### Client (apps/mobile)

- `face-api.js` 依存を削除
- `src/lib/face-crop.ts` を削除
- `handleCapture` から `cropFace` 呼び出しを除去、dataURL をそのまま送信

### Server (packages/server)

- `@aws-sdk/client-rekognition` を追加
- `services/rekognition.ts` — DetectFaces 呼び出し
- `domain/face-crop.ts` — BoundingBox 座標から顔クロップ (Buffer ベース)
- `trpc/routers/users.ts` — generateFace で Rekognition クロップを挟む

## Prerequisites

- IAM に `rekognition:DetectFaces` 権限
- ローカル開発でも実際の AWS に接続（Rekognition にローカルエミュレーターなし）
