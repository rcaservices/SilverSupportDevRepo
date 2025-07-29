const { Client } = require('pg');
const logger = require('../utils/logger');

class CallSessionService {
  async createConnection() {
    return new Client({
      connectionString: process.env.DATABASE_URL
    });
  }

  // Create new call session
  async createCallSession(callSid, phoneNumber, authMethod = null) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        INSERT INTO call_sessions (twilio_call_sid, phone_number, authentication_method, start_time)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `, [callSid, phoneNumber, authMethod]);
      
      logger.info(`Created call session: ${result.rows[0].id}`);
      return result.rows[0];
      
    } finally {
      await client.end();
    }
  }

  // Add transcript to call session
  async addTranscript(sessionId, speaker, content, confidenceScore = null) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        INSERT INTO call_transcripts (call_session_id, speaker, content, confidence_score, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [sessionId, speaker, content, confidenceScore]);
      
      return result.rows[0];
      
    } finally {
      await client.end();
    }
  }

  // Add AI response to session
  async addAIResponse(sessionId, responseType, responseText, kbId = null, success = null) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        INSERT INTO ai_responses (call_session_id, response_type, response_text, knowledge_base_id, success, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [sessionId, responseType, responseText, kbId, success]);
      
      return result.rows[0];
      
    } finally {
      await client.end();
    }
  }

  // Add sentiment analysis
  async addSentimentAnalysis(sessionId, transcriptId, sentimentScore, emotion, urgencyLevel, escalationRecommended) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        INSERT INTO sentiment_analysis (call_session_id, transcript_id, sentiment_score, emotion, urgency_level, escalation_recommended, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [sessionId, transcriptId, sentimentScore, emotion, urgencyLevel, escalationRecommended]);
      
      return result.rows[0];
      
    } finally {
      await client.end();
    }
  }

  // End call session
  async endCallSession(sessionId, duration = null) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        UPDATE call_sessions 
        SET status = 'completed', end_time = NOW(), duration_seconds = $2
        WHERE id = $1
        RETURNING *
      `, [sessionId, duration]);
      
      return result.rows[0];
      
    } finally {
      await client.end();
    }
  }

  // Get call session by Twilio SID
  async getCallSessionBySid(callSid) {
    const client = await this.createConnection();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT * FROM call_sessions WHERE twilio_call_sid = $1
      `, [callSid]);
      
      return result.rows[0] || null;
      
    } finally {
      await client.end();
    }
  }
}

module.exports = new CallSessionService();
