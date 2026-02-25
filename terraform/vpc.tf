# ============================================================
# VPC — ALB + ECS 用ネットワーク
#
# サブネット構成:
#   public[0]  10.0.1.0/24  AZ1  — ALB 用パブリック
#   public[1]  10.0.3.0/24  AZ2  — ALB 用パブリック（ALB は 2 AZ 必須）
#   private    10.0.2.0/24  AZ2  — ECS 用プライベート
#
# ECS はプライベートサブネットに配置。
# NAT Gateway 経由で ECR / DynamoDB / S3 / Bedrock / Secrets Manager にアクセス。
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

# ALB: インターネットから HTTP(80) / HTTPS(443) を許可
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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
