// File: src/app.js (Updated)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const callRoutes = require('./routes/calls');
const webhookRoutes = require('./routes/webhooks');
const knowledgeRoutes = require('./routes/knowledge');
const analyticsRoutes = require('./routes/analytics');
const agentRoutes = require('./routes/agents');
const aiRoutes = require('./routes/ai');
const subscriberRoutes = require('./routes/subscribers'); // New route

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001',
    process.env.FAMILY_PORTAL_URL || 'http://localhost:3002' // For family signup portal
  ],
  credentials: true
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Rate limiting (exempt webhooks from rate limiting)
app.use('/api', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AI Technical Support with Voice Authentication',
    version: '2.0.0',
    features: [
      'voice-authentication',
      'senior-friendly-signup',
      'family-portal',
      'usage-analytics'
    ]
  });
});

// API routes
app.use('/api/calls', callRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/subscribers', subscriberRoutes); // New subscriber management

// Webhook routes (no rate limiting)
app.use('/webhooks', webhookRoutes);

// Public signup endpoint (for family members)
app.get('/signup', (req, res) => {
  res.json({
    message: 'Family Signup Portal',
    description: 'Sign up your senior family member for AI technical support',
    supportPhone: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT',
    signupEndpoint: '/api/subscribers/signup'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      'Health Check': 'GET /health',
      'Family Signup': 'POST /api/subscribers/signup',
      'Support Line': process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
    }
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;