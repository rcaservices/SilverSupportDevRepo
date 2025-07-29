const twilioService = require('../services/twilioService');
const whisperService = require('../services/whisperService');
const aiService = require('../services/aiService');
const callSessionService = require('../services/callSessionService');
const logger = require('../utils/logger');

class WebhookController {
  
  // Handle incoming calls
  async handleIncomingCall(req, res) {
    try {
      const { CallSid, From: phoneNumber, To: twilioNumber } = req.body;
      
      logger.info(`Incoming call: ${CallSid} from ${phoneNumber}`);
      
      // Create call session in database
      const session = await callSessionService.createCallSession(CallSid, phoneNumber);
      
      // Generate TwiML response
      const twimlResponse = twilioService.createIncomingCallResponse();
      
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      res.status(500).send('Internal server error');
    }
  }

  // Handle recorded user message
  async handleRecording(req, res) {
    try {
      const { CallSid, RecordingUrl, RecordingDuration } = req.body;
      
      logger.info(`Processing recording for call: ${CallSid}`);
      
      // Get call session
      const session = await callSessionService.getCallSessionBySid(CallSid);
      if (!session) {
        throw new Error(`Call session not found: ${CallSid}`);
      }

      // Transcribe audio with Whisper
      const transcription = await whisperService.transcribeAudio(RecordingUrl);
      
      // Save user transcript
      const userTranscript = await callSessionService.addTranscript(
        session.id, 
        'user', 
        transcription.text, 
        transcription.confidence
      );
      
      // Analyze sentiment
      const sentiment = await aiService.analyzeSentiment(transcription.text);
      
      // Save sentiment analysis
      await callSessionService.addSentimentAnalysis(
        session.id,
        userTranscript.id,
        sentiment.score,
        sentiment.emotion,
        sentiment.urgency,
        sentiment.escalation_recommended
      );
      
      // Generate AI response
      const aiResponse = await aiService.generateSupportResponse(transcription.text);
      
      // Save AI response
      const responseRecord = await callSessionService.addAIResponse(
        session.id,
        'information',
        aiResponse.aiResponse,
        aiResponse.knowledgeBaseResults[0]?.id || null,
        aiResponse.confidence === 'high'
      );
      
      // Save AI transcript
      await callSessionService.addTranscript(session.id, 'ai', aiResponse.aiResponse);
      
      // Determine if escalation is needed
      const shouldEscalate = sentiment.escalation_recommended || 
                            aiResponse.confidence === 'low' || 
                            sentiment.urgency >= 4;
      
      // Generate TwiML response
      const twimlResponse = twilioService.createResponseWithAnswer(
        aiResponse.aiResponse, 
        shouldEscalate
      );
      
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Error handling recording:', error);
      
      // Fallback response
      const response = new require('twilio').twiml.VoiceResponse();
      response.say({
        voice: 'alice'
      }, 'I apologize, but I encountered a technical issue. Please try calling back in a few minutes, or contact our support team directly.');
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
      
      // Get call session
      const session = await callSessionService.getCallSessionBySid(CallSid);
      
      if (RecordingUrl && session) {
        // Transcribe follow-up
        const transcription = await whisperService.transcribeAudio(RecordingUrl);
        
        // Save follow-up transcript
        await callSessionService.addTranscript(session.id, 'user', transcription.text);
        
        // Check if they need more help
        const needsMoreHelp = transcription.text.toLowerCase().includes('yes') ||
                             transcription.text.toLowerCase().includes('help') ||
                             transcription.text.toLowerCase().includes('more');
        
        if (needsMoreHelp) {
          // Generate another AI response
          const aiResponse = await aiService.generateSupportResponse(transcription.text);
          
          await callSessionService.addTranscript(session.id, 'ai', aiResponse.aiResponse);
          
          const twimlResponse = twilioService.createResponseWithAnswer(aiResponse.aiResponse);
          res.type('text/xml');
          res.send(twimlResponse);
          return;
        }
      }
      
      // End the call
      const twimlResponse = twilioService.createGoodbyeResponse();
      res.type('text/xml');
      res.send(twimlResponse);
      
    } catch (error) {
      logger.error('Error handling follow-up:', error);
      
      const twimlResponse = twilioService.createGoodbyeResponse();
      res.type('text/xml');
      res.send(twimlResponse);
    }
  }

  // Handle call status updates
  async handleCallStatus(req, res) {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;
      
      logger.info(`Call status update: ${CallSid} - ${CallStatus}`);
      
      if (CallStatus === 'completed') {
        const session = await callSessionService.getCallSessionBySid(CallSid);
        if (session) {
          await callSessionService.endCallSession(session.id, parseInt(CallDuration));
        }
      }
      
      res.status(200).send('OK');
      
    } catch (error) {
      logger.error('Error handling call status:', error);
      res.status(500).send('Error');
    }
  }
}

module.exports = new WebhookController();
