variable "app_name" {
  description = "Application name prefix for all resources"
  type        = string
  default     = "hackz-nulab-26"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "s3_uploads_bucket_name" {
  description = "S3 bucket name for user-uploaded photos"
  type        = string
  default     = "hackz-nulab-26-uploads"
}

variable "s3_contents_bucket_name" {
  description = "S3 bucket name for system content (card images, etc.) — read-only"
  type        = string
  default     = "hackz-nulab-26-contents"
}

variable "s3_frontend_bucket_name" {
  description = "S3 bucket name for frontend static assets (admin / mobile / projector)"
  type        = string
  default     = "hackz-nulab-26-frontend"
}

variable "jwt_secret" {
  description = "JWT signing secret for authentication (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for ALB HTTPS listener (port 443). Leave empty to disable HTTPS on ALB."
  type        = string
  default     = ""
}
