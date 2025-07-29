const { Anthropic } = require('@anthropic-ai/sdk');
const knowledgeBaseService = require('./knowledgeBaseService');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  // Extract key terms from user query for better search
  extractSearchTerms(query) {
    const commonWords = ['how', 'do', 'can', 'what', 'where', 'when', 'why', 'is', 'are', 'the', 'a', 'an', 'to', 'i', 'my', 'me'];
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return words.slice(0, 3); // Take top 3 meaningful words
  }

  async generateSupportResponse(userQuery) {
    try {
      // Extract search terms and try multiple searches
      const searchTerms = this.extractSearchTerms(userQuery);
      logger.info(`Extracted search terms: ${searchTerms.join(', ')}`);
      
      let kbResults = [];
      
      // Try searching with each extracted term
      for (const term of searchTerms) {
        const results = await knowledgeBaseService.searchFAQs(term, 2);
        kbResults = kbResults.concat(results);
      }
      
      // Remove duplicates based on ID
      kbResults = kbResults.filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id)
      );
      
      // Sort by relevance score and take top 3
      kbResults = kbResults.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
      
      logger.info(`Knowledge base returned ${kbResults.length} unique results`);
      
      // Create context from knowledge base results
      const context = kbResults.length > 0 ? kbResults.map(result => 
        `FAQ: ${result.title}\nContent: ${result.content}\nSolution Steps: ${result.solutionSteps ? result.solutionSteps.join(' → ') : 'No specific steps'}`
      ).join('\n\n---\n\n') : 'No relevant FAQ information found in knowledge base.';

      // Generate AI response using Claude
      const prompt = `You are a helpful technical support agent. A customer is asking: "${userQuery}"

Based on the following knowledge base information:
${context}

Please provide a helpful, friendly response that:
1. Directly answers their question using the knowledge base information when available
2. Provides the step-by-step instructions from the solution steps
3. Maintains a professional but friendly tone
4. If multiple FAQs are relevant, mention the most appropriate one
5. Keep responses under 200 words

Response:`;

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
        searchTermsUsed: searchTerms,
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
