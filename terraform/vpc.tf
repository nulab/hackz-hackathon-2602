# ============================================================
# VPC — ALB + ECS 用ネットワーク
#
# サブネット構成:
#   public[0]  10.0.1.0/24  AZ1  — ALB 用パブリック
#   public[1]  10.0.3.0/24  AZ2  — ALB 用パブリック（ALB は 2 AZ 必須）
#   private    10.0.2.0/24  AZ2  — ECS 用プライベート
#
# ECS はプライベートサブネットに配置。
# VPC Endpoint 経由で ECR / S3 / Secrets Manager / CloudWatch Logs にアクセス。
# NAT Gateway はその他のアウトバウンド通信（Bedrock 等）に使用。
# ============================================================

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.app_name}-vpc"
    App  = var.app_name
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.app_name}-igw"
    App  = var.app_name
  }
}

# ----------------------------------------------------------
# パブリックサブネット × 2 AZ（ALB 配置用）
# index 0 → 10.0.1.0/24 (AZ1)
# index 1 → 10.0.3.0/24 (AZ2)
# ----------------------------------------------------------
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = count.index == 0 ? "10.0.1.0/24" : "10.0.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.app_name}-public-${count.index + 1}"
    App  = var.app_name
  }
}

# ----------------------------------------------------------
# プライベートサブネット（ECS 配置用）
# 10.0.2.0/24 (AZ2) — NAT Gateway 経由でインターネットへ
# ----------------------------------------------------------
resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${var.app_name}-private-1"
    App  = var.app_name
  }
}

# ----------------------------------------------------------
# パブリックルートテーブル（IGW 経由でインターネットへ）
# ----------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-public-rt"
    App  = var.app_name
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ----------------------------------------------------------
# NAT Gateway（プライベートサブネットからのアウトバウンド用）
# パブリックサブネット AZ1 に配置
# ----------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.app_name}-nat-eip"
    App  = var.app_name
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.app_name}-nat"
    App  = var.app_name
  }

  depends_on = [aws_internet_gateway.main]
}

# ----------------------------------------------------------
# プライベートルートテーブル（NAT Gateway 経由）
# ----------------------------------------------------------
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-private-rt"
    App  = var.app_name
  }
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}

# ----------------------------------------------------------
# セキュリティグループ
# ----------------------------------------------------------

# ALB: VPC 内から HTTP(80) / HTTPS(443) を許可（CloudFront VPC Origin 経由）
# インターネットからの直接アクセスは不可
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    description = "HTTP from VPC (CloudFront VPC Origin)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  ingress {
    description = "HTTPS from VPC (CloudFront VPC Origin)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-alb-sg"
    App  = var.app_name
  }
}

# ECS: ALB セキュリティグループからのみポート 3000 を許可
resource "aws_security_group" "ecs" {
  name   = "${var.app_name}-ecs-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    description     = "App port from ALB only"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound (ECR pull, DynamoDB, S3, Bedrock, Secrets Manager)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-ecs-sg"
    App  = var.app_name
  }
}

# ----------------------------------------------------------
# VPC Endpoints — Fargate タスク起動に必要な AWS サービス接続
#
# Interface Endpoint: ECR API / ECR DKR / Secrets Manager / CloudWatch Logs
# Gateway Endpoint:   S3（ECR イメージレイヤーの取得に必要）
#
# これにより NAT Gateway に依存せず AWS サービスにアクセスできる。
# ----------------------------------------------------------

# Interface Endpoint 用セキュリティグループ（プライベートサブネットから HTTPS を許可）
resource "aws_security_group" "vpc_endpoints" {
  name   = "${var.app_name}-vpce-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    description = "HTTPS from private subnet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_subnet.private.cidr_block]
  }

  tags = {
    Name = "${var.app_name}-vpce-sg"
    App  = var.app_name
  }
}

# ECR API — イメージメタデータ取得
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.app_name}-ecr-api"
    App  = var.app_name
  }
}

# ECR DKR — Docker イメージ pull
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.app_name}-ecr-dkr"
    App  = var.app_name
  }
}

# Secrets Manager — JWT_SECRET 取得
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.app_name}-secretsmanager"
    App  = var.app_name
  }
}

# CloudWatch Logs — コンテナログ送信
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.private.id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.app_name}-logs"
    App  = var.app_name
  }
}

# S3 — ECR イメージレイヤーは S3 に保存されている（Gateway 型 = 無料）
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "${var.app_name}-s3"
    App  = var.app_name
  }
}
