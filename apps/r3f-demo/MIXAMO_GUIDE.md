# Mixamo モーション追加手順

## 前提

- ベースモデル: `womam_with_born_1000.fbx`（ボーン付き3Dモデル）
- Mixamo にアップロード済みであること

## 手順

### 1. Mixamo でモーションを選ぶ

1. https://www.mixamo.com/ にログイン
2. 左メニューの **Animations** タブでモーションを検索
3. プレビューで確認し、好みのモーションを選択

### 2. FBX をダウンロード

1. 右側の **DOWNLOAD** ボタンをクリック
2. 設定:
   - **Format**: FBX Binary (.fbx)
   - **Skin**: **With Skin** を選択（重要！Without Skin だと表示できない）
   - **Frames per Second**: 30
   - **Keyframe Reduction**: none
3. ダウンロード

### 3. ファイルを配置

ダウンロードした FBX を以下に配置:

```
apps/r3f-demo/public/models/<モーション名>.fbx
```

例: `SambaWithSkin.fbx`, `HipHopWithSkin.fbx`

### 4. コードに追加

`apps/r3f-demo/src/components/DancingModel.tsx` のアニメーション読み込み部分に追加:

```typescript
// 既存のCapoeiraの下に追加
const samba = await loadAnimationFromFBX("/models/SambaWithSkin.fbx");
if (samba) {
  samba.name = "Samba";
  allClips.push(samba);
}
```

追加するだけでクリックでの切り替え対象に含まれる。

## 現在登録済みモーション

| ファイル               | モーション名 | 用途                                    |
| ---------------------- | ------------ | --------------------------------------- |
| `KissWithSkin.fbx`     | Kiss         | ベースモデル（メッシュ+アニメーション） |
| `CapoeiraWithSkin.fbx` | Capoeira     | 追加アニメーション                      |

## 注意事項

- **必ず With Skin でダウンロードする**（Without Skin はメッシュがなく表示不可）
- 全モーションは同じ Mixamo スケルトンを使うのでリターゲット不要
- `KissWithSkin.fbx` はベースモデルとしても使用（メッシュ+テクスチャの元）。変更する場合はテクスチャ適用にも影響あり
