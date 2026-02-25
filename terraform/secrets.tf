# ============================================================
# AWS Secrets Manager — JWT 署名キーの管理
# ============================================================

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.app_name}/jwt-secret"
  description             = "JWT signing secret for ${var.app_name}"
  recovery_window_in_days = 0 # ハッカソン用途のため即時削除を許可

  tags = {
    App = var.app_name
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}
