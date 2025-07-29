const express = require('express');
const router = express.Router();
const knowledgeBaseController = require('../controllers/knowledgeBaseController');

// GET /api/knowledge/health - Health check (specific routes first)
router.get('/health', knowledgeBaseController.healthCheck);

// GET /api/knowledge/categories - Get all categories (specific routes first)
router.get('/categories', knowledgeBaseController.getCategories);

// GET /api/knowledge - Search knowledge base (general route last)
router.get('/', knowledgeBaseController.searchKnowledgeBase);

// POST /api/knowledge - Add new article (placeholder for now)
router.post('/', (req, res) => {
  res.json({ message: 'Add knowledge base article - coming soon' });
});

// POST /api/knowledge/import-faq - Import FAQ data (placeholder for now)
router.post('/import-faq', (req, res) => {
  res.json({ message: 'FAQ import - coming soon' });
});

module.exports = router;
