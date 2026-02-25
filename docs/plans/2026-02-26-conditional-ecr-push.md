# Conditional ECR Push Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ECR push をイメージ内容が変わったときだけ実行し、無駄なデプロイを省く

**Architecture:** Docker build は毎回実行（ビルド健全性チェック）。`docker/build-push-action` の `imageid` 出力を GHA cache に保存した前回値と比較し、変更時のみ push + ECS デプロイを実行する

**Tech Stack:** GitHub Actions, docker/build-push-action@v6, actions/cache/restore + save, AWS ECR/ECS

---

### Task 1: ecr-push.yml を条件付き push に書き換え

**Files:**

- Modify: `.github/workflows/ecr-push.yml`

**Step 1: ワークフロー全体を書き換え**

現在の `ecr-push.yml` を以下の内容に置き換える:

```yaml
name: ECR Push

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ecr-push
  cancel-in-progress: true

permissions:
  id-token: write # OIDC トークン取得に必要
  contents: read

jobs:
  push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image (without push)
        id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          load: true
          tags: hackz-server:local
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Restore previous image ID from cache
        id: cache-restore
        uses: actions/cache/restore@v4
        with:
          path: /tmp/docker-imageid
          key: docker-imageid-
          restore-keys: docker-imageid-

      - name: Check if image changed
        id: check
        run: |
          CURRENT_ID="${{ steps.build.outputs.imageid }}"
          echo "Current image ID: $CURRENT_ID"

          if [ -f /tmp/docker-imageid ]; then
            PREVIOUS_ID=$(cat /tmp/docker-imageid)
            echo "Previous image ID: $PREVIOUS_ID"
            if [ "$CURRENT_ID" = "$PREVIOUS_ID" ]; then
              echo "Image unchanged, skipping push"
              echo "changed=false" >> "$GITHUB_OUTPUT"
            else
              echo "Image changed, will push"
              echo "changed=true" >> "$GITHUB_OUTPUT"
            fi
          else
            echo "No previous image ID found (cache miss), will push"
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Configure AWS credentials
        if: steps.check.outputs.changed == 'true'
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_IAM_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}

      - name: Login to Amazon ECR
        if: steps.check.outputs.changed == 'true'
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Tag and push Docker image
        if: steps.check.outputs.changed == 'true'
        run: |
          REGISTRY="${{ steps.login-ecr.outputs.registry }}"
          REPO="${{ vars.ECR_REPOSITORY }}"
          docker tag hackz-server:local "$REGISTRY/$REPO:${{ github.sha }}"
          docker tag hackz-server:local "$REGISTRY/$REPO:latest"
          docker push "$REGISTRY/$REPO:${{ github.sha }}"
          docker push "$REGISTRY/$REPO:latest"

      - name: Deploy to ECS
        if: steps.check.outputs.changed == 'true'
        run: |
          aws ecs update-service \
            --cluster ${{ vars.ECS_CLUSTER }} \
            --service ${{ vars.ECS_SERVICE }} \
            --force-new-deployment

      - name: Write current image ID for cache
        if: steps.check.outputs.changed == 'true'
        run: |
          echo "${{ steps.build.outputs.imageid }}" > /tmp/docker-imageid

      - name: Save image ID to cache
        if: steps.check.outputs.changed == 'true'
        uses: actions/cache/save@v4
        with:
          path: /tmp/docker-imageid
          key: docker-imageid-${{ github.run_id }}
```

**Step 2: 書き換えた内容を目視確認**

以下のポイントを確認:

- `push: false` + `load: true` で buildx がローカルにイメージをロードすること
- `cache-from: type=gha` / `cache-to: type=gha,mode=max` が残っていること（ビルドキャッシュ）
- `if: steps.check.outputs.changed == 'true'` が push/deploy/cache save すべてに付いていること
- `actions/cache/restore@v4` の `restore-keys` が prefix マッチであること
- `actions/cache/save@v4` の `key` に `github.run_id` が含まれること

**Step 3: Commit**

```bash
git add .github/workflows/ecr-push.yml
git commit -m "feat: skip ECR push when Docker image unchanged

Compare image ID (content-addressable hash) with previous build
stored in GHA cache. Push and deploy only when image changes.
Build always runs to verify build health."
```
