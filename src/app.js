// File: src/app.js
// Production-ready Express application with comprehensive error handling

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const logger = require('./utils/logger');
const ServiceManager = require('./services/ServiceManager');

const app = express();

// Trust proxy for accurate IP addresses in AWS ALB
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.isProduction() ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = config.get('security.corsOrigins');
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', { origin, allowedOrigins });
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token']
}));

// Rate limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/ready';
    }
  });
};

// General API rate limiting
app.use('/api', createRateLimiter(
  config.get('security.rateLimitWindow'),
  config.get('security.rateLimitMax'),
  'Too many API requests, please try again later'
));

// Stricter rate limiting for sensitive endpoints
app.use('/api/subscribers/signup', createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 signups per 15 minutes
  'Too many signup attempts, please try again later'
));

app.use('/webhooks/twilio', createRateLimiter(
  60 * 1000, // 1 minute
  100, // 100 webhook calls per minute
  'Webhook rate limit exceeded'
));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Compression
app.use(compression());

// Logging
app.use(morgan(config.isProduction() ? 'combined' : 'dev', {
  stream: { 
    write: message => logger.info(message.trim(), { source: 'http' })
  },
  skip: (req) => {
    // Skip logging for health checks in production
    return config.isProduction() && (req.path === '/health' || req.path === '/ready');
  }
}));

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const health = await ServiceManager.healthCheck();
    
    const response = {
      status: health.overall === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'SilverSupport.ai - AI Technical Support',
      version: '1.1.0',
      environment: config.get('node_env'),
      features: Object.keys(ServiceManager.getEnabledFeatures()).filter(
        key => ServiceManager.getEnabledFeatures()[key]
      ),
      services: health.services
    };

    // Return 200 for healthy/degraded, 503 for unhealthy
    const statusCode = health.overall === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Readiness probe for Kubernetes/ECS
app.get('/ready', async (req, res) => {
  try {
    // Check if critical services are available
    const db = ServiceManager.getService('database');
    if (!db) {
      return res.status(503).json({ 
        status: 'not ready', 
        reason: 'Database not available' 
      });
    }

    // Test database connection
    const client = await db.connect();
    await client.query('SELECT 1');
    client.release();

    res.json({ 
      status: 'ready',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      reason: error.message
    });
  }
});

// API endpoints
try {
  // Load routes only if they exist
  const routeFiles = [
    './routes/webhooks',
    './routes/subscribers', 
    './routes/calls',
    './routes/analytics',
    './routes/knowledge'
  ];

  for (const routeFile of routeFiles) {
    try {
      const route = require(routeFile);
      const routeName = routeFile.split('/').pop();
      
      if (routeName === 'webhooks') {
        app.use('/webhooks', route);
      } else {
        app.use(`/api/${routeName}`, route);
      }
      
      logger.debug(`Loaded route: ${routeName}`);
    } catch (error) {
      logger.warn(`Failed to load route ${routeFile}`, { error: error.message });
    }
  }
} catch (error) {
  logger.error('Failed to load routes', { error: error.message });
}

// Static file serving for admin dashboard (if enabled)
if (config.get('node_env') !== 'production' || process.env.SERVE_STATIC === 'true') {
  const path = require('path');
  
  try {
    app.use('/admin', express.static(path.join(__dirname, '../admin-dashboard/dist'), {
      maxAge: config.isProduction() ? '1d' : '0',
      etag: true
    }));

    app.get('/admin/*', (req, res) => {
      res.sendFile(path.join(__dirname, '../admin-dashboard/dist/index.html'));
    });

    logger.info('Admin dashboard static files enabled');
  } catch (error) {
    logger.warn('Admin dashboard static files not available', { error: error.message });
  }
}

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'SilverSupport.ai API',
    version: '1.1.0',
    environment: config.get('node_env'),
    endpoints: {
      health: 'GET /health',
      ready: 'GET /ready',
      signup: 'POST /api/subscribers/signup',
      webhook: 'POST /webhooks/twilio',
      analytics: 'GET /api/analytics',
      knowledge: 'GET /api/knowledge'
    },
    documentation: 'https://docs.silverzupport.us',
    support: 'support@silverzupport.us'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { 
    method: req.method, 
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

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
      'Support': config.get('services.twilio.phoneNumber') || '1-800-SUPPORT'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  // Log the full error
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't expose internal errors in production
  const isDev = config.isDevelopment();
  
  res.status(error.status || 500).json({
    error: error.status < 500 ? error.message : 'Internal server error',
    ...(isDev && { 
      stack: error.stack,
      details: error 
    }),
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });
});

module.exports = app;