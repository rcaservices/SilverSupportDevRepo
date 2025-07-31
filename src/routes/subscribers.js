// File: src/routes/subscribers.js (Enhanced with Security)
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const crypto = require('crypto');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { signupLimiter } = require('../middleware/rateLimiter');
const emailService = require('../utils/emailService');

const router = express.Router();

// Helper function for database connection
async function createDbConnection() {
  return new Client({
    connectionString: process.env.DATABASE_URL
  });
}

// API Key validation middleware for public endpoints
const validateApiKey = (req, res, next) => {
  // Allow requests from your website domain without API key
  const allowedOrigins = [
    process.env.WEBSITE_URL,
    process.env.ADMIN_DASHBOARD_URL,
    process.env.FAMILY_PORTAL_URL
  ].filter(Boolean);

  const origin = req.get('Origin') || req.get('Referer');
  const isAllowedOrigin = allowedOrigins.some(allowedOrigin => 
    origin && origin.startsWith(allowedOrigin)
  );

  if (isAllowedOrigin) {
    return next();
  }

  // For direct API access, require API key
  const apiKey = req.header('X-API-Key') || req.query.api_key;
  const expectedApiKey = process.env.PUBLIC_API_KEY;

  if (!expectedApiKey) {
    logger.warn('PUBLIC_API_KEY not configured');
    return next(); // Allow in development
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({
      error: 'Invalid or missing API key',
      message: 'This endpoint requires a valid API key'
    });
  }

  next();
};

// CSRF Protection for form submissions
const validateCSRF = (req, res, next) => {
  // Skip CSRF for API key authenticated requests
  if (req.header('X-API-Key')) {
    return next();
  }

  const token = req.header('X-CSRF-Token') || req.body.csrfToken;
  const expectedToken = req.session?.csrfToken;

  // In development, generate a simple token if none exists
  if (process.env.NODE_ENV === 'development' && !expectedToken) {
    req.session = req.session || {};
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    return next();
  }

  if (!token || token !== expectedToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

// Enhanced validation with sanitization
const signupValidation = [
  // Senior information
  body('senior_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Senior name must be 2-100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Senior name contains invalid characters'),
  
  body('senior_phone_number')
    .trim()
    .matches(/^\d{10}$/)
    .withMessage('Phone number must be exactly 10 digits')
    .custom(async (value) => {
      // Check for obviously fake numbers
      const fakePatterns = [
        /^0{10}$/, /^1{10}$/, /^1234567890$/, /^9999999999$/
      ];
      if (fakePatterns.some(pattern => pattern.test(value))) {
        throw new Error('Please provide a valid phone number');
      }
      return true;
    }),

  // Family member information
  body('family_member_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Your name must be 2-100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Your name contains invalid characters'),
  
  body('family_email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 254 })
    .withMessage('Email address too long'),

  body('family_phone')
    .optional()
    .trim()
    .matches(/^\d{10}$/)
    .withMessage('Family phone must be exactly 10 digits'),

  // Optional fields
  body('address_street')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address too long'),

  body('relationship')
    .optional()
    .trim()
    .isIn(['child', 'grandchild', 'spouse', 'caregiver', 'other'])
    .withMessage('Invalid relationship type'),

  body('selected_tier')
    .optional()
    .isIn(['basic', 'premium', 'family'])
    .withMessage('Invalid subscription tier'),

  body('preferred_language')
    .optional()
    .isIn(['en-US', 'es-US', 'fr-FR'])
    .withMessage('Invalid language selection'),

  body('preferred_voice_speed')
    .optional()
    .isIn(['slow', 'normal', 'fast'])
    .withMessage('Invalid voice speed selection'),

  body('hearing_assistance')
    .optional()
    .isBoolean()
    .withMessage('Hearing assistance must be true or false'),

  body('emergency_contact')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Emergency contact info too long')
];

// Family member signup endpoint (public with security layers)
router.post('/signup', 
  signupLimiter,
  validateApiKey,
  validateCSRF,
  signupValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Signup validation failed:', { 
          errors: errors.array(), 
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        senior_name,
        senior_phone_number,
        family_member_name,
        family_email,
        family_phone = '',
        address_street = '',
        relationship = 'family member',
        selected_tier = 'basic',
        preferred_language = 'en-US',
        preferred_voice_speed = 'slow',
        hearing_assistance = false,
        emergency_contact = ''
      } = req.body;

      // Additional security checks
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      // Log signup attempt for monitoring
      logger.info('Signup attempt', {
        seniorPhone: senior_phone_number.substring(0, 3) + 'XXXX', // Partially mask phone
        familyEmail: family_email.split('@')[0] + '@***',
        ip: clientIP,
        userAgent: userAgent.substring(0, 100) // Limit UA length in logs
      });

      const client = await createDbConnection();
      
      try {
        await client.connect();
        await client.query('BEGIN');
        
        // Check if phone number already exists (with better error handling)
        const existingCheck = await client.query(`
          SELECT 'subscriber' as type, name as existing_name FROM subscribers 
          WHERE phone_number = $1
          UNION ALL
          SELECT 'pending' as type, senior_name as existing_name FROM pending_signups 
          WHERE senior_phone_number = $1 AND status != 'completed' AND expires_at > NOW()
        `, [senior_phone_number]);
        
        if (existingCheck.rows.length > 0) {
          const existing = existingCheck.rows[0];
          logger.warn('Duplicate signup attempt', {
            phone: senior_phone_number.substring(0, 3) + 'XXXX',
            existingType: existing.type,
            ip: clientIP
          });
          
          return res.status(409).json({
            error: 'Phone number already registered',
            message: existing.type === 'subscriber' 
              ? `${existing.existing_name} is already enrolled. They can call our support line directly.`
              : `${existing.existing_name} has a pending signup. They should call our support line to complete enrollment.`,
            supportNumber: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
          });
        }
        
        // Check for suspicious activity (multiple signups from same IP/email)
        const recentSignups = await client.query(`
          SELECT COUNT(*) as count FROM pending_signups 
          WHERE (family_email = $1 OR signup_ip = $2) 
          AND created_at > NOW() - INTERVAL '1 hour'
        `, [family_email, clientIP]);
        
        if (recentSignups.rows[0].count > 2) {
          logger.warn('Suspicious signup activity', {
            email: family_email.split('@')[0] + '@***',
            ip: clientIP,
            recentCount: recentSignups.rows[0].count
          });
          
          return res.status(429).json({
            error: 'Too many recent signups',
            message: 'Please contact our support team for assistance.',
            supportNumber: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
          });
        }
        
        // Generate verification code for additional security
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Create pending signup with enhanced tracking
        const result = await client.query(`
          INSERT INTO pending_signups (
            senior_name, senior_phone_number, address_street,
            family_member_name, family_email, family_phone, relationship, 
            selected_tier, preferred_language, preferred_voice_speed,
            hearing_assistance, emergency_contact_name,
            signup_method, signup_source, signup_ip, signup_user_agent,
            verification_code, verification_expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id, senior_name, senior_phone_number, created_at
        `, [
          senior_name, senior_phone_number, address_street,
          family_member_name, family_email, family_phone, relationship,
          selected_tier, preferred_language, preferred_voice_speed,
          hearing_assistance, emergency_contact,
          'online', 'website', clientIP, userAgent,
          verificationCode, verificationExpires
        ]);
        
        const signup = result.rows[0];
        
        await client.query('COMMIT');
        
        logger.info('Successful signup created', {
          signupId: signup.id,
          seniorName: senior_name,
          tier: selected_tier,
          ip: clientIP
        });
        
        // Send confirmation email to family member (async, don't wait)
        const signupDetails = {
          selectedTier: selected_tier,
          callLimit: getCallLimitForTier(selected_tier),
          expiresAt: verificationExpires
        };
        
        emailService.sendSignupConfirmation(family_email, senior_name, signupDetails)
          .catch(error => {
            logger.error('Failed to send signup confirmation email:', error);
          });
        
        res.status(201).json({
          success: true,
          message: `Thank you! We've set up ${senior_name} in our system.`,
          details: {
            signupId: signup.id,
            seniorName: signup.senior_name,
            nextSteps: [
              `Have ${senior_name} call ${process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'} to complete voice enrollment`,
              'Voice enrollment typically takes 5-10 minutes',
              'They\'ll be able to get help immediately after enrollment'
            ],
            supportNumber: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT',
            estimatedEnrollmentTime: '5-10 minutes',
            signupExpires: verificationExpires.toISOString()
          }
        });
        
      } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
      } finally {
        await client.end();
      }
      
    } catch (error) {
      logger.error('Signup error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(500).json({
        error: 'Signup failed',
        message: 'Unable to process signup. Please try again or contact support.',
        supportNumber: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
      });
    }
  }
);

// Get CSRF token (for form protection)
router.get('/csrf-token', (req, res) => {
  req.session = req.session || {};
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  res.json({
    csrfToken: req.session.csrfToken,
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  });
});

// Helper function to get call limits
function getCallLimitForTier(tier) {
  const limits = {
    'basic': 50,
    'premium': 200,
    'family': 500
  };
  return limits[tier] || 50;
}

// Admin endpoints (require authentication) - keeping existing ones
router.get('/admin/pending-signups', [
  query('status').optional().isIn(['awaiting_voice_enrollment', 'verified', 'expired']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    
    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      let whereClause = 'WHERE expires_at > NOW()';
      let params = [];
      
      if (status) {
        whereClause += ' AND status = $1';
        params.push(status);
      }
      
      const result = await client.query(`
        SELECT id, senior_name, senior_phone_number, family_member_name, 
               family_email, relationship, selected_tier, status, 
               created_at, expires_at, signup_ip, preferred_language
        FROM pending_signups
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);
      
      res.json({
        pendingSignups: result.rows,
        pagination: {
          page,
          limit,
          total: result.rows.length
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Error fetching pending signups:', error);
    res.status(500).json({ error: 'Failed to fetch pending signups' });
  }
});

module.exports = router;