const knowledgeBaseService = require('../services/knowledgeBaseService');
const logger = require('../utils/logger');

class KnowledgeBaseController {
  
  async searchKnowledgeBase(req, res) {
    try {
      const { q: query, limit = 5 } = req.query;
      
      if (!query) {
        return res.status(400).json({
          error: 'Query parameter "q" is required',
          example: '/api/knowledge?q=password reset'
        });
      }

      logger.info(`Knowledge base search: "${query}"`);
      
      const results = await knowledgeBaseService.searchFAQs(query, parseInt(limit));
      
      res.json({
        query,
        results: results.length,
        data: results
      });
      
    } catch (error) {
      logger.error('Knowledge base search failed:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await knowledgeBaseService.getAllCategories();
      
      res.json({
        categories
      });
      
    } catch (error) {
      logger.error('Failed to get categories:', error);
      res.status(500).json({
        error: 'Failed to get categories',
        message: error.message
      });
    }
  }

  async healthCheck(req, res) {
    res.json({
      message: 'Knowledge base service is running',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new KnowledgeBaseController();
