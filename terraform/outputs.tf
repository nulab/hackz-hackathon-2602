# ============================================================
# Outputs — 各リソースの重要な値を出力
# ============================================================

# ------ CloudFront ------
output "cloudfront_domain" {
  description = "CloudFront ドメイン名（フロントエンド + API プロキシ）"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront ディストリビューション ID（キャッシュ無効化に使用）"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_urls" {
  description = "各フロントエンドアプリの URL"
  value = {
    admin     = "https://${aws_cloudfront_distribution.frontend.domain_name}/admin/"
    mobile    = "https://${aws_cloudfront_distribution.frontend.domain_name}/mobile/"
    projector = "https://${aws_cloudfront_distribution.frontend.domain_name}/projector/"
  }
}

# ------ ALB ------
output "alb_dns_name" {
  description = "ALB の DNS 名（CloudFront のオリジンとして使用）"
  value       = aws_lb.server.dns_name
}

# ------ ECS ------
output "ecs_cluster_name" {
  description = "ECS クラスター名"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS サービス名（force-new-deployment 時に使用）"
  value       = aws_ecs_service.server.name
}

output "ecs_deploy_command" {
  description = "ECR への新しいイメージ push 後に ECS を再デプロイするコマンド"
  value       = "aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.server.name} --force-new-deployment --region ${var.aws_region}"
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
output "s3_frontend_bucket_name" {
  description = "フロントエンド静的ファイル用 S3 バケット名"
  value       = aws_s3_bucket.frontend.bucket
}

output "s3_uploads_bucket_name" {
  description = "アップロードバケット名（ユーザー写真）"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_contents_bucket_name" {
  description = "コンテンツバケット名（システム素材・読み取り専用）"
  value       = aws_s3_bucket.contents.bucket
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
