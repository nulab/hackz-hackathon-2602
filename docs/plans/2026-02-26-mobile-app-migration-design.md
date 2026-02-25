# Mobile App Migration Design

## Overview

Astro製モバイルアプリを `apps/mobile` に React (TanStack Router + Tailwind CSS 4) として移植する。
バックエンド連携は後日行うため、ローカルストレージベースのスタブ実装を維持する。

## Routes

| Path                           | Purpose                                      | Source         |
| ------------------------------ | -------------------------------------------- | -------------- |
| `/u/$userId`                   | Home (character display, navigation, camera) | `index.astro`  |
| `/u/$userId/gacha/$costumeKey` | Gacha result display (card flip)             | `gacha.astro`  |
| `/u/$userId/costumes`          | Closet (inventory, outfit selection)         | `closet.astro` |

## Gacha Flow

1. Home画面で「ガチャを引く」ボタン押下
2. `drawGacha()` でランダムに costumeKey 確定
3. `navigate(/u/${userId}/gacha/${costumeKey})` で結果画面へ
4. カードフリップ演出で結果表示
5. カード自体は閲覧可能、レアリティ制限は装備時に適用

## Styling

- ソースCSS（tokens.css, reset.css, base.css, layout.css, utilities.css）を `src/styles/` にそのまま配置
- `global.css` で `@layer` 読み込み + Tailwind共存
- コンポーネント固有スタイルはCSS Modulesまたはインライン

## State Management

- localStorage ベース維持（backend接続は後日差し替え）
- `storage.ts` + `api.ts` をReact向けにラップ

## Images

- 全40枚PNGを `src/assets/images/` に配置
- ES import でパス解決（Vite処理）

## Component Structure

```
src/
├── assets/images/          # 40 PNG images
├── styles/                 # Source CSS (tokens, reset, base, layout, utilities)
├── components/
│   ├── PrimaryButton.tsx
│   ├── CardFlip.tsx
│   ├── ItemGrid.tsx
│   ├── ItemTile.tsx
│   ├── CameraCapture.tsx
│   ├── FallingItems.tsx
│   └── Toast.tsx
├── lib/
│   ├── items.ts            # Item master data
│   ├── storage.ts          # localStorage wrapper
│   └── api.ts              # API stubs
└── routes/
    ├── __root.tsx           # Root layout (FallingItems + Toast)
    └── u/
        ├── $userId.tsx      # userId layout
        └── $userId/
            ├── index.tsx    # Home
            ├── costumes.tsx # Closet
            └── gacha/
                └── $costumeKey.tsx  # Gacha result
```
