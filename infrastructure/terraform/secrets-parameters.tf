# infrastructure/terraform/secrets-parameters.tf
# AWS SSM Parameter Store resources for secure secret management

locals {
  # Parameter name prefix
  parameter_prefix = "/${var.environment}/${var.project_name}"
}

# AI Service API Keys
resource "aws_ssm_parameter" "anthropic_api_key" {
  name        = "${local.parameter_prefix}/secrets/anthropic-api-key"
  description = "Anthropic API key for Claude AI service"
  type        = "SecureString"
  value       = var.anthropic_api_key
  
  tags = merge(local.common_tags, {
    Type = "api-key"
    Service = "anthropic"
  })
}

resource "aws_ssm_parameter" "openai_api_key" {
  name        = "${local.parameter_prefix}/secrets/openai-api-key"
  description = "OpenAI API key for Whisper transcription"
  type        = "SecureString"
  value       = var.openai_api_key
  
  tags = merge(local.common_tags, {
    Type = "api-key"
    Service = "openai"
  })
}

# Twilio Configuration
resource "aws_ssm_parameter" "twilio_account_sid" {
  name        = "${local.parameter_prefix}/secrets/twilio-account-sid"
  description = "Twilio Account SID"
  type        = "SecureString"
  value       = var.twilio_account_sid
  
  tags = merge(local.common_tags, {
    Type = "credential"
    Service = "twilio"
  })
}

resource "aws_ssm_parameter" "twilio_auth_token" {
  name        = "${local.parameter_prefix}/secrets/twilio-auth-token"
  description = "Twilio authentication token"
  type        = "SecureString"
  value       = var.twilio_auth_token
  
  tags = merge(local.common_tags, {
    Type = "credential"
    Service = "twilio"
  })
}

resource "aws_ssm_parameter" "twilio_phone_number" {
  name        = "${local.parameter_prefix}/config/twilio-phone-number"
  description = "Twilio phone number for support line"
  type        = "String"
  value       = var.twilio_phone_number
  
  tags = merge(local.common_tags, {
    Type = "config"
    Service = "twilio"
  })
}

# Database Configuration
resource "aws_ssm_parameter" "database_url" {
  name        = "${local.parameter_prefix}/secrets/database-url"
  description = "PostgreSQL database connection URL"
  type        = "SecureString"
  value       = var.database_url
  
  tags = merge(local.common_tags, {
    Type = "connection-string"
    Service = "postgresql"
  })
}

# Security Secrets
resource "aws_ssm_parameter" "jwt_secret" {
  name        = "${local.parameter_prefix}/secrets/jwt-secret"
  description = "JWT signing secret for authentication"
  type        = "SecureString"
  value       = var.jwt_secret
  
  tags = merge(local.common_tags, {
    Type = "signing-key"
    Service = "authentication"
  })
}

resource "aws_ssm_parameter" "encryption_key" {
  name        = "${local.parameter_prefix}/secrets/encryption-key"
  description = "Encryption key for sensitive data"
  type        = "SecureString"
  value       = var.encryption_key
  
  tags = merge(local.common_tags, {
    Type = "encryption-key"
    Service = "security"
  })
}

resource "aws_ssm_parameter" "session_secret" {
  name        = "${local.parameter_prefix}/secrets/session-secret"
  description = "Session secret for Express middleware"
  type        = "SecureString"
  value       = var.session_secret
  
  tags = merge(local.common_tags, {
    Type = "session-key"
    Service = "web-server"
  })
}

# Voice Authentication Service (Azure Speech)
resource "aws_ssm_parameter" "azure_speech_key" {
  count = var.azure_speech_key != "" ? 1 : 0
  
  name        = "${local.parameter_prefix}/secrets/azure-speech-key"
  description = "Azure Speech Service API key for voice authentication"
  type        = "SecureString"
  value       = var.azure_speech_key
  
  tags = merge(local.common_tags, {
    Type = "api-key"
    Service = "azure-speech"
  })
}

resource "aws_ssm_parameter" "azure_speech_region" {
  count = var.azure_speech_region != "" ? 1 : 0
  
  name        = "${local.parameter_prefix}/config/azure-speech-region"
  description = "Azure Speech Service region"
  type        = "String"
  value       = var.azure_speech_region
  
  tags = merge(local.common_tags, {
    Type = "config"
    Service = "azure-speech"
  })
}

# Email Service Configuration
resource "aws_ssm_parameter" "smtp_user" {
  count = var.smtp_user != "" ? 1 : 0
  
  name        = "${local.parameter_prefix}/secrets/smtp-user"
  description = "SMTP username for email notifications"
  type        = "SecureString"
  value       = var.smtp_user
  
  tags = merge(local.common_tags, {
    Type = "credential"
    Service = "smtp"
  })
}

resource "aws_ssm_parameter" "smtp_password" {
  count = var.smtp_password != "" ? 1 : 0
  
  name        = "${local.parameter_prefix}/secrets/smtp-password"
  description = "SMTP password for email notifications"
  type        = "SecureString"
  value       = var.smtp_password
  
  tags = merge(local.common_tags, {
    Type = "credential"
    Service = "smtp"
  })
}

# Redis Configuration (optional)
resource "aws_ssm_parameter" "redis_url" {
  count = var.redis_url != "" ? 1 : 0
  
  name        = "${local.parameter_prefix}/secrets/redis-url"
  description = "Redis connection URL for session storage"
  type        = "SecureString"
  value       = var.redis_url
  
  tags = merge(local.common_tags, {
    Type = "connection-string"
    Service = "redis"
  })
}

# Application Configuration (Message Limits)
resource "aws_ssm_parameter" "message_limits_config" {
  name        = "${local.parameter_prefix}/config/message-limits"
  description = "Message length limits and validation configuration"
  type        = "String"
  value = jsonencode({
    maxMessageLength       = var.message_limits.max_message_length
    maxTranscriptionLength = var.message_limits.max_transcription_length
    maxWebhookBodySize     = var.message_limits.max_webhook_body_size
    maxAiRequestLength     = var.message_limits.max_ai_request_length
    enableValidation       = var.message_limits.enable_validation
  })
  
  tags = merge(local.common_tags, {
    Type = "config"
    Service = "application"
  })
}

# Application Environment Configuration
resource "aws_ssm_parameter" "app_environment_config" {
  name        = "${local.parameter_prefix}/config/environment"
  description = "Application environment configuration"
  type        = "String"
  value = jsonencode({
    environment    = var.environment
    projectName    = var.project_name
    nodeEnv        = var.environment == "prod" ? "production" : "development"
    logLevel       = var.environment == "prod" ? "warn" : "info"
    enableDebug    = var.environment != "prod"
  })
  
  tags = merge(local.common_tags, {
    Type = "config"
    Service = "application"
  })
}

# Health Check Configuration
resource "aws_ssm_parameter" "health_check_config" {
  name        = "${local.parameter_prefix}/config/health-check"
  description = "Health check and monitoring configuration"
  type        = "String"
  value = jsonencode({
    enableHealthChecks     = true
    healthCheckInterval    = 30
    enableMetrics         = true
    enablePerformanceTracking = var.environment == "prod"
  })
  
  tags = merge(local.common_tags, {
    Type = "config"
    Service = "monitoring"
  })
}