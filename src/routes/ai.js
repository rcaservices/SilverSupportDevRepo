const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// POST /api/ai/respond - Generate AI response to user query
router.post('/respond', aiController.generateResponse);

// POST /api/ai/sentiment - Analyze sentiment of text
router.post('/sentiment', aiController.analyzeSentiment);

module.exports = router;
