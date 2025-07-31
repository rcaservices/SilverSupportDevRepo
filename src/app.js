// File: src/app.js (Complete Enhanced Security Configuration)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const hpp = require('hpp'); // HTTP Parameter Pollution protection
const path = require('path');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { createLimiter } = require('./middleware/rateLimiter');
const securityMonitor = require('./middleware/securityMonitor');

// Import routes
const callRoutes = require('./routes/calls');
const webhookRoutes = require('./routes/webhooks');
const knowledgeRoutes = require('./routes/knowledge');
const analyticsRoutes = require('./routes/analytics');
const agentRoutes = require('./routes/agents');
const aiRoutes = require('./routes/ai');
const subscriberRoutes = require('./routes/subscribers');

const app = express();

// Trust proxy for accurate IP addresses (if behind load balancer/CDN)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.WEBSITE_URL].filter(Boolean),
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for admin dashboard
}));

// Session configuration for CSRF protection
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use Redis or MongoDB for session storage in production
if (process.env.REDIS_URL) {
  const RedisStore = require('connect-redis')(session);
  const redis = require('redis');
  const redisClient = redis.createClient({ url: process.env.REDIS_URL });
  sessionConfig.store = new RedisStore({ client: redisClient });
} else if (process.env.MONGODB_URL) {
  const MongoStore = require('connect-mongo');
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URL
  });
} else if (process.env.NODE_ENV === 'production') {
  logger.warn('WARNING: Using memory store for sessions in production. Set REDIS_URL or MONGODB_URL for persistent sessions.');
}

app.use(session(sessionConfig));

// CORS configuration with multiple allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token']
}));

// HTTP Parameter Pollution protection
app.use(hpp());

// Compression and parsing with limits
app.use(compression());
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging with security info
app.use(morgan('combined', {
  stream: { 
    write: message => {
      // Parse log to extract security-relevant info
      if (message.includes('POST /api/subscribers/signup')) {
        logger.info('Signup request logged', { logLine: message.trim() });
      } else {
        logger.info(message.trim());
      }
    }
  }
}));

// Security monitoring middleware
app.use(securityMonitor);

// Rate limiting with different limits for different endpoints
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100,
  message: 'Too many requests from this IP'
});

app.use('/api', generalLimiter);

// Health check (no rate limiting)
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
      'usage-analytics',
      'fraud-detection'
    ],
    security: {
      rateLimit: 'enabled',
      csrfProtection: 'enabled',
      cors: 'configured',
      apiKeyValidation: 'enabled'
    }
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
app.use('/api/ai', aiRoutes);
app.use('/api/subscribers', subscriberRoutes);

// Webhook routes (bypass some security for Twilio)
app.use('/webhooks', webhookRoutes);

// Static files for the website (if serving directly)
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static('public', {
    maxAge: '1d',
    etag: true
  }));
  
  // Serve the main website at root
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// 404 handler
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      'Health Check': 'GET /health',
      'Family Signup': 'POST /api/subscribers/signup',
      'CSRF Token': 'GET /api/subscribers/csrf-token',
      'Support Line': process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
    }
  });
});

// Enhanced error handling with security considerations
app.use((error, req, res, next) => {
  // Don't expose sensitive error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error.message.includes('CORS')) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This request is not allowed from your origin'
      });
    }
  }
  
  errorHandler(error, req, res, next);
});

module.exports = app;