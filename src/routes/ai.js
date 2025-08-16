// src/routes/ai.js - AI service routes
const express = require('express');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const router = express.Router();

// Test endpoint to generate AI responses
router.post('/generate', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        example: { query: "How do I reset my password?" }
      });
    }

    logger.info(`AI response request: "${query}"`);
    
    // Use your aiService to generate response
    const result = await aiService.generateSupportResponse(query);
    
    res.json({
      success: true,
      data: {
        query: result.userQuery,
        response: result.aiResponse,
        confidence: result.confidence,
        knowledge_base_results: result.knowledgeBaseResults?.length || 0,
        response_length: result.responseLength
      }
    });
    
  } catch (error) {
    logger.error('AI response generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: error.message
    });
  }
});

// Test endpoint for sentiment analysis
router.post('/sentiment', async (req, res) => {
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
});

// Health check endpoint for AI service
router.get('/health', async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('AI health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Test message validation endpoint
router.post('/validate', async (req, res) => {
  try {
    const { message, type = 'message' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
        example: { message: "Your test message here", type: "message" }
      });
    }

    await aiService.validateMessageLength(message, type);
    
    res.json({
      success: true,
      message: 'Message validation passed',
      length: message.length,
      type: type
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      length: message?.length || 0,
      type: type
    });
  }
});

// Get current message limits from SSM
router.get('/limits', async (req, res) => {
  try {
    const limits = await aiService.getMessageLimits();
    res.json({
      success: true,
      data: limits
    });
  } catch (error) {
    logger.error('Failed to get message limits:', error);
    res.status(500).json({
      error: 'Failed to get message limits',
      message: error.message
    });
  }
});

module.exports = router;