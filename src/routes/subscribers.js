// File: src/routes/subscribers.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const logger = require('../utils/logger');
const auth = require('../middleware/auth'); // JWT auth middleware for admin access

const router = express.Router();

// Helper function for database connection
async function createDbConnection() {
  return new Client({
    connectionString: process.env.DATABASE_URL
  });
}

// Family member signup endpoint (no auth required)
router.post('/signup', [
  body('seniorName').trim().isLength({ min: 2, max: 255 }).withMessage('Senior name is required'),
  body('seniorPhone').isMobilePhone().withMessage('Valid phone number is required'),
  body('familyName').trim().isLength({ min: 2, max: 255 }).withMessage('Your name is required'),
  body('familyEmail').isEmail().withMessage('Valid email is required'),
  body('relationship').optional().trim().isLength({ max: 100 }),
  body('selectedTier').optional().isIn(['basic', 'premium', 'family']).withMessage('Invalid subscription tier'),
  body('addressStreet').optional().trim().isLength({ max: 255 }),
  body('addressCity').optional().trim().isLength({ max: 100 }),
  body('addressState').optional().trim().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      seniorName,
      seniorPhone,
      familyName,
      familyEmail,
      familyPhone,
      relationship,
      selectedTier,
      addressStreet,
      addressCity,
      addressState
    } = req.body;

    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      // Check if phone number already exists
      const existingCheck = await client.query(`
        SELECT id FROM subscribers WHERE phone_number = $1
        UNION
        SELECT id FROM pending_signups WHERE senior_phone_number = $1 AND status != 'completed'
      `, [seniorPhone]);
      
      if (existingCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Phone number already registered',
          message: 'This phone number is already in our system. Please call our support line for assistance.'
        });
      }
      
      // Create pending signup
      const result = await client.query(`
        INSERT INTO pending_signups (
          senior_name, senior_phone_number, address_street, address_city, address_state,
          family_member_name, family_email, family_phone, relationship, 
          selected_tier, signup_method, signup_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'online', 'website')
        RETURNING id, senior_name, senior_phone_number
      `, [
        seniorName, seniorPhone, addressStreet || '', addressCity || '', addressState || '',
        familyName, familyEmail, familyPhone || '', relationship || 'family member',
        selectedTier || 'basic'
      ]);
      
      const signup = result.rows[0];
      
      logger.info(`New family signup created: ${signup.id} for ${seniorName}`);
      
      // TODO: Send email to family member with instructions
      // TODO: Send SMS to senior with instructions (optional)
      
      res.json({
        success: true,
        message: `Thank you! We've set up ${seniorName} in our system. Have them call 1-800-SUPPORT to complete voice enrollment.`,
        signupId: signup.id,
        supportNumber: process.env.SUPPORT_PHONE_NUMBER || '1-800-SUPPORT'
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({
      error: 'Signup failed',
      message: 'Unable to process signup. Please try again.'
    });
  }
});

// Get subscriber details (admin access)
router.get('/:id', [
  param('id').isInt().withMessage('Invalid subscriber ID')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const subscriberId = req.params.id;
    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT s.*, 
               COUNT(cs.id) as total_calls,
               AVG(cs.duration_seconds) as avg_call_duration,
               MAX(cs.start_time) as last_call_date
        FROM subscribers s
        LEFT JOIN call_sessions cs ON s.id = cs.subscriber_id
        WHERE s.id = $1
        GROUP BY s.id
      `, [subscriberId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subscriber not found' });
      }
      
      const subscriber = result.rows[0];
      
      // Remove sensitive data
      delete subscriber.voice_print_hash;
      
      res.json(subscriber);
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Error fetching subscriber:', error);
    res.status(500).json({ error: 'Failed to fetch subscriber details' });
  }
});

// Get all subscribers (admin access with pagination)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
  query('search').optional().trim().isLength({ min: 2, max: 100 })
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
    const search = req.query.search;
    
    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      if (status) {
        paramCount++;
        whereClause += ` AND s.subscription_status = $${paramCount}`;
        params.push(status);
      }
      
      if (search) {
        paramCount++;
        whereClause += ` AND (s.name ILIKE $${paramCount} OR s.phone_number LIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total FROM subscribers s ${whereClause}
      `, params);
      
      const totalCount = parseInt(countResult.rows[0].total);
      
      // Get subscribers with pagination
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);
      
      const result = await client.query(`
        SELECT s.id, s.name, s.phone_number, s.email, s.subscription_tier, 
               s.subscription_status, s.voice_enrollment_completed, s.enrolled_by,
               s.family_contact_email, s.created_at,
               COUNT(cs.id) as total_calls,
               MAX(cs.start_time) as last_call_date,
               mu.total_calls as monthly_calls
        FROM subscribers s
        LEFT JOIN call_sessions cs ON s.id = cs.subscriber_id
        LEFT JOIN monthly_usage mu ON s.id = mu.subscriber_id 
                 AND mu.billing_month = DATE_TRUNC('month', CURRENT_DATE)
        ${whereClause}
        GROUP BY s.id, mu.total_calls
        ORDER BY s.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);
      
      res.json({
        subscribers: result.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Update subscriber (admin access)
router.put('/:id', [
  param('id').isInt().withMessage('Invalid subscriber ID'),
  body('name').optional().trim().isLength({ min: 2, max: 255 }),
  body('email').optional().isEmail(),
  body('subscriptionTier').optional().isIn(['basic', 'premium', 'family']),
  body('subscriptionStatus').optional().isIn(['active', 'inactive', 'suspended']),
  body('monthlyCallLimit').optional().isInt({ min: 0, max: 10000 }),
  body('preferredVoiceSpeed').optional().isIn(['slow', 'normal', 'fast']),
  body('hearingAssistance').optional().isBoolean()
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const subscriberId = req.params.id;
    const updates = req.body;
    
    // Build dynamic update query
    const allowedFields = [
      'name', 'email', 'subscription_tier', 'subscription_status', 
      'monthly_call_limit', 'preferred_voice_speed', 'hearing_assistance'
    ];
    
    const updateFields = [];
    const params = [subscriberId];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        paramCount++;
        updateFields.push(`${dbField} = $${paramCount}`);
        params.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        UPDATE subscribers 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, phone_number, subscription_tier, subscription_status
      `, params);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subscriber not found' });
      }
      
      logger.info(`Subscriber ${subscriberId} updated by admin ${req.user.id}`);
      
      res.json({
        success: true,
        subscriber: result.rows[0]
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

// Get subscriber usage analytics
router.get('/:id/usage', [
  param('id').isInt().withMessage('Invalid subscriber ID'),
  query('months').optional().isInt({ min: 1, max: 12 }).withMessage('Months must be between 1 and 12')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const subscriberId = req.params.id;
    const months = parseInt(req.query.months) || 3;
    
    const client = await createDbConnection();
    
    try {
      await client.connect();
      
      // Get monthly usage data
      const usageResult = await client.query(`
        SELECT billing_month, total_calls, ai_handled_calls, human_escalated_calls,
               average_satisfaction, resolution_rate, total_cost_cents
        FROM monthly_usage
        WHERE subscriber_id = $1
        AND billing_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months')
        ORDER BY billing_month DESC
      `, [subscriberId]);
      
      // Get recent call details
      const callsResult = await client.query(`
        SELECT cs.start_time, cs.duration_seconds, cs.status,
               si.issue_category, si.was_resolved, si.satisfaction_rating,
               si.handled_by, si.escalated_to_human
        FROM call_sessions cs
        LEFT JOIN support_interactions si ON cs.id = si.call_session_id
        WHERE cs.subscriber_id = $1
        ORDER BY cs.start_time DESC
        LIMIT 20
      `, [subscriberId]);
      
      res.json({
        monthlyUsage: usageResult.rows,
        recentCalls: callsResult.rows,
        summary: {
          totalCallsThisMonth: usageResult.rows[0]?.total_calls || 0,
          averageSatisfaction: usageResult.rows[0]?.average_satisfaction || null,
          resolutionRate: usageResult.rows[0]?.resolution_rate || null
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    logger.error('Error fetching subscriber usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// Get pending signups (admin access)
router.get('/admin/pending-signups', [
  query('status').optional().isIn(['awaiting_voice_enrollment', 'collecting_info', 'expired']),
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
               created_at, expires_at
        FROM pending_signups
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);
      
      res.json({
        pendingSignups: result.rows
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