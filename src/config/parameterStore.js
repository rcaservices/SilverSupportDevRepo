const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class ParameterStore {
  constructor() {
    this.ssm = new AWS.SSM({ region: process.env.AWS_REGION || 'us-east-1' });
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getParameter(name, decrypt = true) {
    try {
      const cached = this.cache.get(name);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.value;
      }

      const result = await this.ssm.getParameter({
        Name: name,
        WithDecryption: decrypt
      }).promise();

      this.cache.set(name, {
        value: result.Parameter.Value,
        timestamp: Date.now()
      });

      return result.Parameter.Value;
    } catch (error) {
      logger.error(`Failed to get parameter ${name}:`, error);
      throw error;
    }
  }

  async getMessageLimits() {
    const configJson = await this.getParameter('/prod/ai-support/config/message-limits', false);
    return JSON.parse(configJson);
  }
}

module.exports = new ParameterStore();