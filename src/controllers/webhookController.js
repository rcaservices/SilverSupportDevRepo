// File: src/controllers/webhookController.js (Fixed Version)
const twilioService = require('../services/twilioService');
const whisperService = require('../services/whisperService');
const aiService = require('../services/aiService');
const callSessionService = require('../services/callSessionService');
const voiceAuthService = require('../services/voiceAuthService');
const logger = require('../utils/logger');
const twilio = require('twilio');

class WebhookController {
  
  // Handle incoming calls with voice authentication
  async handleIncomingCall(req, res) {
    try {
      const { CallSid, From: phoneNumber, To: twilioNumber } = req.body;
      
      logger.info(`Incoming call: ${CallSid} from ${phoneNumber}`);
      
      // Generate initial TwiML response for voice authentication
      const response = new twilio.twiml.VoiceResponse();
      
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'Hello! Welcome to technical support. Please tell me your name and how I can help you today.');
      
      response.record({
        action: '/webhooks/twilio/voice-auth',
        method: 'POST',
        maxLength: 15,
        playBeep: false,
        finishOnKey: '#',
        timeout: 10
      });
      
      // Fallback if no response
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'I didn\'t hear anything. Let me connect you with an agent.');
      
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
      
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow' 
      }, 'Welcome to technical support. Let me connect you with an agent.');
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle voice authentication
  async handleVoiceAuth(req, res) {
    try {
      const { CallSid, RecordingUrl, From: phoneNumber } = req.body;
      
      logger.info(`Processing voice auth for call: ${CallSid}`);
      
      // Process voice authentication
      const authResult = await voiceAuthService.authenticateOrEnroll(
        CallSid, RecordingUrl, phoneNumber
      );
      
      const response = new twilio.twiml.VoiceResponse();
      
      if (authResult.action === "proceed_with_support") {
        this.handleAuthenticatedUser(response, authResult);
      } else if (authResult.action === "complete_enrollment" || authResult.action === "complete_voice_enrollment") {
        this.handleVoiceEnrollment(response, authResult);
      } else if (authResult.action === "start_signup_flow") {
        this.handleNewUserSignup(response, authResult);
      } else if (authResult.action === "request_re_enrollment") {
        this.handleReEnrollment(response, authResult);
      } else {
        this.handleFallbackToHuman(response, authResult);
      }
          this.handleFallbackToHuman.bind(this)(response, authResult);
      }
      
      res.type('text/xml');
      res.send(response.toString());
      
    } catch (error) {
      logger.error('Error in voice authentication:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'Let me connect you with one of our helpful agents.');
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle authenticated user ready for support
  handleAuthenticatedUser(response, authResult) {
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: authResult.subscriber?.preferred_voice_speed || 'slow'
    }, authResult.message);
    
    response.record({
      action: '/webhooks/twilio/support-request',
      method: 'POST',
      maxLength: 30,
      playBeep: false,
      finishOnKey: '#',
      timeout: 10
    });
    
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, 'I didn\'t hear your question. Let me connect you with an agent.');
    response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
  }

  // Handle voice enrollment for new or existing users
  handleVoiceEnrollment(response, authResult) {
    const enrollmentPhrase = voiceAuthService.generateEnrollmentPhrase(
      authResult.pendingSignup || authResult.subscriber
    );
    
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, `${authResult.message} Please repeat this phrase slowly and clearly: "${enrollmentPhrase}"`);
    
    response.record({
      action: '/webhooks/twilio/complete-enrollment',
      method: 'POST',
      maxLength: 15,
      playBeep: true,
      timeout: 10
    });
    
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, 'Let me connect you with an agent to complete the setup.');
    response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
  }

  // Handle new user signup flow
  handleNewUserSignup(response, authResult) {
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, authResult.message);
    
    response.record({
      action: '/webhooks/twilio/signup-response',
      method: 'POST',
      maxLength: 10,
      playBeep: false,
      timeout: 8
    });
    
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, 'Let me connect you with someone who can help you sign up.');
    response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
  }

  // Handle re-enrollment for existing users with low confidence
  handleReEnrollment(response, authResult) {
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, authResult.message);
    
    const enrollmentPhrase = voiceAuthService.generateEnrollmentPhrase(authResult.subscriber);
    
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, `Please say this phrase clearly: "${enrollmentPhrase}"`);
    
    response.record({
      action: '/webhooks/twilio/re-enrollment',
      method: 'POST',
      maxLength: 15,
      playBeep: true,
      timeout: 10
    });
  }

  // Handle fallback to human agent
  handleFallbackToHuman(response, authResult) {
    response.say({ 
      voice: 'Polly.Joanna-Neural',
      rate: 'slow'
    }, authResult.message || 'Let me connect you with one of our helpful agents.');
    
    response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
  }

  // Complete voice enrollment
  async handleCompleteEnrollment(req, res) {
    try {
      const { CallSid, RecordingUrl, From: phoneNumber } = req.body;
      
      logger.info(`Completing voice enrollment for call: ${CallSid}`);
      
      // Get the call session to retrieve context
      const callSession = await callSessionService.getCallSessionBySid(CallSid);
      if (!callSession) {
        throw new Error('Call session not found');
      }
      
      // Extract voice features from enrollment recording
      const voiceFeatures = await voiceAuthService.extractVoiceFeatures(RecordingUrl);
      
      // Find pending signup or existing subscriber
      const pendingSignup = await voiceAuthService.findPendingSignup(phoneNumber);
      const existingSubscriber = await voiceAuthService.findSubscriberByPhone(phoneNumber);
      
      let enrollmentResult;
      
      if (pendingSignup) {
        // Complete enrollment for pre-registered user
        enrollmentResult = await voiceAuthService.completeVoiceEnrollment(
          callSession.id,
          { ...pendingSignup, signup_id: pendingSignup.id },
          voiceFeatures,
          voiceFeatures.spoken_text
        );
      } else if (existingSubscriber) {
        // Update existing subscriber's voice print
        enrollmentResult = await voiceAuthService.completeVoiceEnrollment(
          callSession.id,
          existingSubscriber,
          voiceFeatures,
          voiceFeatures.spoken_text
        );
      } else {
        throw new Error('No pending signup or existing subscriber found');
      }
      
      const response = new twilio.twiml.VoiceResponse();
      
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, enrollmentResult.message);
      
      // Now proceed with support
      response.record({
        action: '/webhooks/twilio/support-request',
        method: 'POST',
        maxLength: 30,
        playBeep: false,
        finishOnKey: '#',
        timeout: 10
      });
      
      res.type('text/xml');
      res.send(response.toString());
      
    } catch (error) {
      logger.error('Error completing enrollment:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'There was an issue with the enrollment. Let me connect you with an agent.');
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle support requests from authenticated users
  async handleSupportRequest(req, res) {
    try {
      const { CallSid, RecordingUrl, From: phoneNumber } = req.body;
      
      logger.info(`Processing support request for call: ${CallSid}`);
      
      // Get call session and subscriber info
      const callSession = await callSessionService.getCallSessionBySid(CallSid);
      if (!callSession || !callSession.subscriber_id) {
        throw new Error('Authenticated call session not found');
      }
      
      // Transcribe the support request
      const transcription = await whisperService.transcribeAudio(RecordingUrl);
      logger.info(`Support request: "${transcription.text}"`);
      
      // Add to transcript
      await callSessionService.addTranscript(
        callSession.id,
        'customer',
        transcription.text,
        transcription.confidence
      );
      
      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        transcription.text,
        callSession.id,
        { subscriberId: callSession.subscriber_id }
      );
      
      // Record AI response
      await callSessionService.addAIResponse(
        callSession.id,
        'support_response',
        aiResponse.text,
        aiResponse.knowledgeBaseId,
        aiResponse.success
      );
      
      const response = new twilio.twiml.VoiceResponse();
      
      // Check if escalation is needed
      if (aiResponse.escalate || aiResponse.sentiment?.escalationRecommended) {
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'Let me connect you with a specialist who can better help you with this issue.');
        
        response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      } else {
        // Provide AI response
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: callSession.preferred_voice_speed || 'slow'
        }, aiResponse.text);
        
        // Ask if they need more help
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'Does this help, or do you have another question? Say "more help" or "I\'m all set".');
        
        response.record({
          action: '/webhooks/twilio/follow-up',
          method: 'POST',
          maxLength: 10,
          playBeep: false,
          timeout: 8
        });
        
        // Default to goodbye if no response
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'Thank you for calling! Have a wonderful day.');
        response.hangup();
      }
      
      res.type('text/xml');
      res.send(response.toString());
      
    } catch (error) {
      logger.error('Error handling support request:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'I\'m having trouble processing your request. Let me connect you with an agent.');
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle signup response (when new caller indicates interest)
  async handleSignupResponse(req, res) {
    try {
      const { CallSid, RecordingUrl, From: phoneNumber } = req.body;
      
      // Transcribe their response
      const transcription = await whisperService.transcribeAudio(RecordingUrl);
      const responseText = transcription.text.toLowerCase();
      
      const response = new twilio.twiml.VoiceResponse();
      
      if (responseText.includes('sign') || responseText.includes('yes') || responseText.includes('family')) {
        // They want to sign up
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'Wonderful! Let me connect you with someone who can help you get started with our service. They\'ll make it really easy for you.');
        
        response.dial(process.env.SIGNUP_AGENT_NUMBER || process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      } else {
        // Not interested or unclear
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'No problem at all! If you need technical help in the future, please call us back. Have a great day!');
        
        response.hangup();
      }
      
      res.type('text/xml');
      res.send(response.toString());
      
    } catch (error) {
      logger.error('Error handling signup response:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'Let me connect you with someone who can help you.');
      response.dial(process.env.HUMAN_AGENT_NUMBER || '+1-800-555-0199');
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle follow-up after AI response
  async handleFollowUp(req, res) {
    try {
      const { CallSid, RecordingUrl } = req.body;
      
      if (RecordingUrl) {
        const transcription = await whisperService.transcribeAudio(RecordingUrl);
        const followupText = transcription.text.toLowerCase();
        
        const response = new twilio.twiml.VoiceResponse();
        
        if (followupText.includes('more') || followupText.includes('help') || 
            followupText.includes('question') || followupText.includes('another')) {
          // They need more help
          response.say({ 
            voice: 'Polly.Joanna-Neural',
            rate: 'slow'
          }, 'Of course! What else can I help you with?');
          
          response.record({
            action: '/webhooks/twilio/support-request',
            method: 'POST',
            maxLength: 30,
            playBeep: false,
            finishOnKey: '#'
          });
        } else {
          // They're done
          response.say({ 
            voice: 'Polly.Joanna-Neural',
            rate: 'slow'
          }, 'Perfect! Thank you for calling. Remember, you can call us anytime you need help. Have a wonderful day!');
          
          response.hangup();
        }
        
        res.type('text/xml');
        res.send(response.toString());
      } else {
        // No recording, assume they're done
        const response = new twilio.twiml.VoiceResponse();
        response.say({ 
          voice: 'Polly.Joanna-Neural',
          rate: 'slow'
        }, 'Thank you for calling! Have a great day!');
        response.hangup();
        
        res.type('text/xml');
        res.send(response.toString());
      }
      
    } catch (error) {
      logger.error('Error in handleFollowUp:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ 
        voice: 'Polly.Joanna-Neural',
        rate: 'slow'
      }, 'Thank you for calling! Have a wonderful day!');
      response.hangup();
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle call status updates (existing method)
  async handleCallStatus(req, res) {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;
      logger.info(`Call status update: ${CallSid} - ${CallStatus}`);
      
      if (CallStatus === 'completed' && CallDuration) {
        try {
          const session = await callSessionService.getCallSessionBySid(CallSid);
          if (session) {
            await callSessionService.endCallSession(session.id, parseInt(CallDuration));
            logger.info(`Ended call session ${session.id} after ${CallDuration} seconds`);
          }
        } catch (dbError) {
          logger.warn(`Error ending call session: ${dbError.message}`);
        }
      }
      
      res.status(200).send('OK');
      
    } catch (error) {
      logger.error('Error handling call status:', error);
      res.status(200).send('OK');
    }
  }

  // Legacy method for backward compatibility (if you had this)
  async handleRecording(req, res) {
    logger.info('handleRecording called - redirecting to voice auth flow');
    return this.handleVoiceAuth(req, res);
  }
}

module.exports = new WebhookController();