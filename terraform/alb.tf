# ============================================================
# ALB — Hono サーバーへの HTTP / HTTPS ロードバランサー
# idle_timeout = 60s（デフォルトのアイドルタイムアウト）
#
# HTTPS リスナー:
#   var.acm_certificate_arn が設定されている場合のみ有効化
#   未設定時は HTTP(80) のみで動作（CloudFront → ALB は http-only のため影響なし）
# ============================================================

resource "aws_lb" "server" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # デフォルトのアイドルタイムアウト
  idle_timeout = 60

  tags = {
    App = var.app_name
  }
}

resource "aws_lb_target_group" "server" {
  name        = "${var.app_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # Fargate は ip ターゲットタイプを使用

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = {
    App = var.app_name
  }
}

# HTTP リスナー（port 80）
resource "aws_lb_listener" "server" {
  load_balancer_arn = aws_lb.server.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.server.arn
  }
}

# HTTPS リスナー（port 443）— acm_certificate_arn が設定されている場合のみ作成
resource "aws_lb_listener" "server_https" {
  count             = var.acm_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.server.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.server.arn
  }
}
