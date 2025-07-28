const express = require('express');
const router = express.Router();

// GET /api/knowledge - Search knowledge base
router.get('/', (req, res) => {
  res.json({ message: 'Knowledge base search - coming soon' });
});

// POST /api/knowledge - Add new article
router.post('/', (req, res) => {
  res.json({ message: 'Add knowledge base article - coming soon' });
});

// POST /api/knowledge/import-faq - Import FAQ data
router.post('/import-faq', (req, res) => {
  res.json({ message: 'FAQ import - coming soon' });
});

module.exports = router;
