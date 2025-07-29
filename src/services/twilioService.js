const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.twiml = twilio.twiml;
  }

  // Create TwiML response for incoming calls
  createIncomingCallResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Hello! Welcome to AI Technical Support. Please describe your technical issue, and I will help you resolve it.');
    
    // Record the caller's response with both Whisper and Twilio transcription as backup
    response.record({
      maxLength: 30,
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/recording-complete',
      transcribe: true, // Enable Twilio transcription as backup
      transcribeCallback: '/webhooks/twilio/transcription-complete',
      action: '/webhooks/twilio/handle-recording'
    });
    
    return response.toString();
  }

  // Create TwiML response with AI-generated answer
  createResponseWithAnswer(aiResponse, shouldEscalate = false) {
    const response = new this.twiml.VoiceResponse();
    
    if (shouldEscalate) {
      response.say({
        voice: 'alice',
        language: 'en-US'
      }, 'I understand this is a complex issue. Let me connect you with one of our technical specialists who can provide more detailed assistance.');
      
      response.say({
        voice: 'alice',
        language: 'en-US'
      }, 'Please hold while I transfer your call.');
      
      response.pause({ length: 2 });
      response.say({
        voice: 'alice',
        language: 'en-US'
      }, 'For now, I will provide you with the best guidance I can, and create a priority support ticket for follow-up.');
    }
    
    response.say({
      voice: 'alice',
      language: 'en-US'
    }, aiResponse);
    
    // Ask if they need more help
    response.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Is there anything else I can help you with today? Please speak your response, or hang up if you are satisfied.');
    
    response.record({
      maxLength: 15,
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/follow-up-complete',
      action: '/webhooks/twilio/handle-follow-up'
    });
    
    return response.toString();
  }

  // Create goodbye response
  createGoodbyeResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Thank you for contacting AI Technical Support. Have a great day!');
    
    response.hangup();
    
    return response.toString();
  }
}

module.exports = new TwilioService();
