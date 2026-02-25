# Conditional ECR Push — Design Document

## 概要

ECR push を Docker Image ID（content-addressable hash）ベースで条件付き実行にする。ビルドは毎回実行してビルド健全性を担保しつつ、イメージ内容に変更がない場合は push と ECS デプロイをスキップする。

## 背景

現状 `ecr-push.yml` は main への push のたびに Docker build → ECR push → ECS force-deploy を実行している。フロントエンドのみの変更でもサーバーの再デプロイが走るのは無駄。

## アプローチ

Docker の **Image ID** (`sha256:...`) はイメージ config の content-addressable hash で、イメージの中身が変わらなければ同じ値になる。これを GitHub Actions Cache に保存して前回と比較する。

## ワークフロー

```
1. checkout + setup buildx
2. Build (push: false, load: true) → imageid 出力を取得
3. GHA cache から前回の imageid を restore
4. 比較
   - 同じ → skip push, skip deploy
   - 違う or cache miss → push + deploy
5. [push する場合]
   - AWS credentials 設定 + ECR login
   - docker tag + docker push
   - ECS force-new-deployment
   - 新 imageid を cache に保存
```

## 設計判断

### AWS credentials のタイミング

push が必要な場合のみ AWS credentials を設定する。不要な OIDC トークン取得を省く。

### push の方法

`load: true` でローカルにロードした後、`docker tag` + `docker push` で直接 push する。`docker/build-push-action` を2回呼ぶより明快。

### Cache key の設計

`actions/cache` は同一 key で上書き不可のため、`actions/cache/restore` と `actions/cache/save` を分離:

- **restore:** `restore-keys: docker-imageid-` で prefix マッチ（最新を取得）
- **save:** `key: docker-imageid-${{ github.run_id }}` で一意に保存

### Cache miss 時の動作

安全側に倒して push する（変更ありとみなす）。

## 変更の影響範囲

- **変更ファイル:** `.github/workflows/ecr-push.yml` のみ
- **既存の動作:** ビルドは毎回走る。push/deploy だけが条件付きになる
- **`workflow_dispatch`:** 手動実行時は cache miss になりやすいので push される（安全側）
