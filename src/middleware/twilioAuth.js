// File: src/middleware/twilioAuth.js
const twilio = require('twilio');
const logger = require('../utils/logger');

const validateTwilioSignature = (req, res, next) => {
  // Skip validation in development mode
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_VALIDATION === 'true') {
    logger.warn('Skipping Twilio signature validation in development mode');
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  
  if (!twilioSignature) {
    logger.error('Missing Twilio signature header');
    return res.status(403).json({ error: 'Forbidden: Missing signature' });
  }

  // Construct the full URL
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;
  
  // Get the request body (should be URL-encoded for Twilio webhooks)
  const params = req.body;
  
  try {
    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      params
    );
    
    if (!isValid) {
      logger.error(`Invalid Twilio signature for URL: ${url}`);
      return res.status(403).json({ error: 'Forbidden: Invalid signature' });
    }
    
    logger.debug(`Valid Twilio signature for ${req.path}`);
    next();
    
  } catch (error) {
    logger.error(`Twilio signature validation error: ${error.message}`);
    return res.status(403).json({ error: 'Forbidden: Signature validation failed' });
  }
};

module.exports = validateTwilioSignature;