# infrastructure/terraform/secrets-outputs.tf
# Output values for use by other Terraform modules and external systems

# Message Limits Configuration (non-sensitive)
output "message_limits_config" {
  description = "Message length limits configuration for the application"
  value = {
    max_message_length       = var.message_limits.max_message_length
    max_transcription_length = var.message_limits.max_transcription_length
    max_webhook_body_size    = var.message_limits.max_webhook_body_size
    max_ai_request_length    = var.message_limits.max_ai_request_length
    enable_validation        = var.message_limits.enable_validation
  }
}

# SSM Parameter Names (for application to reference)
output "ssm_parameter_names" {
  description = "SSM parameter names for application configuration"
  value = {
    # AI Service Parameters
    anthropic_api_key    = aws_ssm_parameter.anthropic_api_key.name
    openai_api_key      = aws_ssm_parameter.openai_api_key.name
    
    # Twilio Parameters
    twilio_account_sid  = aws_ssm_parameter.twilio_account_sid.name
    twilio_auth_token   = aws_ssm_parameter.twilio_auth_token.name
    twilio_phone_number = aws_ssm_parameter.twilio_phone_number.name
    
    # Database Parameters
    database_url        = aws_ssm_parameter.database_url.name
    
    # Security Parameters
    jwt_secret          = aws_ssm_parameter.jwt_secret.name
    encryption_key      = aws_ssm_parameter.encryption_key.name
    session_secret      = aws_ssm_parameter.session_secret.name
    
    # Configuration Parameters
    message_limits      = aws_ssm_parameter.message_limits_config.name
    app_environment     = aws_ssm_parameter.app_environment_config.name
    health_check_config = aws_ssm_parameter.health_check_config.name
  }
}

# Optional Service Parameter Names (conditional outputs)
output "optional_ssm_parameter_names" {
  description = "SSM parameter names for optional services (may be empty)"
  value = {
    azure_speech_key    = length(aws_ssm_parameter.azure_speech_key) > 0 ? aws_ssm_parameter.azure_speech_key[0].name : ""
    azure_speech_region = length(aws_ssm_parameter.azure_speech_region) > 0 ? aws_ssm_parameter.azure_speech_region[0].name : ""
    smtp_user          = length(aws_ssm_parameter.smtp_user) > 0 ? aws_ssm_parameter.smtp_user[0].name : ""
    smtp_password      = length(aws_ssm_parameter.smtp_password) > 0 ? aws_ssm_parameter.smtp_password[0].name : ""
    redis_url          = length(aws_ssm_parameter.redis_url) > 0 ? aws_ssm_parameter.redis_url[0].name : ""
  }
}

# Environment Variables for Lambda/ECS/Docker (non-sensitive references)
output "lambda_environment_variables" {
  description = "Environment variables for Lambda functions (references to SSM parameters)"
  value = {
    # Configuration
    NODE_ENV                    = var.environment == "prod" ? "production" : "development"
    ENVIRONMENT                 = var.environment
    PROJECT_NAME               = var.project_name
    
    # Message Limits
    MAX_MESSAGE_LENGTH         = tostring(var.message_limits.max_message_length)
    MAX_TRANSCRIPTION_LENGTH   = tostring(var.message_limits.max_transcription_length)
    MAX_WEBHOOK_BODY_SIZE      = tostring(var.message_limits.max_webhook_body_size)
    MAX_AI_REQUEST_LENGTH      = tostring(var.message_limits.max_ai_request_length)
    ENABLE_MESSAGE_VALIDATION  = tostring(var.message_limits.enable_validation)
    
    # SSM Parameter References (for runtime lookup)
    ANTHROPIC_API_KEY_SSM      = aws_ssm_parameter.anthropic_api_key.name
    OPENAI_API_KEY_SSM         = aws_ssm_parameter.openai_api_key.name
    TWILIO_ACCOUNT_SID_SSM     = aws_ssm_parameter.twilio_account_sid.name
    TWILIO_AUTH_TOKEN_SSM      = aws_ssm_parameter.twilio_auth_token.name
    DATABASE_URL_SSM           = aws_ssm_parameter.database_url.name
    JWT_SECRET_SSM             = aws_ssm_parameter.jwt_secret.name
    ENCRYPTION_KEY_SSM         = aws_ssm_parameter.encryption_key.name
    SESSION_SECRET_SSM         = aws_ssm_parameter.session_secret.name
    
    # Non-sensitive values
    TWILIO_PHONE_NUMBER        = var.twilio_phone_number
    AZURE_SPEECH_REGION        = var.azure_speech_region
  }
  sensitive = false
}

# Docker Environment Variables
output "docker_environment_variables" {
  description = "Environment variables for Docker containers"
  value = {
    # Base configuration
    NODE_ENV     = var.environment == "prod" ? "production" : "development"
    PORT         = "3000"
    HOST         = "0.0.0.0"
    
    # Message validation settings
    MAX_MESSAGE_LENGTH        = var.message_limits.max_message_length
    MAX_TRANSCRIPTION_LENGTH  = var.message_limits.max_transcription_length
    MAX_WEBHOOK_BODY_SIZE     = var.message_limits.max_webhook_body_size
    MAX_AI_REQUEST_LENGTH     = var.message_limits.max_ai_request_length
    ENABLE_MESSAGE_VALIDATION = var.message_limits.enable_validation
    
    # Service settings
    LOG_LEVEL               = var.environment == "prod" ? "warn" : "info"
    ENABLE_CORS            = var.environment != "prod"
    TRUST_PROXY            = "true"
    
    # Public configuration
    TWILIO_PHONE_NUMBER    = var.twilio_phone_number
    AZURE_SPEECH_REGION    = var.azure_speech_region
  }
}

# Summary Information
output "deployment_summary" {
  description = "Summary information for deployment and monitoring"
  value = {
    environment           = var.environment
    project_name         = var.project_name
    parameter_prefix     = local.parameter_prefix
    total_parameters     = length([
      aws_ssm_parameter.anthropic_api_key,
      aws_ssm_parameter.openai_api_key,
      aws_ssm_parameter.twilio_account_sid,
      aws_ssm_parameter.twilio_auth_token,
      aws_ssm_parameter.twilio_phone_number,
      aws_ssm_parameter.database_url,
      aws_ssm_parameter.jwt_secret,
      aws_ssm_parameter.encryption_key,
      aws_ssm_parameter.session_secret,
      aws_ssm_parameter.message_limits_config,
      aws_ssm_parameter.app_environment_config,
      aws_ssm_parameter.health_check_config
    ])
    optional_parameters  = {
      azure_speech    = length(aws_ssm_parameter.azure_speech_key) > 0
      smtp_service    = length(aws_ssm_parameter.smtp_user) > 0
      redis_cache     = length(aws_ssm_parameter.redis_url) > 0
    }
    message_limits = {
      max_message       = var.message_limits.max_message_length
      max_transcription = var.message_limits.max_transcription_length
      validation_enabled = var.message_limits.enable_validation
    }
  }
}

# Parameter ARNs for IAM policies
output "ssm_parameter_arns" {
  description = "ARNs of SSM parameters for IAM policy creation"
  value = {
    # Core secrets
    anthropic_api_key   = aws_ssm_parameter.anthropic_api_key.arn
    openai_api_key     = aws_ssm_parameter.openai_api_key.arn
    twilio_account_sid = aws_ssm_parameter.twilio_account_sid.arn
    twilio_auth_token  = aws_ssm_parameter.twilio_auth_token.arn
    database_url       = aws_ssm_parameter.database_url.arn
    jwt_secret         = aws_ssm_parameter.jwt_secret.arn
    encryption_key     = aws_ssm_parameter.encryption_key.arn
    session_secret     = aws_ssm_parameter.session_secret.arn
    
    # Configuration parameters
    message_limits     = aws_ssm_parameter.message_limits_config.arn
    app_environment    = aws_ssm_parameter.app_environment_config.arn
    health_check       = aws_ssm_parameter.health_check_config.arn
  }
  sensitive = false
}

# Wildcard ARN for IAM policies (to access all parameters with prefix)
output "ssm_parameter_path_arn" {
  description = "Wildcard ARN for accessing all parameters under the project path"
  value       = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${local.parameter_prefix}/*"
}

# Data sources are defined in main.tf