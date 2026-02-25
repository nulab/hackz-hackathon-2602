# ============================================================
# ALB — Hono サーバーへの HTTP ロードバランサー
# idle_timeout = 300s（SSE 長時間接続に対応）
# ============================================================

resource "aws_lb" "server" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # SSE サブスクリプションの長時間接続に対応するため 300 秒に設定
  idle_timeout = 300

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

resource "aws_lb_listener" "server" {
  load_balancer_arn = aws_lb.server.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.server.arn
  }
}
