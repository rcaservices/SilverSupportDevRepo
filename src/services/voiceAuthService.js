// File: src/services/voiceAuthService.js
const { Client } = require('pg');
const crypto = require('crypto');
const logger = require('../utils/logger');
const whisperService = require('./whisperService');

class VoiceAuthService {
  constructor() {
    this.confidenceThreshold = 0.75;
    this.enrollmentPhrases = [
      "This is {name} and I live on {street}",
      "My name is {name} and my phone number is {phone}",
      "Hello, this is {name} calling for technical support"
    ];
  }

  /**
   * Main authentication flow for incoming calls
   */
  async authenticateOrEnroll(callSid, audioUrl, phoneNumber, spokenText = null) {
    try {
      logger.info(`Voice auth processing call ${callSid} from ${phoneNumber}`);
      
      // Step 1: Get or create call session
      const callSession = await this.getOrCreateCallSession(callSid, phoneNumber);
      
      // Step 2: Process the audio if provided
      let voiceFeatures = null;
      if (audioUrl) {
        voiceFeatures = await this.extractVoiceFeatures(audioUrl, spokenText);
      }
      
      // Step 3: Check for existing subscriber
      const existingSubscriber = await this.findSubscriberByPhone(phoneNumber);
      
      if (existingSubscriber && existingSubscriber.voice_enrollment_completed) {
        // Existing subscriber with voice print
        const authResult = await this.authenticateExistingUser(
          existingSubscriber, voiceFeatures, callSession.id
        );
        return authResult;
      }
      
      // Step 4: Check for pending signup
      const pendingSignup = await this.findPendingSignup(phoneNumber);
      
      if (pendingSignup) {
        // Complete enrollment for pre-registered user
        return {
          action: 'complete_enrollment',
          callSessionId: callSession.id,
          pendingSignup: pendingSignup,
          voiceFeatures: voiceFeatures,
          message: `Hello! I see your family signed you up for our service. Let's finish setting up your voice recognition.`
        };
      }
      
      if (existingSubscriber && !existingSubscriber.voice_enrollment_completed) {
        // Subscriber exists but needs voice enrollment
        return {
          action: 'complete_voice_enrollment',
          callSessionId: callSession.id,
          subscriber: existingSubscriber,
          voiceFeatures: voiceFeatures,
          message: `Hello ${existingSubscriber.name}! Let's set up your voice recognition so I can recognize you next time.`
        };
      }
      
      // Step 5: Completely new caller
      return {
        action: 'start_signup_flow',
        callSessionId: callSession.id,
        phoneNumber: phoneNumber,
        spokenText: spokenText,
        message: 'Hello! I don\'t have you in our system yet. Would you like to sign up for our technical support service?'
      };
      
    } catch (error) {
      logger.error(`Voice authentication error: ${error.message}`);
      return {
        action: 'fallback_to_human',
        error: error.message,
        message: 'Let me connect you with one of our helpful agents right away.'
      };
    }
  }

  /**
   * Extract voice features from audio (simplified version)
   * In production, this would integrate with Azure Voice ID or AWS Connect
   */
  async extractVoiceFeatures(audioUrl, spokenText = null) {
    try {
      // First, get transcription if we don't have spoken text
      if (!spokenText && audioUrl) {
        const transcription = await whisperService.transcribeAudio(audioUrl);
        spokenText = transcription.text;
      }
      
      // For now, create a simple voice fingerprint
      // In production, replace this with actual voice biometric analysis
      const voiceprint = this.createSimpleVoiceprint(audioUrl, spokenText);
      
      return {
        voiceprint_hash: voiceprint,
        spoken_text: spokenText,
        confidence: 0.85, // Simulated confidence
        audio_quality: 'good',
        audio_duration: 5, // Simulated duration
        background_noise: 'low'
      };
      
    } catch (error) {
      logger.error(`Voice feature extraction error: ${error.message}`);
      throw new Error('Could not process voice sample');
    }
  }

  /**
   * Create a simple voice fingerprint (placeholder for real voice ID)
   */
  createSimpleVoiceprint(audioUrl, spokenText) {
    // This is a simplified version - in production use proper voice biometrics
    const combined = `${audioUrl}:${spokenText}:${Date.now()}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Authenticate existing user with voice comparison
   */
  async authenticateExistingUser(subscriber, voiceFeatures, callSessionId) {
    const client = await this.createDbConnection();
    
    try {
      await client.connect();
      
      // Record authentication attempt
      const authAttempt = await client.query(`
        INSERT INTO voice_auth_attempts (
          call_session_id, phone_number, confidence_score, voice_quality,
          audio_duration_seconds, background_noise_level, auth_successful
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        callSessionId,
        subscriber.phone_number,
        voiceFeatures?.confidence || 0,
        voiceFeatures?.audio_quality || 'unknown',
        voiceFeatures?.audio_duration || 0,
        voiceFeatures?.background_noise || 'unknown',
        false // Will update if successful
      ]);
      
      // Compare voice prints (simplified)
      const voiceMatch = this.compareVoiceprints(
        voiceFeatures?.voiceprint_hash,
        subscriber.voice_print_hash
      );
      
      const isAuthenticated = voiceMatch.confidence >= this.confidenceThreshold;
      
      // Update authentication attempt
      await client.query(`
        UPDATE voice_auth_attempts 
        SET auth_successful = $1, confidence_score = $2, action_taken = $3
        WHERE id = $4
      `, [
        isAuthenticated,
        voiceMatch.confidence,
        isAuthenticated ? 'proceed' : 'request_enrollment',
        authAttempt.rows[0].id
      ]);
      
      // Update call session
      await client.query(`
        UPDATE call_sessions 
        SET subscriber_id = $1, voice_auth_id = $2, auth_confidence = $3,
            authentication_success = $4
        WHERE id = $5
      `, [
        subscriber.id,
        authAttempt.rows[0].id,
        voiceMatch.confidence,
        isAuthenticated,
        callSessionId
      ]);
      
      if (isAuthenticated) {
        // Update monthly usage
        await this.incrementMonthlyUsage(subscriber.id);
        
        return {
          action: 'proceed_with_support',
          subscriber: subscriber,
          confidence: voiceMatch.confidence,
          callSessionId: callSessionId,
          message: `Hi ${subscriber.name}! I recognize your voice. How can I help you today?`
        };
      } else {
        return {
          action: 'request_re_enrollment',
          subscriber: subscriber,
          confidence: voiceMatch.confidence,
          callSessionId: callSessionId,
          message: `Hi ${subscriber.name}! I'm having trouble recognizing your voice. Let's quickly update your voice recognition.`
        };
      }
      
    } finally {
      await client.end();
    }
  }

  /**
   * Complete voice enrollment for new or existing user
   */
  async completeVoiceEnrollment(callSessionId, subscriberData, voiceFeatures, enrollmentPhrase) {
    const client = await this.createDbConnection();
    
    try {
      await client.connect();
      await client.query('BEGIN');
      
      let subscriber;
      
      if (subscriberData.id) {
        // Update existing subscriber
        const result = await client.query(`
          UPDATE subscribers 
          SET voice_print_hash = $1, enrollment_phrase = $2, 
              voice_enrollment_completed = true, updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [
          voiceFeatures.voiceprint_hash,
          enrollmentPhrase,
          subscriberData.id
        ]);
        subscriber = result.rows[0];
      } else {
        // Create new subscriber from pending signup
        const result = await client.query(`
          INSERT INTO subscribers (
            name, phone_number, email, address_street, address_city, address_state,
            voice_print_hash, enrollment_phrase, voice_enrollment_completed,
            subscription_tier, family_contact_email, enrolled_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)
          RETURNING *
        `, [
          subscriberData.senior_name,
          subscriberData.senior_phone_number,
          subscriberData.family_email,
          subscriberData.address_street,
          subscriberData.address_city,
          subscriberData.address_state,
          voiceFeatures.voiceprint_hash,
          enrollmentPhrase,
          subscriberData.selected_tier || 'basic',
          subscriberData.family_email,
          subscriberData.family_member_name
        ]);
        subscriber = result.rows[0];
        
        // Mark pending signup as completed
        if (subscriberData.signup_id) {
          await client.query(`
            UPDATE pending_signups 
            SET status = 'completed', completed_at = NOW()
            WHERE id = $1
          `, [subscriberData.signup_id]);
        }
      }
      
      // Record successful enrollment
      await client.query(`
        INSERT INTO voice_auth_attempts (
          call_session_id, phone_number, confidence_score, voice_quality,
          auth_successful, action_taken
        ) VALUES ($1, $2, $3, $4, true, 'enrollment_completed')
      `, [
        callSessionId,
        subscriber.phone_number,
        voiceFeatures.confidence,
        voiceFeatures.audio_quality
      ]);
      
      // Update call session
      await client.query(`
        UPDATE call_sessions 
        SET subscriber_id = $1, authentication_success = true, call_type = 'enrollment'
        WHERE id = $2
      `, [subscriber.id, callSessionId]);
      
      await client.query('COMMIT');
      
      logger.info(`Voice enrollment completed for subscriber ${subscriber.id}`);
      
      return {
        action: 'enrollment_completed',
        subscriber: subscriber,
        message: `Perfect! I've learned your voice, ${subscriber.name}. You're all set up! How can I help you today?`
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Start phone-based signup flow
   */
  async startPhoneSignup(callSessionId, phoneNumber, customerInfo) {
    const client = await this.createDbConnection();
    
    try {
      await client.connect();
      
      // Create pending signup
      const result = await client.query(`
        INSERT INTO pending_signups (
          senior_name, senior_phone_number, address_street,
          family_member_name, family_email, family_phone,
          relationship, selected_tier, signup_method, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'phone', 'collecting_info')
        RETURNING *
      `, [
        customerInfo.name,
        phoneNumber,
        customerInfo.address || '',
        customerInfo.familyName || 'Self',
        customerInfo.familyEmail || '',
        customerInfo.familyPhone || '',
        customerInfo.relationship || 'self',
        customerInfo.tier || 'basic'
      ]);
      
      return {
        action: 'continue_signup',
        pendingSignup: result.rows[0],
        callSessionId: callSessionId,
        message: 'Great! Let me get some basic information to set up your account.'
      };
      
    } finally {
      await client.end();
    }
  }

  /**
   * Compare voice prints (simplified version)
   */
  compareVoiceprints(newVoiceprint, storedVoiceprint) {
    if (!newVoiceprint || !storedVoiceprint) {
      return { confidence: 0.0, match: false };
    }
    
    // Simplified comparison - in production use proper voice biometric comparison
    const similarity = newVoiceprint === storedVoiceprint ? 0.95 : 0.45;
    
    return {
      confidence: similarity,
      match: similarity >= this.confidenceThreshold
    };
  }

  /**
   * Generate enrollment phrase for user
   */
  generateEnrollmentPhrase(subscriberData) {
    const templates = this.enrollmentPhrases;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return template
      .replace('{name}', subscriberData.name || subscriberData.senior_name)
      .replace('{street}', subscriberData.address_street || 'Main Street')
      .replace('{phone}', subscriberData.phone_number || subscriberData.senior_phone_number);
  }

  // Helper methods
  async createDbConnection() {
    return new Client({
      connectionString: process.env.DATABASE_URL
    });
  }

  async getOrCreateCallSession(callSid, phoneNumber) {
    const callSessionService = require('./callSessionService');
    try {
      let session = await callSessionService.getCallSessionBySid(callSid);
      if (!session) {
        session = await callSessionService.createCallSession(callSid, phoneNumber, 'voice_auth');
      }
      return session;
    } catch (error) {
      logger.error(`Error with call session: ${error.message}`);
      throw error;
    }
  }

  async findSubscriberByPhone(phoneNumber) {
    const client = await this.createDbConnection();
    try {
      await client.connect();
      const result = await client.query(`
        SELECT * FROM subscribers 
        WHERE phone_number = $1 AND subscription_status = 'active'
      `, [phoneNumber]);
      return result.rows[0] || null;
    } finally {
      await client.end();
    }
  }

  async findPendingSignup(phoneNumber) {
    const client = await this.createDbConnection();
    try {
      await client.connect();
      const result = await client.query(`
        SELECT * FROM pending_signups 
        WHERE senior_phone_number = $1 
        AND status IN ('awaiting_voice_enrollment', 'collecting_info')
        AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [phoneNumber]);
      return result.rows[0] || null;
    } finally {
      await client.end();
    }
  }

  async incrementMonthlyUsage(subscriberId) {
    const client = await this.createDbConnection();
    try {
      await client.connect();
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      await client.query(`
        INSERT INTO monthly_usage (subscriber_id, billing_month, total_calls, ai_handled_calls)
        VALUES ($1, $2, 1, 1)
        ON CONFLICT (subscriber_id, billing_month)
        DO UPDATE SET 
          total_calls = monthly_usage.total_calls + 1,
          ai_handled_calls = monthly_usage.ai_handled_calls + 1
      `, [subscriberId, currentMonth]);
    } catch (error) {
      logger.warn(`Could not update monthly usage: ${error.message}`);
    } finally {
      await client.end();
    }
  }
}

module.exports = new VoiceAuthService();