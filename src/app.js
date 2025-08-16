// File: src/app.js (Complete Corrected Version)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const hpp = require('hpp');
const path = require('path');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const callRoutes = require('./routes/calls');
const webhookRoutes = require('./routes/webhooks');
const knowledgeRoutes = require('./routes/knowledge');
const analyticsRoutes = require('./routes/analytics');
const agentRoutes = require('./routes/agents');
const aiRoutes = require('./routes/ai');
const subscriberRoutes = require('./routes/subscribers');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Basic security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now to avoid issues
  crossOriginEmbedderPolicy: false
}));

// Session configuration (simplified for now)
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Optional Redis/MongoDB session storage
try {
  if (process.env.REDIS_URL) {
    const RedisStore = require('connect-redis')(session);
    const redis = require('redis');
    const redisClient = redis.createClient({ url: process.env.REDIS_URL });
    sessionConfig.store = new RedisStore({ client: redisClient });
    logger.info('Using Redis for session storage');
  } else if (process.env.MONGODB_URL) {
    const MongoStore = require('connect-mongo');
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URL
    });
    logger.info('Using MongoDB for session storage');
  } else {
    logger.info('Using memory store for sessions (development only)');
  }
} catch (error) {
  logger.warn('Session store setup failed, using memory store:', error.message);
}

app.use(session(sessionConfig));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(null, false); // Don't throw error, just block
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token']
}));

// HTTP Parameter Pollution protection
app.use(hpp());

// Compression and parsing
app.use(compression());
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging
app.use(morgan('combined', {
  stream: { 
    write: message => logger.info(message.trim())
  }
}));

// Basic rate limiting (simplified for now)
const rateLimit = require('express-rate-limit');
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100,
  message: 'Too many requests from this IP'
});

app.use('/api', generalLimiter);

// Stricter rate limiting for sensitive endpoints
app.use('/api/subscribers/signup', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 signups per 15 minutes
  message: 'Too many signup attempts. Please try again later.'
}));

// Mount AI routes (IMPORTANT: Before dynamic route loading)
app.use('/api/ai', aiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SilverSupport.ai - AI Technical Support',
    version: '2.0.0',
    features: [
      'voice-authentication',
      'senior-friendly-signup',
      'family-portal',
      'usage-analytics'
    ]
  });
});

// Security endpoint for frontend
app.get('/api/security/config', (req, res) => {
  res.json({
    requiresApiKey: !!process.env.PUBLIC_API_KEY,
    csrfEnabled: true,
    rateLimits: {
      signup: parseInt(process.env.SIGNUP_RATE_LIMIT) || 5,
      api: parseInt(process.env.API_RATE_LIMIT) || 100
    }
  });
});

// API routes
app.use('/api/calls', callRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/subscribers', subscriberRoutes);

// Webhook routes
app.use('/webhooks', webhookRoutes);

// Static files (if enabled)
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static('public', {
    maxAge: '1d',
    etag: true
  }));
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      'Health Check': 'GET /health',
      'API Documentation': 'GET /api',
      'Family Signup': 'POST /api/subscribers/signup',
      'Support': process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
    }
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;