# ============================================================
# IAM — App Runner 用ロール / Amplify 用ロール
# ============================================================

# ----------------------------------------------------------
# App Runner: ECR からイメージをプル（ビルドロール）
# trust: build.apprunner.amazonaws.com
# ----------------------------------------------------------
resource "aws_iam_role" "apprunner_ecr_access" {
  name = "${var.app_name}-apprunner-ecr-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    App = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ----------------------------------------------------------
# App Runner: インスタンスロール（サービス実行時の権限）
# trust: tasks.apprunner.amazonaws.com
# DynamoDB / S3 / Bedrock / Secrets Manager へのアクセス権を付与
# ----------------------------------------------------------
resource "aws_iam_role" "apprunner_instance" {
  name = "${var.app_name}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    App = var.app_name
  }
}

resource "aws_iam_role_policy" "apprunner_instance" {
  name = "${var.app_name}-apprunner-instance-policy"
  role = aws_iam_role.apprunner_instance.id

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
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
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
      # Bedrock アクセス（顔検出・画像合成）
      {
        Sid      = "Bedrock"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
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

# ----------------------------------------------------------
# Amplify サービスロール（Amplify コンソールからのデプロイ用）
# ----------------------------------------------------------
resource "aws_iam_role" "amplify_service" {
  name = "${var.app_name}-amplify-service"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "amplify.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    App = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "amplify_service" {
  role       = aws_iam_role.amplify_service.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}
