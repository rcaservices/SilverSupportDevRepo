// File: src/config/environment.js
// Production-ready environment configuration with validation

class EnvironmentConfig {
    constructor() {
      this.validateRequiredVariables();
      this.config = this.buildConfig();
    }
  
    validateRequiredVariables() {
      const required = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'JWT_SECRET',
        'ENCRYPTION_KEY'
      ];
  
      const optional = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN', 
        'ANTHROPIC_API_KEY',
        'OPENAI_API_KEY',
        'AZURE_SPEECH_KEY'
      ];
  
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
      }
  
      const missingOptional = optional.filter(key => !process.env[key]);
      if (missingOptional.length > 0) {
        console.warn('Missing optional services - features will be disabled:', missingOptional);
      }
    }
  
    buildConfig() {
      return {
        // Core application
        node_env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        
        // Database
        database: {
          url: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production',
          pool: {
            min: parseInt(process.env.DB_POOL_MIN) || 5,
            max: parseInt(process.env.DB_POOL_MAX) || 20,
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000
          }
        },
  
        // Security
        security: {
          jwtSecret: process.env.JWT_SECRET,
          encryptionKey: process.env.ENCRYPTION_KEY,
          sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
          corsOrigins: (process.env.CORS_ORIGINS || 'https://silverzupport.us,https://alpha.silverzupport.us,https://admin.silverzupport.us').split(','),
          rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
          rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
        },
  
        // External services (with availability flags)
        services: {
          twilio: {
            enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            phoneNumber: process.env.TWILIO_PHONE_NUMBER,
            webhookUrl: process.env.TWILIO_WEBHOOK_URL
          },
  
          anthropic: {
            enabled: !!process.env.ANTHROPIC_API_KEY,
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
          },
  
          openai: {
            enabled: !!process.env.OPENAI_API_KEY,
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4',
            whisperModel: process.env.WHISPER_MODEL || 'whisper-1'
          },
  
          azure: {
            enabled: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
            speechKey: process.env.AZURE_SPEECH_KEY,
            speechRegion: process.env.AZURE_SPEECH_REGION
          }
        },
  
        // Application features
        features: {
          voiceAuth: process.env.ENABLE_VOICE_AUTH !== 'false',
          analytics: process.env.ENABLE_ANALYTICS !== 'false',
          callRecording: process.env.ENABLE_CALL_RECORDING === 'true',
          familyPortal: process.env.ENABLE_FAMILY_PORTAL !== 'false'
        },
  
        // AWS specific
        aws: {
          region: process.env.AWS_REGION || 'us-east-1',
          s3: {
            voiceBucket: process.env.S3_VOICE_BUCKET,
            logsBucket: process.env.S3_LOGS_BUCKET,
            backupsBucket: process.env.S3_BACKUPS_BUCKET
          },
          secretsManager: {
            enabled: process.env.AWS_SECRETS_MANAGER_ENABLED === 'true',
            secretName: process.env.AWS_SECRET_NAME
          }
        },
  
        // Logging
        logging: {
          level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
          format: process.env.LOG_FORMAT || 'json'
        }
      };
    }
  
    get(path) {
      return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }
  
    isProduction() {
      return this.config.node_env === 'production';
    }
  
    isDevelopment() {
      return this.config.node_env === 'development';
    }
  
    getServiceStatus() {
      const services = this.config.services;
      return {
        twilio: services.twilio.enabled ? 'enabled' : 'disabled',
        anthropic: services.anthropic.enabled ? 'enabled' : 'disabled', 
        openai: services.openai.enabled ? 'enabled' : 'disabled',
        azure: services.azure.enabled ? 'enabled' : 'disabled',
        database: this.config.database.url ? 'enabled' : 'disabled'
      };
    }
  }
  
  module.exports = new EnvironmentConfig();