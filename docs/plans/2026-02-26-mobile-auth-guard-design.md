# Mobile Auth Guard Design

## 概要

mobile アプリの全ページで認証チェックを行い、未認証時は 404 表示、チェック中はローディング UI を表示する。

## アプローチ

TanStack Router の `beforeLoad` を `/u/$userId` レイアウトルートに追加。

## フロー

```
ページアクセス
  → beforeLoad: localStorage にトークンあるか？
    → なし → notFound()
    → あり → users.me を fetch
      → 成功 → 子ルートをレンダリング
      → UNAUTHORIZED → notFound()
  → beforeLoad 実行中 → pendingComponent（ローディング UI）
```

## 変更ファイル

| ファイル                                       | 変更内容                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `apps/mobile/src/routes/u/$userId.tsx`         | `beforeLoad` で認証チェック、`pendingComponent`、`errorComponent` |
| `apps/mobile/src/components/LoadingScreen.tsx` | 新規 — 全画面ローディングコンポーネント                           |

## 技術的注意点

- `beforeLoad` は TRPCProvider の外で実行されるため、vanilla fetch で `users.me` を呼ぶ
- URL の `?token=` パラメータ処理を `beforeLoad` に移動（component から）
- エラー時は `notFound()` を throw し、子コンポーネント（3D モデル等）を一切レンダリングしない
