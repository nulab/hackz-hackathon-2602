# ============================================================
# App Runner — Hono + tRPC バックエンドサーバー
#
# 【初回デプロイ手順】
# 1. terraform apply で ECR リポジトリを先に作成:
#    terraform apply -target=aws_ecr_repository.server
#
# 2. Docker イメージをビルドして ECR へプッシュ:
#    aws ecr get-login-password --region ap-northeast-1 \
#      | docker login --username AWS --password-stdin <ecr_url>
#    docker build -t <ecr_url>:latest .
#    docker push <ecr_url>:latest
#
# 3. 残りのリソースを作成:
#    terraform apply
#
# 以降は ECR へ :latest タグをプッシュするたびに App Runner が自動デプロイ
# ============================================================

resource "aws_apprunner_service" "server" {
  service_name = "${var.app_name}-server"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_configuration {
        port = "3000"

        runtime_environment_variables = {
          AWS_REGION              = var.aws_region
          S3_UPLOADS_BUCKET       = var.s3_uploads_bucket_name
          S3_CONTENTS_BUCKET      = var.s3_contents_bucket_name
          PORT                    = "3000"
        }

        # JWT_SECRET は Secrets Manager から注入（平文を環境変数に含めない）
        runtime_environment_secrets = {
          JWT_SECRET = aws_secretsmanager_secret.jwt_secret.arn
        }
      }

      # ECR リポジトリの :latest タグを使用
      # image_identifier は CI/CD で ECR へプッシュした後に管理されるため ignore_changes で除外
      image_identifier      = "${aws_ecr_repository.server.repository_url}:latest"
      image_repository_type = "ECR"
    }

    # ECR へ :latest をプッシュすると自動デプロイ
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  lifecycle {
    # ECR へのイメージプッシュによる自動デプロイに任せるため
    # Terraform からのイメージ更新は無視する
    ignore_changes = [source_configuration[0].image_repository[0].image_identifier]
  }

  tags = {
    App = var.app_name
  }
}
