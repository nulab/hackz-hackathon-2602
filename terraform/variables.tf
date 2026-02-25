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

variable "github_repository_url" {
  description = "GitHub repository URL for Amplify connection (e.g. https://github.com/org/repo)"
  type        = string
  default     = "https://github.com/yuukiiyotani/hackz-hackathon-2602"
}

variable "github_access_token" {
  description = "GitHub Personal Access Token for Amplify (scope: repo). Leave empty to connect manually via Amplify console."
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT signing secret for authentication (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "apprunner_cpu" {
  description = "App Runner vCPU allocation"
  type        = string
  default     = "1 vCPU"
}

variable "apprunner_memory" {
  description = "App Runner memory allocation"
  type        = string
  default     = "2 GB"
}
