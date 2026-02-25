# R3F Dance Demo - 開発メモ

## Blender FBX エクスポート手順

### 前提

- Blender のシーンに Armature（`born`）と Mesh（`body`）が親子関係で存在すること
- `body` が `born` の子要素になっていること

### エクスポート手順

1. Outliner で `born`（Armature）をクリック
2. **Shift+クリック** で `body`（Mesh）も追加選択（両方オレンジにする）
3. **File → Export → FBX (.fbx)**
4. エクスポート設定：

| セクション | 項目           | 値                              |
| ---------- | -------------- | ------------------------------- |
| Include    | Limit to       | **Selected Objects** にチェック |
| Include    | Object Types   | **Armature** と **Mesh** のみ   |
| Transform  | Scale          | **1.00**                        |
| Transform  | Apply Scalings | **FBX All**                     |
| Transform  | Forward        | **-Z Forward**                  |
| Transform  | Up             | **Y Up**                        |
| Transform  | Apply Unit     | チェック                        |
| Armature   | Add Leaf Bones | **オフ**                        |

5. ファイル名を付けてエクスポート

### 注意点

- Armature だけ選択すると **メッシュが含まれない**（ボーンのみの FBX になる）
- Mesh だけ選択すると **ボーンが含まれない**（スキニングアニメーション不可）
- Scale を 1000 にすると R3F 側でスケール調整が大変になるので 1.00 を推奨

## Mixamo ダンスアニメーション取得手順

1. https://www.mixamo.com/ にアクセス（Adobe アカウントでログイン）
2. **Upload Character** で上記手順のFBXをアップロード
3. 自動リギング画面でマーカーを配置(アシンメトリーのチェックを外す) → Next → Next
4. **Animations** タブでダンスを検索（例: `Hip Hop Dancing`, `Samba`, `Thriller`）
5. プレビューで確認
6. **Download** → 設定：
   - Format: **FBX Binary (.fbx)**
   - Skin: **Without Skin**（アニメーションデータのみ）
   - Frames per Second: **30**
7. ダウンロードしたファイルを `public/models/` に配置

## 開発サーバー

```sh
bun run --filter @hackz/r3f-demo dev
# http://localhost:5176
```
