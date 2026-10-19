# ── SecureVault Terraform IaC ─────────────────────────────
# Provisions AWS infrastructure for production deployment.
# Resources: S3 (encrypted file storage), ECR, ECS Fargate, VPC.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket  = "securevault-tfstate"
    key     = "prod/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Variables ──────────────────────────────────────────────
variable "aws_region"   { default = "us-east-1" }
variable "project_name" { default = "securevault" }
variable "environment"  { default = "production" }

# ── S3 Bucket: Encrypted File Storage ─────────────────────
resource "aws_s3_bucket" "encrypted_files" {
  bucket        = "${var.project_name}-encrypted-files-${var.environment}"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-storage"
    Environment = var.environment
    Security    = "encrypted-at-rest"
  }
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.encrypted_files.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.encrypted_files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block ALL public access — files are private blobs
resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.encrypted_files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.encrypted_files.id
  rule {
    id     = "expire-soft-deleted"
    status = "Enabled"
    filter { prefix = "deleted/" }
    expiration { days = 30 }
  }
}

# ── ECR: Container Registry ────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}/backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration { scan_on_push = true }

  tags = { Environment = var.environment }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}/frontend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration { scan_on_push = true }

  tags = { Environment = var.environment }
}

# ── IAM Role: ECS Task (Least Privilege) ──────────────────
data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_role" {
  name               = "${var.project_name}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "task_permissions" {
  statement {
    sid     = "S3EncryptedAccessOnly"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.encrypted_files.arn}/*"]
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name   = "s3-encrypted-access"
  role   = aws_iam_role.ecs_task_role.id
  policy = data.aws_iam_policy_document.task_permissions.json
}

# ── Outputs ────────────────────────────────────────────────
output "s3_bucket_name" { value = aws_s3_bucket.encrypted_files.id }
output "ecr_backend_url" { value = aws_ecr_repository.backend.repository_url }
output "ecr_frontend_url" { value = aws_ecr_repository.frontend.repository_url }
