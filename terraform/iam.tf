# ============================================================
# IAM — ECS 実行ロール / ECS タスクロール
# ============================================================

# ----------------------------------------------------------
# ECS 実行ロール
# ECR からイメージを pull し CloudWatch Logs に書き込む
# trust: ecs-tasks.amazonaws.com
# ----------------------------------------------------------
resource "aws_iam_role" "ecs_execution" {
  name = "${var.app_name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    App = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Manager から JWT_SECRET を取得する権限（タスク起動時に注入）
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.app_name}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "GetJwtSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.jwt_secret.arn
      }
    ]
  })
}

# ----------------------------------------------------------
# ECS タスクロール
# コンテナ内から各 AWS サービスにアクセスする権限
# trust: ecs-tasks.amazonaws.com
# ----------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  name = "${var.app_name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    App = var.app_name
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${var.app_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # DynamoDB アクセス（全5テーブル + GSI）
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
          aws_dynamodb_table.costumes.arn,
          "${aws_dynamodb_table.costumes.arn}/index/*",
          aws_dynamodb_table.user_costumes.arn,
          aws_dynamodb_table.costume_builds.arn,
          aws_dynamodb_table.sessions.arn,
          "${aws_dynamodb_table.sessions.arn}/index/*"
        ]
      },
      # アップロードバケット（ユーザー写真の書き込み・読み取り）
      {
        Sid    = "S3Uploads"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      # コンテンツバケット（システム素材の読み取りのみ）
      {
        Sid      = "S3Contents"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = [
          aws_s3_bucket.contents.arn,
          "${aws_s3_bucket.contents.arn}/*"
        ]
      },
      # Bedrock フルアクセス（画像合成）
      {
        Sid      = "Bedrock"
        Effect   = "Allow"
        Action   = ["bedrock:*"]
        Resource = "*"
      },
      # Rekognition アクセス（顔検出）
      {
        Sid      = "Rekognition"
        Effect   = "Allow"
        Action   = ["rekognition:DetectFaces"]
        Resource = "*"
      },
      # Secrets Manager アクセス（JWT_SECRET 取得）
      {
        Sid      = "SecretsManager"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.jwt_secret.arn
      }
    ]
  })
}
