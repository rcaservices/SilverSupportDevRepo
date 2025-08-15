const parameterStore = require('../config/parameterStore');

class AIService {
  constructor() {
    this.messageLimits = null;
    this.initializeMessageLimits();
  }

  async initializeMessageLimits() {
    try {
      this.messageLimits = await parameterStore.getMessageLimits();
      logger.info('Message limits loaded:', this.messageLimits);
    } catch (error) {
      logger.warn('Failed to load message limits, using defaults');
      this.messageLimits = {
        maxMessageLength: 8000,
        maxTranscriptionLength: 5000,
        maxAiRequestLength: 8000
      };
    }
  }

  validateMessageLength(message, type = 'message') {
    if (!this.messageLimits) return true;

    const limits = {
      message: this.messageLimits.maxMessageLength,
      transcription: this.messageLimits.maxTranscriptionLength,
      ai_request: this.messageLimits.maxAiRequestLength
    };

    const maxLength = limits[type] || 8000;
    
    if (message && message.length > maxLength) {
      throw new Error(`${type} too long (${message.length} characters). Maximum allowed: ${maxLength} characters.`);
    }
    
    return true;
  }
}