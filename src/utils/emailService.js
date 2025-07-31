// File: src/utils/emailService.js (SIMPLIFIED FOR NOW)
const logger = require('./logger');

class EmailService {
  constructor() {
    logger.info('Email service initialized (simplified mode)');
  }

  async sendSignupConfirmation(familyEmail, seniorName, signupDetails) {
    logger.info('Email would be sent to:', familyEmail, 'for:', seniorName);
    return { success: true, messageId: 'test-' + Date.now() };
  }

  getCallLimitForTier(tier) {
    const limits = {
      'basic': 50,
      'premium': 200,
      'family': 500
    };
    return limits[tier] || 50;
  }

  async healthCheck() {
    return { healthy: true, message: 'Email service is operational (simplified)' };
  }
}

module.exports = new EmailService();
