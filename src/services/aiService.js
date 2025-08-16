// File: src/services/aiService.js (Complete Fixed Version with AWS SSM Integration)
const { Anthropic } = require('@anthropic-ai/sdk');
const knowledgeBaseService = require('./knowledgeBaseService');
const logger = require('../utils/logger');
const AWS = require('aws-sdk');

class AIService {
  constructor() {
    // Initialize Anthropic client
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY not found. AI features will be disabled.');
      this.anthropic = null;
    } else {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      logger.info('Anthropic AI service initialized');
    }

    // Initialize AWS SSM client
    this.ssm = new AWS.SSM({ region: process.env.AWS_REGION || 'us-east-1' });
    
    // Cache for message limits to avoid repeated SSM calls
    this.messageLimitsCache = null;
    this.cacheExpiry = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get message limits from AWS SSM Parameter Store
  async getMessageLimits() {
    try {
      // Check cache first
      if (this.messageLimitsCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.messageLimitsCache;
      }

      const result = await this.ssm.getParameter({
        Name: '/prod/ai-support/config/message-limits'
      }).promise();
      
      const limits = JSON.parse(result.Parameter.Value);
      
      // Cache the result
      this.messageLimitsCache = limits;
      this.cacheExpiry = Date.now() + this.cacheTimeout;
      
      logger.info('Message limits loaded from SSM:', limits);
      return limits;
      
    } catch (error) {
      logger.warn('Failed to get message limits from SSM, using defaults:', error.message);
      
      // Fallback to default values
      const defaultLimits = {
        maxMessageLength: 8000,
        maxTranscriptionLength: 5000,
        maxWebhookBodySize: 10000,
        maxAiRequestLength: 8000,
        enableValidation: true
      };
      
      // Cache the defaults too
      this.messageLimitsCache = defaultLimits;
      this.cacheExpiry = Date.now() + this.cacheTimeout;
      
      return defaultLimits;
    }
  }

  // Message length validation with dynamic limits from SSM
  async validateMessageLength(message, type = 'message') {
    if (!message) return true;
    
    try {
      const limits = await this.getMessageLimits();
      
      // Skip validation if disabled
      if (!limits.enableValidation) {
        return true;
      }
      
      const maxLengths = {
        message: limits.maxMessageLength,
        transcription: limits.maxTranscriptionLength,
        ai_request: limits.maxAiRequestLength,
        webhook_body: limits.maxWebhookBodySize
      };

      const maxLength = maxLengths[type] || limits.maxMessageLength;
      
      if (message.length > maxLength) {
        const error = new Error(`${type} too long (${message.length} characters). Maximum allowed: ${maxLength} characters.`);
        logger.warn('Message validation failed:', {
          type,
          messageLength: message.length,
          maxLength,
          preview: message.substring(0, 100) + '...'
        });
        throw error;
      }
      
      return true;
      
    } catch (error) {
      if (error.message.includes('too long')) {
        throw error; // Re-throw validation errors
      }
      
      // Log SSM errors but don't fail validation
      logger.warn('Message validation failed due to SSM error, allowing message:', error.message);
      return true;
    }
  }

  // Extract key terms from user query for better search
  extractSearchTerms(query) {
    if (!query) return [];
    
    const commonWords = ['how', 'do', 'can', 'what', 'where', 'when', 'why', 'is', 'are', 'the', 'a', 'an', 'to', 'i', 'my', 'me', 'with', 'and', 'or', 'but'];
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return [...new Set(words)].slice(0, 5); // Remove duplicates and take top 5
  }

  // Remove duplicate knowledge base results
  removeDuplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.question + result.answer;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Generate support response with knowledge base integration and message validation
  async generateSupportResponse(userQuery) {
    try {
      // Validate input message length
      await this.validateMessageLength(userQuery, 'ai_request');
      
      if (!this.anthropic) {
        throw new Error('AI service not available - missing API key');
      }

      logger.info(`Generating AI response for query: "${userQuery}"`);
      
      // Search knowledge base for relevant information
      let kbResults = [];
      let context = '';
      let searchTerms = [];
      
      try {
        // Extract key terms from the user query for knowledge base search
        searchTerms = this.extractSearchTerms(userQuery);
        logger.info(`Search terms extracted: ${searchTerms.join(', ')}`);
        
        // Search knowledge base with extracted terms
        for (const term of searchTerms.slice(0, 3)) { // Limit to top 3 terms
          const results = await knowledgeBaseService.searchFAQs(term, 3);
          kbResults = kbResults.concat(results);
        }
        
        // Remove duplicates and limit results
        kbResults = this.removeDuplicateResults(kbResults).slice(0, 5);
        
        // Build context from knowledge base results
        if (kbResults.length > 0) {
          context = kbResults.map(result => 
            `Topic: ${result.question}\nSolution: ${result.answer}\nSteps: ${result.solution_steps || 'None provided'}`
          ).join('\n\n');
          
          logger.info(`Found ${kbResults.length} relevant knowledge base entries`);
        } else {
          context = 'No specific knowledge base information found for this query.';
          logger.info('No relevant knowledge base entries found');
        }
        
      } catch (kbError) {
        logger.warn(`Knowledge base search failed: ${kbError.message}`);
        context = 'Knowledge base temporarily unavailable.';
      }

      // Generate AI response using Claude
      const prompt = `You are a helpful technical support agent. A customer is asking: "${userQuery}"

Based on the following knowledge base information:
${context}

Please provide a helpful, friendly response that:
1. Directly answers their question using the knowledge base information when available
2. Provides step-by-step instructions from the solution steps
3. Maintains a professional but friendly tone
4. If multiple FAQs are relevant, mention the most appropriate one
5. Keep responses under 200 words
6. If no specific knowledge base information is available, provide general helpful guidance

Response:`;

      // Validate prompt length before sending to AI
      await this.validateMessageLength(prompt, 'ai_request');

      const response = await this.anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const aiResponseText = response.content[0].text;
      logger.info(`AI response generated successfully (${aiResponseText.length} characters)`);

      return {
        userQuery,
        aiResponse: aiResponseText,
        knowledgeBaseResults: kbResults,
        searchTermsUsed: searchTerms,
        confidence: kbResults.length > 0 ? 'high' : 'medium',
        source: 'claude_with_kb',
        responseLength: aiResponseText.length
      };

    } catch (error) {
      logger.error('AI response generation failed:', error);
      
      // Return a fallback response instead of throwing
      return {
        userQuery: userQuery || 'Unknown query',
        aiResponse: 'I apologize, but I\'m having trouble processing your request right now. Let me connect you with a human agent who can better assist you.',
        knowledgeBaseResults: [],
        searchTermsUsed: [],
        confidence: 'low',
        source: 'fallback',
        error: error.message
      };
    }
  }

  // Analyze sentiment of customer message
  async analyzeSentiment(text) {
    try {
      // Validate input length
      await this.validateMessageLength(text, 'message');
      
      if (!this.anthropic) {
        // Return neutral sentiment if AI not available
        return this.getFallbackSentiment(text);
      }

      const response = await this.anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `Analyze the sentiment of this customer message and provide a JSON response:
"${text}"

Return only valid JSON in this exact format:
{
  "sentiment": "positive|neutral|negative",
  "score": -1.0 to 1.0,
  "urgency": 1-5,
  "escalation_recommended": true/false,
  "emotion": "frustrated|angry|satisfied|confused|neutral|worried"
}`
        }]
      });

      try {
        const sentimentData = JSON.parse(response.content[0].text);
        logger.info(`Sentiment analysis completed: ${sentimentData.sentiment} (${sentimentData.score})`);
        return sentimentData;
      } catch (parseError) {
        logger.warn('Failed to parse sentiment JSON, using fallback');
        return this.getFallbackSentiment(text);
      }

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return this.getFallbackSentiment(text);
    }
  }

  // Fallback sentiment analysis using simple keyword matching
  getFallbackSentiment(text) {
    if (!text) {
      return {
        sentiment: 'neutral',
        score: 0.0,
        urgency: 2,
        escalation_recommended: false,
        emotion: 'neutral'
      };
    }

    const lowerText = text.toLowerCase();
    
    // Simple keyword-based sentiment analysis
    const negativeWords = ['angry', 'frustrated', 'hate', 'terrible', 'awful', 'horrible', 'broken', 'doesn\'t work', 'not working', 'problem', 'issue', 'error'];
    const positiveWords = ['good', 'great', 'excellent', 'works', 'working', 'perfect', 'love', 'thank', 'thanks', 'helpful'];
    const urgentWords = ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'important', 'stuck', 'can\'t'];
    
    let score = 0;
    let urgency = 2;
    let emotion = 'neutral';
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) {
        score -= 0.3;
        emotion = 'frustrated';
      }
    });
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) {
        score += 0.3;
        emotion = 'satisfied';
      }
    });
    
    urgentWords.forEach(word => {
      if (lowerText.includes(word)) {
        urgency = Math.min(urgency + 1, 5);
      }
    });
    
    // Clamp score between -1 and 1
    score = Math.max(-1, Math.min(1, score));
    
    let sentiment = 'neutral';
    if (score > 0.2) sentiment = 'positive';
    if (score < -0.2) sentiment = 'negative';
    
    return {
      sentiment,
      score: Math.round(score * 100) / 100,
      urgency,
      escalation_recommended: urgency > 3 || score < -0.5,
      emotion
    };
  }

  // Health check for the AI service
  async healthCheck() {
    try {
      const status = {
        status: 'healthy',
        features: {
          ai_responses: !!this.anthropic,
          message_validation: true,
          sentiment_analysis: !!this.anthropic,
          knowledge_base: true,
          ssm_parameters: true
        },
        message_limits: null,
        timestamp: new Date().toISOString()
      };

      // Test message limits retrieval
      try {
        status.message_limits = await this.getMessageLimits();
      } catch (error) {
        status.features.ssm_parameters = false;
        status.status = 'degraded';
        logger.warn('Health check: SSM parameter retrieval failed');
      }

      // Test AI service if available
      if (this.anthropic) {
        try {
          const testResponse = await this.anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [{
              role: 'user',
              content: 'Say "OK" if you can hear me.'
            }]
          });
          status.test_response = testResponse.content[0].text;
        } catch (aiError) {
          status.features.ai_responses = false;
          status.status = 'degraded';
          logger.warn('Health check: AI service test failed');
        }
      }

      logger.info('Health check completed:', status.status);
      return status;

    } catch (error) {
      logger.error('AI service health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        features: {
          ai_responses: false,
          message_validation: false,
          sentiment_analysis: false,
          knowledge_base: false,
          ssm_parameters: false
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new AIService();