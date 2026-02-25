# ============================================================
# DynamoDB Tables
# init-dynamodb.ts の定義と完全一致させること
# ============================================================

resource "aws_dynamodb_table" "users" {
  name         = "Users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "nfcId"
    type = "S"
  }

  global_secondary_index {
    name            = "nfcId-index"
    hash_key        = "nfcId"
    projection_type = "ALL"
  }

  tags = {
    App = var.app_name
  }
}

resource "aws_dynamodb_table" "costumes" {
  name         = "Costumes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "rarity"
    type = "S"
  }

  global_secondary_index {
    name            = "rarity-index"
    hash_key        = "rarity"
    projection_type = "ALL"
  }

  tags = {
    App = var.app_name
  }
}

resource "aws_dynamodb_table" "user_costumes" {
  name         = "UserCostumes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "costumeId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "costumeId"
    type = "S"
  }

  tags = {
    App = var.app_name
  }
}

resource "aws_dynamodb_table" "costume_builds" {
  name         = "CostumeBuilds"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "buildId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "buildId"
    type = "S"
  }

  tags = {
    App = var.app_name
  }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "Sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    App = var.app_name
  }
}
