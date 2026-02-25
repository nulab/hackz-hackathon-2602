#state管理用ファイル。Stateの記録をS3に吐き出す

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Stateファイルの保存先（事前に作成したバケット名を指定）
  backend "s3" {
    bucket         = "mtfstate-20260225"
    key            = "terraform/terraform.tfstate"
    region         = "ap-northeast-1"
  }
}

provider "aws" {
  region = "ap-northeast-1"
}
