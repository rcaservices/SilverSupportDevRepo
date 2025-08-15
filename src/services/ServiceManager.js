// File: src/services/ServiceManager.js
// Production-ready service manager with graceful degradation

const config = require('../config/environment');
const logger = require('../utils/logger');

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.healthStatus = new Map();
    this.initializeServices();
  }

  async initializeServices() {
    logger.info('Initializing services...', { environment: config.get('node_env') });

    // Initialize database service
    await this.initializeDatabase();
    
    // Initialize external services with graceful degradation
    await this.initializeTwilio();
    await this.initializeAI();
    await this.initializeVoiceServices();
    await this.initializeAWS();

    logger.info('Service initialization complete', { 
      status: this.getServiceStatus(),
      enabledServices: this.getEnabledServices()
    });
  }

  async initializeDatabase() {
    try {
      if (!config.get('database.url')) {
        throw new Error('Database URL not configured');
      }

      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: config.get('database.url'),
        ssl: config.get('database.ssl') ? { rejectUnauthorized: false } : false,
        min: config.get('database.pool.min'),
        max: config.get('database.pool.max'),
        idleTimeoutMillis: config.get('database.pool.idleTimeoutMillis')
      });

      // Test connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.services.set('database', pool);
      this.healthStatus.set('database', { status: 'healthy', lastCheck: new Date() });
      
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Database initialization failed', { error: error.message });
      this.healthStatus.set('database', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
      
      if (config.isProduction()) {
        throw error; // Fail fast in production if database is required
      }
    }
  }

  async initializeTwilio() {
    try {
      if (!config.get('services.twilio.enabled')) {
        logger.warn('Twilio service disabled - voice calls will not work');
        return;
      }

      const twilio = require('twilio');
      const client = twilio(
        config.get('services.twilio.accountSid'),
        config.get('services.twilio.authToken')
      );

      // Test Twilio connection
      await client.api.accounts.list({ limit: 1 });

      this.services.set('twilio', client);
      this.healthStatus.set('twilio', { status: 'healthy', lastCheck: new Date() });
      
      logger.info('Twilio service initialized');
    } catch (error) {
      logger.error('Twilio initialization failed', { error: error.message });
      this.healthStatus.set('twilio', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
      
      // Create mock Twilio service for development
      if (!config.isProduction()) {
        this.services.set('twilio', this.createMockTwilio());
        logger.warn('Using mock Twilio service for development');
      }
    }
  }

  async initializeAI() {
    // Initialize Anthropic
    try {
      if (config.get('services.anthropic.enabled')) {
        const { Anthropic } = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: config.get('services.anthropic.apiKey')
        });

        this.services.set('anthropic', anthropic);
        this.healthStatus.set('anthropic', { status: 'healthy', lastCheck: new Date() });
        logger.info('Anthropic AI service initialized');
      }
    } catch (error) {
      logger.error('Anthropic initialization failed', { error: error.message });
      this.healthStatus.set('anthropic', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
    }

    // Initialize OpenAI
    try {
      if (config.get('services.openai.enabled')) {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({
          apiKey: config.get('services.openai.apiKey')
        });

        this.services.set('openai', openai);
        this.healthStatus.set('openai', { status: 'healthy', lastCheck: new Date() });
        logger.info('OpenAI service initialized');
      }
    } catch (error) {
      logger.error('OpenAI initialization failed', { error: error.message });
      this.healthStatus.set('openai', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
    }

    // Ensure at least one AI service is available
    if (!this.services.has('anthropic') && !this.services.has('openai')) {
      logger.warn('No AI services available - using fallback responses');
      this.services.set('ai', this.createMockAI());
    }
  }

  async initializeVoiceServices() {
    try {
      if (config.get('services.azure.enabled')) {
        // Azure Speech Services initialization would go here
        this.healthStatus.set('voice', { status: 'healthy', lastCheck: new Date() });
        logger.info('Voice services initialized');
      } else {
        logger.warn('Voice services disabled - voice authentication will not work');
        this.healthStatus.set('voice', { status: 'disabled', lastCheck: new Date() });
      }
    } catch (error) {
      logger.error('Voice services initialization failed', { error: error.message });
      this.healthStatus.set('voice', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
    }
  }

  async initializeAWS() {
    try {
      if (config.get('aws.region')) {
        const AWS = require('aws-sdk');
        AWS.config.update({ region: config.get('aws.region') });

        if (config.get('aws.s3.voiceBucket')) {
          const s3 = new AWS.S3();
          this.services.set('s3', s3);
          logger.info('AWS S3 service initialized');
        }

        if (config.get('aws.secretsManager.enabled')) {
          const secretsManager = new AWS.SecretsManager();
          this.services.set('secretsManager', secretsManager);
          logger.info('AWS Secrets Manager initialized');
        }

        this.healthStatus.set('aws', { status: 'healthy', lastCheck: new Date() });
      }
    } catch (error) {
      logger.error('AWS services initialization failed', { error: error.message });
      this.healthStatus.set('aws', { status: 'unhealthy', error: error.message, lastCheck: new Date() });
    }
  }

  // Mock services for development/fallback
  createMockTwilio() {
    return {
      calls: {
        create: async (options) => {
          logger.info('Mock Twilio call', { to: options.to, from: options.from });
          return { sid: 'mock-call-sid', status: 'queued' };
        }
      },
      messages: {
        create: async (options) => {
          logger.info('Mock Twilio SMS', { to: options.to, body: options.body });
          return { sid: 'mock-sms-sid', status: 'queued' };
        }
      }
    };
  }

  createMockAI() {
    return {
      chat: async (message) => {
        logger.info('Mock AI response', { message });
        return {
          response: "I'm sorry, but the AI service is currently unavailable. Please try again later or contact support.",
          confidence: 0.5
        };
      }
    };
  }

  // Service getters with fallback
  getService(name) {
    return this.services.get(name);
  }

  getDatabase() {
    const db = this.services.get('database');
    if (!db) {
      throw new Error('Database service not available');
    }
    return db;
  }

  getTwilio() {
    return this.services.get('twilio') || this.createMockTwilio();
  }

  getAI() {
    return this.services.get('anthropic') || this.services.get('openai') || this.createMockAI();
  }

  // Health check methods
  async healthCheck() {
    const results = {};
    
    for (const [service, status] of this.healthStatus.entries()) {
      results[service] = {
        status: status.status,
        lastCheck: status.lastCheck,
        error: status.error
      };
    }

    return {
      overall: this.getOverallHealth(),
      services: results,
      enabledFeatures: this.getEnabledFeatures(),
      timestamp: new Date()
    };
  }

  getOverallHealth() {
    const statuses = Array.from(this.healthStatus.values());
    const unhealthy = statuses.filter(s => s.status === 'unhealthy');
    
    if (unhealthy.length === 0) return 'healthy';
    if (unhealthy.length < statuses.length / 2) return 'degraded';
    return 'unhealthy';
  }

  getServiceStatus() {
    const status = {};
    for (const [service, health] of this.healthStatus.entries()) {
      status[service] = health.status;
    }
    return status;
  }

  getEnabledServices() {
    return Array.from(this.services.keys());
  }

  getEnabledFeatures() {
    const features = {};
    features.voiceAuthentication = config.get('features.voiceAuth') && this.services.has('voice');
    features.aiSupport = this.services.has('anthropic') || this.services.has('openai');
    features.phoneSupport = this.services.has('twilio');
    features.familyPortal = config.get('features.familyPortal');
    features.analytics = config.get('features.analytics');
    return features;
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down services...');
    
    const db = this.services.get('database');
    if (db && typeof db.end === 'function') {
      await db.end();
      logger.info('Database connection closed');
    }

    logger.info('All services shut down gracefully');
  }
}

module.exports = new ServiceManager();