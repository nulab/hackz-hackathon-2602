# ============================================================
# Amplify — フロントエンド（admin / mobile / projector）
#
# モノレポ構成で 3 つのアプリをまとめてビルド・ホスト
# - /admin/     → apps/admin  (NFC 管理画面)
# - /mobile/    → apps/mobile (来場者スマホ画面)
# - /projector/ → apps/projector (プロジェクター画面)
#
# 【フロントエンドコードの修正が必要】
# 現在 trpc-provider.tsx の API_URL が localhost:3000 にハードコードされている。
# 環境変数を使うよう修正すること:
#   const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/trpc";
# ============================================================

resource "aws_amplify_app" "frontend" {
  name       = var.app_name
  repository = var.github_repository_url

  # GitHub に接続する場合は github_access_token を設定
  # 空の場合は Amplify コンソールで手動接続
  access_token = var.github_access_token != "" ? var.github_access_token : null

  iam_service_role_arn = aws_iam_role.amplify_service.arn

  # ビルドスペック: Bun でモノレポ全体をビルドし _site/ に集約
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - curl -fsSL https://bun.sh/install | bash
            - export BUN_INSTALL="$HOME/.bun"
            - export PATH="$BUN_INSTALL/bin:$PATH"
            - bun install --frozen-lockfile
        build:
          commands:
            - bun run build
            - mkdir -p _site/admin _site/mobile _site/projector
            - cp -r apps/admin/dist/* _site/admin/
            - cp -r apps/mobile/dist/* _site/mobile/
            - cp -r apps/projector/dist/* _site/projector/
      artifacts:
        baseDirectory: _site
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT

  # 各 SPA のキャッチオールリダイレクト（TanStack Router のクライアントサイドルーティング用）
  custom_rule {
    source = "/admin/<*>"
    target = "/admin/index.html"
    status = "200"
  }

  custom_rule {
    source = "/mobile/<*>"
    target = "/mobile/index.html"
    status = "200"
  }

  custom_rule {
    source = "/projector/<*>"
    target = "/projector/index.html"
    status = "200"
  }

  # フォールバック: ルートアクセスは 404
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404"
  }

  # フロントエンドに注入する環境変数
  environment_variables = {
    # App Runner の URL を Vite ビルド時に埋め込む
    VITE_API_URL = "https://${aws_apprunner_service.server.service_url}/trpc"
  }

  tags = {
    App = var.app_name
  }
}

# main ブランチを本番環境として設定
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"

  framework = "React"
  stage     = "PRODUCTION"

  enable_auto_build = true

  environment_variables = {
    VITE_API_URL = "https://${aws_apprunner_service.server.service_url}/trpc"
  }
}
