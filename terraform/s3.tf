# ============================================================
# S3 Buckets
#
# hackz-nulab-26-contents  … システムコンテンツ（カード画像等）読み取り専用
# hackz-nulab-26-uploads   … ユーザーアップロード画像（書き込み・読み取り）
# ============================================================

# ----------------------------------------------------------
# コンテンツバケット（システムが管理するオリジナル素材）
# - 読み取り専用（App Runner は GetObject のみ）
# - フロントエンドからの直接アクセスを許可
# ----------------------------------------------------------
resource "aws_s3_bucket" "contents" {
  bucket = var.s3_contents_bucket_name

  tags = {
    App = var.app_name
  }
}

resource "aws_s3_bucket_public_access_block" "contents" {
  bucket = aws_s3_bucket.contents.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "contents_public_read" {
  bucket     = aws_s3_bucket.contents.id
  depends_on = [aws_s3_bucket_public_access_block.contents]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.contents.arn}/*"
      }
    ]
  })
}

# ----------------------------------------------------------
# アップロードバケット（ユーザーが投稿した写真）
# - App Runner が書き込み
# - フロントエンドからの直接アクセスを許可（画像表示用）
# ----------------------------------------------------------
resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_uploads_bucket_name

  tags = {
    App = var.app_name
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "uploads_public_read" {
  bucket     = aws_s3_bucket.uploads.id
  depends_on = [aws_s3_bucket_public_access_block.uploads]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
      }
    ]
  })
}
