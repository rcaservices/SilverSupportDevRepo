const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.twiml = twilio.twiml;
  }

  // Create TwiML response for incoming calls with natural voice
  createIncomingCallResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'Polly.Joanna-Neural', // Natural neural voice
      language: 'en-US'
    }, 'Hello there! Welcome to AI Technical Support. I\'m here to help you with any technical issues you might have. Please go ahead and describe what\'s happening, and I\'ll do my best to get you sorted out right away.');
    
    response.record({
      maxLength: 45,
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/recording-complete',
      transcribe: true,
      transcribeCallback: '/webhooks/twilio/transcription-complete',
      action: '/webhooks/twilio/handle-recording',
      timeout: 3,
      finishOnKey: '#'
    });
    
    return response.toString();
  }

  // Create TwiML response with natural AI-generated answer
  createResponseWithAnswer(aiResponse, shouldEscalate = false) {
    const response = new this.twiml.VoiceResponse();
    
    if (shouldEscalate) {
      response.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, 'I can see this is a bit more complex than I initially thought. Let me connect you with one of our technical specialists who can dive deeper into this with you.');
      
      response.pause({ length: 1 });
      
      response.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, 'I\'m transferring you now, and I\'ll make sure they have all the context from our conversation.');
    }
    
    // Make the response more conversational but without complex SSML
    const naturalResponse = this.makeResponseConversational(aiResponse);
    
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, naturalResponse);
    
    // Natural follow-up
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'Does that help answer your question? Feel free to ask if you need me to clarify anything or if there\'s something else I can help you with.');
    
    response.record({
      maxLength: 20,
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/follow-up-complete',
      action: '/webhooks/twilio/handle-follow-up',
      timeout: 4,
      finishOnKey: '#'
    });
    
    return response.toString();
  }

  // Make AI responses sound more conversational (text only, no SSML)
  makeResponseConversational(aiResponse) {
    return aiResponse
      .replace(/^/, "Absolutely! ")
      .replace(/You need to/, "What you'll want to do is")
      .replace(/You should/, "I'd recommend that you")
      .replace(/You can/, "You can go ahead and")
      .replace(/Follow these steps:/, "Here's what we'll do - it's actually pretty straightforward:")
      .replace(/The system/, "your system")
      .replace(/The account/, "your account")
      .replace(/If (that|this) doesn't work/, "If that doesn't do the trick")
      .replace(/Contact support/, "feel free to give us another call");
  }

  // Create natural goodbye response
  createGoodbyeResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'Perfect! I\'m glad I could help you out today. Thanks for calling AI Technical Support, and don\'t hesitate to reach out if you need anything else. Have a great day!');
    
    response.hangup();
    
    return response.toString();
  }
}

module.exports = new TwilioService();
