# ============================================================
# CloudFront + S3 — フロントエンド静的ホスティング
#
# 構成:
#   デフォルト動作   → S3（admin / mobile / projector 静的ファイル）
#   /trpc/*         → ALB（Hono バックエンド API）VPC Origin 経由
#
# VPC Origin:
#   CloudFront → 内部 ALB をプライベート接続（インターネット経由なし）
#   ALB はパブリックサブネットに配置しつつ internal = true
#
# SPA ルーティング:
#   CloudFront Function で拡張子なしパスを各アプリの index.html に書き換え
#   例: /admin/scan → /admin/index.html
# ============================================================

# ----------------------------------------------------------
# S3 バケット（フロントエンド静的ファイル）
# CloudFront OAC 経由のみアクセス可能。パブリックアクセスは無効
# ----------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket = var.s3_frontend_bucket_name

  tags = {
    App = var.app_name
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ----------------------------------------------------------
# CloudFront Origin Access Control（OAC）
# S3 バケットへのアクセスを CloudFront のみに制限
# ----------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.app_name}-frontend-oac"
  description                       = "OAC for ${var.app_name} frontend S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 バケットポリシー（CloudFront OAC からの GetObject のみ許可）
resource "aws_s3_bucket_policy" "frontend" {
  bucket     = aws_s3_bucket.frontend.id
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# ----------------------------------------------------------
# CloudFront Function — SPA ルーティング
# 拡張子なしパスを各アプリの index.html に書き換える
# /trpc/* は書き換えしない（ALB へそのまま転送）
# ----------------------------------------------------------
resource "aws_cloudfront_function" "spa_routing" {
  name    = "${var.app_name}-spa-routing"
  runtime = "cloudfront-js-2.0"
  comment = "SPA routing: rewrite extensionless paths to each app's index.html"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // API パスはそのまま転送
      if (uri.startsWith('/trpc')) return request;

      // 末尾スラッシュは index.html を補完
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
        return request;
      }

      // 拡張子なしパスは各アプリの index.html に書き換え
      // admin / projector は vite.config.ts の base に合わせたパス
      // mobile は base 未設定のためルートの index.html
      if (!uri.includes('.')) {
        if (uri.startsWith('/hackz-hackathon-2602/admin')) {
          request.uri = '/hackz-hackathon-2602/admin/index.html';
        } else if (uri.startsWith('/hackz-hackathon-2602/projector')) {
          request.uri = '/hackz-hackathon-2602/projector/index.html';
        } else {
          request.uri = '/index.html';
        }
      }

      return request;
    }
  EOT
}

# ----------------------------------------------------------
# CloudFront VPC Origin — 内部 ALB へのプライベート接続
# ----------------------------------------------------------
resource "aws_cloudfront_vpc_origin" "alb" {
  vpc_origin_endpoint_config {
    name                   = "${var.app_name}-alb-vpc-origin"
    arn                    = aws_lb.server.arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }

  tags = {
    App = var.app_name
  }
}

# ----------------------------------------------------------
# CloudFront ディストリビューション
# ----------------------------------------------------------
locals {
  s3_origin_id  = "${var.app_name}-s3-origin"
  alb_origin_id = "${var.app_name}-alb-origin"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.app_name} frontend + API proxy"

  # Origin 1: S3（静的フロントエンド）
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: ALB（Hono バックエンド）— VPC Origin 経由でプライベート接続
  origin {
    domain_name = aws_lb.server.dns_name
    origin_id   = local.alb_origin_id

    vpc_origin_config {
      vpc_origin_id            = aws_cloudfront_vpc_origin.alb.id
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  # ----------------------------------------------------------
  # デフォルト動作: S3 静的ファイル配信
  # CloudFront Function で SPA ルーティングを処理
  # ----------------------------------------------------------
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routing.arn
    }
  }

  # ----------------------------------------------------------
  # /trpc/* → ALB（バックエンド API・SSE）
  # キャッシュ無効・ストリーミング対応
  # ----------------------------------------------------------
  ordered_cache_behavior {
    path_pattern           = "/trpc/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.alb_origin_id
    viewer_protocol_policy = "https-only"
    compress               = false # SSE はレスポンス圧縮を無効化

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Accept", "Content-Type", "Cache-Control"]
      cookies {
        forward = "none"
      }
    }

    # キャッシュ完全無効（SSE・認証 API 用）
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # デフォルトの CloudFront ドメイン（*.cloudfront.net）を使用
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    App = var.app_name
  }
}
