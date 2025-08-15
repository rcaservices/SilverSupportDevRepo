# File: infrastructure/terraform/main.tf
# Complete Production AWS Infrastructure for SilverSupport

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
  
  # Optional: Use S3 backend for state management
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "silversupport/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

# Configure AWS Provider
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "SilverSupport"
      Environment = var.environment
      Owner       = "SilverSupport-Team"
      ManagedBy   = "Terraform"
      CostCenter  = "Production"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "ai-support-project"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "silverzupport.us"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "silversupport"
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 20
}

variable "desired_capacity" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for production resources"
  type        = bool
  default     = true
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Use first 3 AZs for high availability
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Domain configuration
  api_domain    = "api.${var.domain_name}"
  admin_domain  = "admin.${var.domain_name}"
  alpha_domain  = var.environment == "production" ? var.domain_name : "${var.environment}.${var.domain_name}"
  
  # Common tags
  common_tags = {
    Project     = "SilverSupport"
    Environment = var.environment
    Terraform   = "true"
  }
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Public Subnets (for ALB)
resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Type = "Public"
    Tier = "Web"
  })
}

# Private Subnets (for ECS and RDS)
resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Type = "Private"
    Tier = "Application"
  })
}

# Database Subnets (isolated)
resource "aws_subnet" "database" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 20}.0/24"
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-${count.index + 1}"
    Type = "Database"
    Tier = "Data"
  })
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = length(local.azs)

  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "main" {
  count = length(local.azs)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-gw-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table" "private" {
  count = length(local.azs)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
  })
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# S3 Buckets
resource "aws_s3_bucket" "voice_recordings" {
  bucket = "${local.name_prefix}-voice-recordings"

  tags = local.common_tags
}

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name_prefix}-logs"

  tags = local.common_tags
}

resource "aws_s3_bucket" "backups" {
  bucket = "${local.name_prefix}-backups"

  tags = local.common_tags
}

# S3 Bucket Configurations
resource "aws_s3_bucket_versioning" "voice_recordings" {
  bucket = aws_s3_bucket.voice_recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "voice_recordings" {
  bucket = aws_s3_bucket.voice_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "voice_recordings" {
  bucket = aws_s3_bucket.voice_recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Lifecycle configurations
resource "aws_s3_bucket_lifecycle_configuration" "voice_recordings" {
  bucket = aws_s3_bucket.voice_recordings.id

  rule {
    id     = "voice_recording_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555 # 7 years for compliance
    }
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/application/${local.name_prefix}"
  retention_in_days = 14

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "s3_bucket_voice_recordings" {
  description = "Name of the voice recordings S3 bucket"
  value       = aws_s3_bucket.voice_recordings.bucket
}

output "s3_bucket_logs" {
  description = "Name of the logs S3 bucket"
  value       = aws_s3_bucket.logs.bucket
}

output "s3_bucket_backups" {
  description = "Name of the backups S3 bucket"
  value       = aws_s3_bucket.backups.bucket
}

output "cloudwatch_log_group_ecs" {
  description = "Name of the ECS CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "cloudwatch_log_group_application" {
  description = "Name of the application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application.name
}

# Add these to your main.tf file
data "aws_region" "current" {}
