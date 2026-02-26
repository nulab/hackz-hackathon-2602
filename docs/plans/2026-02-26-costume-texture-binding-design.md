# Costume Texture Binding Design

## Summary

選択したコスチュームアイテムの画像テクスチャを 3D モデルに反映する。mobile と projector の両方で対応。

## Current State

- `apps/mobile/public/costumes/` に `texture_{outfit}-{part}.png` 形式で 12 枚のテクスチャ画像がある（office, princess, gal, ssr × upper, lower, shoes）
- `DancingModel`（mobile）と `CharacterModel`（projector）はハードコードのデフォルトテクスチャを使用
- build データ（upperId, lowerId, shoesId）は DynamoDB に保存されるが、3D 描画に反映されていない

## Design

### Texture Resolution

アイテム ID → テクスチャ URL のマッピング:

```
itemId: "office-upper" → "/costumes/texture_office-upper.png"
itemId: undefined      → デフォルトテクスチャ（sozai_*.png）
```

face アイテム（メガネ等）はテクスチャ変更なし。バッジ表示のみ。

### Props-based Texture Passing

3D モデルコンポーネントに `topsUrl`, `bottomsUrl`, `shoesUrl` props を追加。
ページ側で選択アイテムからテクスチャ URL を解決して渡す。

### Changes

**mobile:**

| File                                | Change                                            |
| ----------------------------------- | ------------------------------------------------- |
| `components/DancingModel.tsx`       | `topsUrl?`, `bottomsUrl?`, `shoesUrl?` props 追加 |
| `components/DancingModelCanvas.tsx` | 同 props を透過                                   |
| `routes/u/$userId/costumes.tsx`     | 選択アイテム → テクスチャ URL 解決                |
| `routes/u/$userId/index.tsx`        | buildData → テクスチャ URL 解決                   |

**projector:**

| File                                   | Change                                            |
| -------------------------------------- | ------------------------------------------------- |
| `public/costumes/`                     | テクスチャ画像をコピー配置                        |
| `lib/texture-resolver.ts`              | build の costumeId からテクスチャ URL 解決        |
| `components/viewer/CharacterModel.tsx` | `topsUrl?`, `bottomsUrl?`, `shoesUrl?` props 追加 |
| `routes/viewer.tsx`                    | 解決済みテクスチャを渡す                          |

### Data Flow

```
[mobile costume page]
  selectedItemIds → resolveItemTexture() → DancingModelCanvas(topsUrl, bottomsUrl, shoesUrl)
  saveBuild(upperId, lowerId, shoesId) → DynamoDB

[projector viewer]
  getActiveUser() → build.upperId/lowerId/shoesId
  → resolveTextures(build) → CharacterModel(topsUrl, bottomsUrl, shoesUrl)
```
