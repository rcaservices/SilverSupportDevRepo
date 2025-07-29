const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.twiml = twilio.twiml;
  }

  // Create TwiML response for incoming calls with interruption support
  createIncomingCallResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'Polly.Joanna-Neural',
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

  // Create TwiML response with interruption support during AI responses
  createResponseWithAnswer(aiResponse, shouldEscalate = false) {
    const response = new this.twiml.VoiceResponse();
    
    if (shouldEscalate) {
      // Use Gather to allow interruption during escalation message
      const gather = response.gather({
        input: 'speech',
        timeout: 3,
        speechTimeout: 2,
        action: '/webhooks/twilio/handle-interruption',
        method: 'POST'
      });
      
      gather.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, 'I can see this is a bit more complex than I initially thought. Let me connect you with one of our technical specialists who can dive deeper into this with you.');
      
      // If no interruption, continue
      response.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, 'I\'m transferring you now, and I\'ll make sure they have all the context from our conversation.');
      
      response.redirect('/webhooks/twilio/handle-follow-up');
      return response.toString();
    }
    
    // Make the response more conversational
    const naturalResponse = this.makeResponseConversational(aiResponse);
    
    // Break the response into chunks to allow for interruptions
    const responseChunks = this.breakIntoInterruptibleChunks(naturalResponse);
    
    for (let i = 0; i < responseChunks.length; i++) {
      const gather = response.gather({
        input: 'speech',
        timeout: i === 0 ? 4 : 2, // Longer timeout for first chunk
        speechTimeout: 1.5,
        action: '/webhooks/twilio/handle-interruption',
        method: 'POST',
        partialResultCallback: '/webhooks/twilio/partial-speech' // Real-time speech detection
      });
      
      gather.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, responseChunks[i]);
      
      // Small pause between chunks
      if (i < responseChunks.length - 1) {
        gather.pause({ length: 0.5 });
      }
    }
    
    // If no interruption during the entire response, ask follow-up
    const finalGather = response.gather({
      input: 'speech',
      timeout: 5,
      speechTimeout: 2,
      action: '/webhooks/twilio/handle-follow-up',
      method: 'POST'
    });
    
    finalGather.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'Does that help answer your question? Feel free to ask if you need me to clarify anything or if there\'s something else I can help you with.');
    
    // If still no response, end gracefully
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'I\'ll take your silence as a good sign! Thanks for calling AI Technical Support. Have a great day!');
    
    response.hangup();
    
    return response.toString();
  }

  // Break long responses into interruptible chunks
  breakIntoInterruptibleChunks(text, maxChunkLength = 150) {
    if (text.length <= maxChunkLength) {
      return [text];
    }
    
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  // Make AI responses sound more conversational
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

  // Create goodbye response
  createGoodbyeResponse() {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'Perfect! I\'m glad I could help you out today. Thanks for calling AI Technical Support, and don\'t hesitate to reach out if you need anything else. Have a great day!');
    
    response.hangup();
    
    return response.toString();
  }

  // Create response when user interrupts
  createInterruptionResponse(interruptionText) {
    const response = new this.twiml.VoiceResponse();
    
    response.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-US'
    }, 'Oh, I hear you have another question! Let me help you with that.');
    
    response.record({
      maxLength: 30,
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/interruption-complete',
      action: '/webhooks/twilio/handle-interruption-recording',
      timeout: 3,
      finishOnKey: '#'
    });
    
    return response.toString();
  }
}

module.exports = new TwilioService();
