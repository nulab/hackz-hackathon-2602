# ============================================================
# ECR — App Runner 用サーバー Docker イメージリポジトリ
# ============================================================

resource "aws_ecr_repository" "server" {
  name                 = "${var.app_name}-server"
  image_tag_mutability = "MUTABLE" # :latest タグを上書きできるようにする

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    App = var.app_name
  }
}

# 古いイメージを自動削除（最新 5 件を保持）
resource "aws_ecr_lifecycle_policy" "server" {
  repository = aws_ecr_repository.server.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
