const aiService = require('../services/aiService');
const logger = require('../utils/logger');

class AIController {
  
  async generateResponse(req, res) {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          error: 'Query is required',
          example: { query: "How do I reset my password?" }
        });
      }

      logger.info(`AI response request: "${query}"`);
      
      const result = await aiService.generateSupportResponse(query);
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      logger.error('AI response generation failed:', error);
      res.status(500).json({
        error: 'Failed to generate response',
        message: error.message
      });
    }
  }

  async analyzeSentiment(req, res) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({
          error: 'Text is required for sentiment analysis',
          example: { text: "I'm very frustrated with this service!" }
        });
      }

      logger.info(`Sentiment analysis request for: "${text.substring(0, 50)}..."`);
      
      const sentiment = await aiService.analyzeSentiment(text);
      
      res.json({
        success: true,
        data: sentiment
      });
      
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      res.status(500).json({
        error: 'Failed to analyze sentiment',
        message: error.message
      });
    }
  }
}

module.exports = new AIController();
