const twilioService = require('../services/twilioService');
const whisperService = require('../services/whisperService');
const aiService = require('../services/aiService');
const callSessionService = require('../services/callSessionService');
const logger = require('../utils/logger');
const twilio = require('twilio');

class WebhookController {
  
  // Handle incoming calls
  async handleIncomingCall(req, res) {
    try {
      const { CallSid, From: phoneNumber, To: twilioNumber } = req.body;
      
      logger.info(`Incoming call: ${CallSid} from ${phoneNumber}`);
      
      // Create call session in database (with error handling)
      try {
        const session = await callSessionService.createCallSession(CallSid, phoneNumber);
        logger.info(`Created session: ${session.id}`);
      } catch (dbError) {
        logger.warn(`Database error (continuing anyway): ${dbError.message}`);
      }
      
      // Generate TwiML response
      const twimlResponse = twilioService.createIncomingCallResponse();
      
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      
      // Fallback response
      const response = new twilio.twiml.VoiceResponse();
      response.say({ voice: 'alice' }, 'Welcome to technical support. Please hold while we connect you.');
      response.hangup();
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle recorded user message
  async handleRecording(req, res) {
    try {
      const { CallSid, RecordingUrl, RecordingDuration } = req.body;
      
      logger.info(`Processing recording for call: ${CallSid}`);
      logger.info(`Recording URL: ${RecordingUrl}`);
      logger.info(`Recording Duration: ${RecordingDuration} seconds`);
      
      let transcription, aiResponse, session;
      
      try {
        // Get call session
        session = await callSessionService.getCallSessionBySid(CallSid);
        logger.info(`Found session: ${session?.id || 'none'}`);
      } catch (dbError) {
        logger.warn(`Database error getting session: ${dbError.message}`);
      }

      try {
        // Transcribe audio with Whisper
        logger.info('Starting Whisper transcription...');
        transcription = await whisperService.transcribeAudio(RecordingUrl);
        logger.info(`Transcription result: "${transcription.text}" (confidence: ${transcription.confidence})`);
        
      } catch (whisperError) {
        logger.error(`Whisper error: ${whisperError.message}`);
        transcription = { 
          text: "I'm having trouble understanding the audio. Let me provide some general help.", 
          confidence: 0,
          error: true
        };
      }

      // Skip AI processing if transcription failed completely
      if (transcription.error && transcription.confidence === 0) {
        logger.info('Skipping AI processing due to transcription failure');
        aiResponse = {
          aiResponse: "I apologize, but I'm having trouble understanding your question due to audio quality issues. Could you please try calling back and speaking more clearly? Alternatively, you can contact our support team via email for assistance.",
          confidence: 'low'
        };
      } else {
        try {
          // Generate AI response
          logger.info('Generating AI response...');
          aiResponse = await aiService.generateSupportResponse(transcription.text);
          logger.info(`AI response generated successfully (confidence: ${aiResponse.confidence})`);
          
        } catch (aiError) {
          logger.error(`AI service error: ${aiError.message}`);
          aiResponse = {
            aiResponse: "I apologize, but I'm experiencing technical difficulties with my AI systems. Please try calling back in a few minutes, or contact our support team directly for immediate assistance.",
            confidence: 'low'
          };
        }
      }

      // Save to database if possible
      if (session) {
        try {
          await callSessionService.addTranscript(session.id, 'user', transcription.text, transcription.confidence);
          await callSessionService.addTranscript(session.id, 'ai', aiResponse.aiResponse);
          logger.info('Saved transcripts to database');
        } catch (dbError) {
          logger.warn(`Database save error: ${dbError.message}`);
        }
      }
      
      // Determine if escalation is needed
      const shouldEscalate = aiResponse.confidence === 'low' || transcription.confidence < 0.5;
      
      // Generate TwiML response
      const twimlResponse = twilioService.createResponseWithAnswer(aiResponse.aiResponse, shouldEscalate);
      
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Critical error in handleRecording:', error);
      
      // Emergency fallback response
      const response = new twilio.twiml.VoiceResponse();
      response.say({
        voice: 'alice'
      }, 'I apologize for the technical difficulty. Our support team will call you back shortly. Thank you for your patience.');
      response.hangup();
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle follow-up recording
  async handleFollowUp(req, res) {
    try {
      const { CallSid, RecordingUrl } = req.body;
      
      logger.info(`Processing follow-up for call: ${CallSid}`);
      
      // For now, just end the call gracefully
      const twimlResponse = twilioService.createGoodbyeResponse();
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Error in handleFollowUp:', error);
      
      const response = new twilio.twiml.VoiceResponse();
      response.say({ voice: 'alice' }, 'Thank you for calling. Goodbye!');
      response.hangup();
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  // Handle call status updates
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
}

module.exports = new WebhookController();
