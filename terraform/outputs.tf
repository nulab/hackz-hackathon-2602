# ============================================================
# Outputs — 各リソースの重要な値を出力
# ============================================================

# ------ App Runner ------
output "apprunner_service_url" {
  description = "App Runner サービスの URL（HTTPS）"
  value       = "https://${aws_apprunner_service.server.service_url}"
}

output "apprunner_service_id" {
  description = "App Runner サービス ID"
  value       = aws_apprunner_service.server.service_id
}

# ------ ECR ------
output "ecr_repository_url" {
  description = "ECR リポジトリ URL（docker push 先）"
  value       = aws_ecr_repository.server.repository_url
}

output "ecr_docker_login_command" {
  description = "ECR へのログインコマンド"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.server.repository_url}"
}

# ------ S3 ------
output "s3_uploads_bucket_name" {
  description = "アップロードバケット名（ユーザー写真）"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_contents_bucket_name" {
  description = "コンテンツバケット名（システム素材・読み取り専用）"
  value       = aws_s3_bucket.contents.bucket
}

# ------ Amplify ------
output "amplify_app_id" {
  description = "Amplify アプリ ID"
  value       = aws_amplify_app.frontend.id
}

output "amplify_default_domain" {
  description = "Amplify のデフォルトドメイン"
  value       = "https://main.${aws_amplify_app.frontend.default_domain}"
}

output "amplify_app_urls" {
  description = "各フロントエンドアプリの URL"
  value = {
    admin     = "https://main.${aws_amplify_app.frontend.default_domain}/admin/"
    mobile    = "https://main.${aws_amplify_app.frontend.default_domain}/mobile/"
    projector = "https://main.${aws_amplify_app.frontend.default_domain}/projector/"
  }
}

# ------ DynamoDB ------
output "dynamodb_table_arns" {
  description = "DynamoDB テーブル ARN 一覧"
  value = {
    users          = aws_dynamodb_table.users.arn
    costumes       = aws_dynamodb_table.costumes.arn
    user_costumes  = aws_dynamodb_table.user_costumes.arn
    costume_builds = aws_dynamodb_table.costume_builds.arn
    sessions       = aws_dynamodb_table.sessions.arn
  }
}

# ------ Secrets Manager ------
output "jwt_secret_arn" {
  description = "JWT シークレットの ARN"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}
