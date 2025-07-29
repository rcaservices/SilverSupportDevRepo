const { Anthropic } = require('@anthropic-ai/sdk');
const knowledgeBaseService = require('./knowledgeBaseService');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateSupportResponse(userQuery) {
    try {
      // First, search the knowledge base
      const kbResults = await knowledgeBaseService.searchFAQs(userQuery, 3);
      
      // Create context from knowledge base results
      const context = kbResults.map(result => 
        `FAQ: ${result.title}\nContent: ${result.content}\nSteps: ${result.solutionSteps.join(', ')}`
      ).join('\n\n');

      // Generate AI response using Claude
      const prompt = `You are a helpful technical support agent. A customer is asking: "${userQuery}"

Based on the following knowledge base information:
${context}

Please provide a helpful, friendly response that:
1. Directly addresses their question
2. Uses the relevant information from the knowledge base
3. Provides clear, step-by-step instructions if applicable
4. Maintains a professional but friendly tone
5. If no relevant information is found, politely explain and offer to escalate

Keep the response conversational and under 200 words.`;

      const response = await this.anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return {
        userQuery,
        aiResponse: response.content[0].text,
        knowledgeBaseResults: kbResults,
        confidence: kbResults.length > 0 ? 'high' : 'low',
        source: 'claude_with_kb'
      };

    } catch (error) {
      logger.error('AI response generation failed:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }

  async analyzeSentiment(text) {
    try {
      const response = await this.anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Analyze the sentiment of this customer message and provide a JSON response:
"${text}"

Return only JSON in this format:
{
  "sentiment": "positive|neutral|negative",
  "score": -1.0 to 1.0,
  "urgency": 1-5,
  "escalation_recommended": true/false,
  "emotion": "frustrated|angry|satisfied|confused|neutral"
}`
        }]
      });

      return JSON.parse(response.content[0].text);
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      // Return default neutral sentiment if analysis fails
      return {
        sentiment: 'neutral',
        score: 0.0,
        urgency: 2,
        escalation_recommended: false,
        emotion: 'neutral'
      };
    }
  }
}

module.exports = new AIService();
