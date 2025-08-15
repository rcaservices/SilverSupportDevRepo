# infrastructure/terraform/secrets-validation.tf
# Variable definitions and validations for secrets and configuration

# Message length configuration with validation
variable "message_limits" {
  description = "Message length limits for the AI support application"
  type = object({
    max_message_length       = optional(number, 8000)
    max_transcription_length = optional(number, 5000)
    max_webhook_body_size    = optional(number, 10000)
    max_ai_request_length    = optional(number, 8000)
    enable_validation        = optional(bool, true)
  })
  default = {}
  
  validation {
    condition = (
      var.message_limits.max_message_length >= 1000 && 
      var.message_limits.max_message_length <= 100000
    )
    error_message = "max_message_length must be between 1000 and 100000 characters."
  }
  
  validation {
    condition = (
      var.message_limits.max_transcription_length >= 500 && 
      var.message_limits.max_transcription_length <= 50000
    )
    error_message = "max_transcription_length must be between 500 and 50000 characters."
  }
  
  validation {
    condition = (
      var.message_limits.max_webhook_body_size >= 1000 && 
      var.message_limits.max_webhook_body_size <= 100000
    )
    error_message = "max_webhook_body_size must be between 1000 and 100000 bytes."
  }
  
  validation {
    condition = (
      var.message_limits.max_ai_request_length >= 1000 && 
      var.message_limits.max_ai_request_length <= 50000
    )
    error_message = "max_ai_request_length must be between 1000 and 50000 characters."
  }
}

# API Keys with length validation
variable "anthropic_api_key" {
  description = "Anthropic API key for Claude AI service"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.anthropic_api_key) > 20 && 
      length(var.anthropic_api_key) < 200 &&
      can(regex("^sk-ant-", var.anthropic_api_key))
    )
    error_message = "Anthropic API key must be 20-200 characters and start with 'sk-ant-'."
  }
}

variable "openai_api_key" {
  description = "OpenAI API key for Whisper transcription service"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.openai_api_key) > 20 && 
      length(var.openai_api_key) < 200 &&
      can(regex("^sk-", var.openai_api_key))
    )
    error_message = "OpenAI API key must be 20-200 characters and start with 'sk-'."
  }
}

variable "twilio_account_sid" {
  description = "Twilio Account SID"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.twilio_account_sid) == 34 &&
      can(regex("^AC", var.twilio_account_sid))
    )
    error_message = "Twilio Account SID must be exactly 34 characters and start with 'AC'."
  }
}

variable "twilio_auth_token" {
  description = "Twilio authentication token"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.twilio_auth_token) >= 30 && 
      length(var.twilio_auth_token) <= 40
    )
    error_message = "Twilio auth token must be between 30 and 40 characters."
  }
}

variable "twilio_phone_number" {
  description = "Twilio phone number for the support line"
  type        = string
  
  validation {
    condition = can(regex("^\\+1[0-9]{10}$", var.twilio_phone_number))
    error_message = "Twilio phone number must be in format +1XXXXXXXXXX."
  }
}

# Database configuration with validation
variable "database_url" {
  description = "PostgreSQL database connection URL"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.database_url) > 30 && 
      length(var.database_url) < 500 &&
      can(regex("^postgresql://", var.database_url))
    )
    error_message = "Database URL must be 30-500 characters and start with 'postgresql://'."
  }
}

# Security secrets with strong validation
variable "jwt_secret" {
  description = "JWT signing secret for authentication"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.jwt_secret) >= 32 && 
      length(var.jwt_secret) <= 128
    )
    error_message = "JWT secret must be between 32 and 128 characters for security."
  }
}

variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.encryption_key) == 32
    )
    error_message = "Encryption key must be exactly 32 characters."
  }
}

variable "session_secret" {
  description = "Session secret for Express session middleware"
  type        = string
  sensitive   = true
  
  validation {
    condition = (
      length(var.session_secret) >= 24 && 
      length(var.session_secret) <= 64
    )
    error_message = "Session secret must be between 24 and 64 characters."
  }
}

# Voice authentication service configuration
variable "azure_speech_key" {
  description = "Azure Speech Service API key for voice authentication"
  type        = string
  sensitive   = true
  default     = ""
  
  validation {
    condition = (
      var.azure_speech_key == "" ||
      (length(var.azure_speech_key) >= 30 && length(var.azure_speech_key) <= 40)
    )
    error_message = "Azure Speech key must be empty or between 30-40 characters."
  }
}

variable "azure_speech_region" {
  description = "Azure Speech Service region"
  type        = string
  default     = ""
  
  validation {
    condition = (
      var.azure_speech_region == "" ||
      can(regex("^[a-z]+[a-z0-9]*$", var.azure_speech_region))
    )
    error_message = "Azure Speech region must be empty or a valid Azure region name."
  }
}

# Email service configuration
variable "smtp_user" {
  description = "SMTP username for email notifications"
  type        = string
  sensitive   = true
  default     = ""
  
  validation {
    condition = (
      var.smtp_user == "" ||
      (length(var.smtp_user) > 5 && length(var.smtp_user) < 100)
    )
    error_message = "SMTP user must be empty or between 5-100 characters."
  }
}

variable "smtp_password" {
  description = "SMTP password for email notifications"
  type        = string
  sensitive   = true
  default     = ""
  
  validation {
    condition = (
      var.smtp_password == "" ||
      (length(var.smtp_password) > 8 && length(var.smtp_password) < 100)
    )
    error_message = "SMTP password must be empty or between 8-100 characters."
  }
}

# Redis configuration (optional)
variable "redis_url" {
  description = "Redis connection URL for session storage"
  type        = string
  sensitive   = true
  default     = ""
  
  validation {
    condition = (
      var.redis_url == "" ||
      can(regex("^redis://", var.redis_url))
    )
    error_message = "Redis URL must be empty or start with 'redis://'."
  }
}

# Note: environment and project_name variables are defined in main.tf