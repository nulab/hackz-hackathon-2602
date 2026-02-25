# ============================================================
# ECS — Fargate でHono サーバーを実行
# desired_count = 1（EventEmitter をシングルインスタンスで保証）
# ============================================================

resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"

  tags = {
    App = var.app_name
  }
}

resource "aws_cloudwatch_log_group" "ecs_server" {
  name              = "/ecs/${var.app_name}-server"
  retention_in_days = 7

  tags = {
    App = var.app_name
  }
}

resource "aws_ecs_task_definition" "server" {
  family                   = "${var.app_name}-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024" # 1 vCPU
  memory                   = "2048" # 2 GB
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "server"
      image = "${aws_ecr_repository.server.repository_url}:latest"

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "S3_UPLOADS_BUCKET", value = var.s3_uploads_bucket_name },
        { name = "S3_CONTENTS_BUCKET", value = var.s3_contents_bucket_name },
        { name = "PORT", value = "3000" }
      ]

      # JWT_SECRET は Secrets Manager から注入（平文を環境変数に含めない）
      secrets = [
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.app_name}-server"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = {
    App = var.app_name
  }
}

resource "aws_ecs_service" "server" {
  name            = "${var.app_name}-server"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.server.arn
  desired_count   = 1 # EventEmitter をシングルインスタンスで保証
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false # プライベートサブネット + NAT Gateway 経由でアクセス
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.server.arn
    container_name   = "server"
    container_port   = 3000
  }

  # ECR イメージ更新時は手動デプロイ or CI/CD で force-new-deployment
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_lb_listener.server]

  tags = {
    App = var.app_name
  }
}
