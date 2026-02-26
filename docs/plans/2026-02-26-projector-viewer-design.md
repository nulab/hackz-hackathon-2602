# Projector 3D Viewer Design

## Overview

projector アプリに `/viewer` ルートを追加し、Admin が NFC スキャンした「アクティブユーザー」の 3D コスチュームモデルをリアルタイム表示する。React Three Fiber (R3F) ベースで、Mixamo FBX アニメーションをランダム再生する。

## Server: Active User Store

### インメモリストア (`packages/server/src/active-user-store.ts`)

```typescript
ActiveUserStore {
  activeUser: { userId: string, nfcId: string, updatedAt: number } | null
  set(userId, nfcId)   // activeUser を上書き
  get()                // activeUser を返す
  clear()              // null にリセット
}
```

- シングルトン、単独ユーザーのみ保持
- NFC スキャンのたびに上書き

### tRPC Router (`packages/server/src/trpc/routers/projector-viewer.ts`)

| procedure                         | type     | auth   | description                               |
| --------------------------------- | -------- | ------ | ----------------------------------------- |
| `projectorViewer.getActiveUser`   | query    | public | activeUser + User + CostumeBuild を返す   |
| `projectorViewer.setActiveUser`   | mutation | public | nfcId → User lookup → activeUser にセット |
| `projectorViewer.clearActiveUser` | mutation | public | activeUser をクリア                       |

`getActiveUser` レスポンス:

```typescript
{
  user: { id, name, photoUrl } | null
  build: { faceId?, upperId?, lowerId?, shoesId? } | null
}
```

## Frontend: Component Architecture

### Route: `apps/projector/src/routes/viewer.tsx`

```
ViewerPage
+-- useActiveUserPolling()          // 2s interval getActiveUser
+-- FullscreenButton                // 右上固定、全画面切り替え
+-- Canvas (R3F, fullscreen)
|   +-- Lights (ambient + directional)
|   +-- PerspectiveCamera (fov=45, pos=[0,1,3])
|   +-- CharacterModel
|       +-- FBX model (KissWithSkin.fbx)
|       +-- HeightBasedMaterial (custom shader)
|       +-- useRandomAnimation (crossfade between FBX anims)
+-- IdleScreen                      // activeUser == null 時の待機画面
```

### Hooks

- **useActiveUserPolling**: `trpc.projectorViewer.getActiveUser.useQuery` with `refetchInterval: 2000`
- **useRandomAnimation**: FBX アニメーション配列からランダム選択、完了時に次へクロスフェード

### Custom Shader (HeightBasedMaterial)

mobile の `CharacterViewer.tsx` から移植。高さベースのマルチテクスチャ:

- Region 0 (0-3%): Shoes
- Region 1 (3-60%): Bottoms
- Region 2 (60-87%): Tops
- Region 3 (87-100%): Face (背面は #2a1a0a)

### Texture Resolution

- ビルドにアイテム未設定 → デフォルトテクスチャ (`/models/sozai_*.png`, `/models/free_face.png`)
- ユーザーの `photoUrl` あり → face テクスチャを上書き
- アイテムごとの個別テクスチャはスコープ外

### Camera

- PerspectiveCamera: fov=45, position=[0, 1, 3]
- Y 軸回転 0.5 rad/sec (mobile と同一)
- OrbitControls なし (プロジェクター用)

### Fullscreen Button

- 右上に半透明アイコンボタン
- `document.documentElement.requestFullscreen()` で全画面化
- ESC で戻る (ブラウザ標準)

## File Structure

### New Files

```
packages/server/
  src/active-user-store.ts
  src/trpc/routers/projector-viewer.ts

apps/projector/
  src/routes/viewer.tsx
  src/components/viewer/CharacterModel.tsx
  src/components/viewer/HeightBasedMaterial.tsx
  src/components/viewer/FullscreenButton.tsx
  src/components/viewer/IdleScreen.tsx
  src/hooks/useActiveUserPolling.ts
  src/hooks/useRandomAnimation.ts
  src/lib/animation-list.ts
  src/lib/texture-resolver.ts
  public/models/animations/            # Mixamo FBX files
```

### Modified Files

```
packages/server/src/trpc/routers/_app.ts   # projectorViewer router 追加
apps/projector/package.json                 # R3F dependencies 追加
```

### New Dependencies (projector)

```
@react-three/fiber
@react-three/drei
three
@types/three (dev)
```

## Animation System

- `public/models/animations/` に Mixamo FBX を配置
- `animation-list.ts` にパス列挙
- 再生完了 or 一定秒数でランダムに次へクロスフェード
- ユーザー切り替え時にもランダム再抽選

## Out of Scope

- アイテムごとの個別テクスチャ
- OrbitControls
- Admin 側 UI 変更 (setActiveUser 呼び出し追加のみ)
- 共有パッケージへの切り出し
