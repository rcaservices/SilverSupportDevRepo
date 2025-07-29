const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.twiml = twilio.twiml;
  }

  // Create more natural-sounding speech
  createNaturalSay(text, options = {}) {
    const defaultOptions = {
      voice: 'Polly.Joanna-Neural', // Much more natural Amazon Polly neural voice
      language: 'en-US',
      ...options
    };
    
    // Add natural pauses and emphasis
    const naturalText = this.addNaturalPauses(text);
    
    return {
      voice: defaultOptions.voice,
      language: defaultOptions.language
    };
  }

  // Add natural pauses and SSML markup for more human speech
  addNaturalPauses(text) {
    return text
      // Add small pauses after greetings
      .replace(/^(Hello|Hi|Hey)([!.])/i, '$1<break time="0.3s"/>$2')
      // Pause after "I understand" or "I see"
      .replace(/(I understand|I see|I get it)([,.!])/gi, '$1<break time="0.5s"/>$2')
      // Pause before listing steps
      .replace(/Here's what you can do:|Follow these steps:|Try these steps:/gi, '$&<break time="0.7s"/>')
      // Pause between numbered steps
      .replace(/(\d+\.)/g, '<break time="0.4s"/>$1')
      // Pause after "First," "Next," "Then," etc.
      .replace(/(First|Next|Then|Finally)([,:])/gi, '$1<break time="0.4s"/>$2')
      // Emphasize important words
      .replace(/\b(important|critical|essential|urgent)\b/gi, '<emphasis level="moderate">$1</emphasis>')
      // Slow down when giving specific instructions
      .replace(/(log into|navigate to|click on|enter)/gi, '<prosody rate="0.9">$1</prosody>');
  }

  // Create TwiML response for incoming calls with natural voice
  createIncomingCallResponse() {
    const response = new this.twiml.VoiceResponse();
    
    const greeting = "Hello there! Welcome to AI Technical Support. I'm here to help you with any technical issues you might have. Please go ahead and describe what's happening, and I'll do my best to get you sorted out right away.";
    
    response.say(this.createNaturalSay(greeting), this.addNaturalPauses(greeting));
    
    // Record with longer duration for natural conversation
    response.record({
      maxLength: 45, // Longer for more natural conversation
      playBeep: false,
      recordingStatusCallback: '/webhooks/twilio/recording-complete',
      transcribe: true,
      transcribeCallback: '/webhooks/twilio/transcription-complete',
      action: '/webhooks/twilio/handle-recording',
      timeout: 3, // Wait 3 seconds of silence before processing
      finishOnKey: '#' // Allow user to press # to finish early
    });
    
    return response.toString();
  }

  // Create TwiML response with natural AI-generated answer
  createResponseWithAnswer(aiResponse, shouldEscalate = false) {
    const response = new this.twiml.VoiceResponse();
    
    if (shouldEscalate) {
      const escalationMessage = "I can see this is a bit more complex than I initially thought. Let me connect you with one of our technical specialists who can dive deeper into this with you.";
      
      response.say(
        this.createNaturalSay(escalationMessage), 
        this.addNaturalPauses(escalationMessage)
      );
      
      response.pause({ length: 1 });
      
      const transferMessage = "I'm transferring you now, and I'll make sure they have all the context from our conversation.";
      response.say(
        this.createNaturalSay(transferMessage), 
        this.addNaturalPauses(transferMessage)
      );
    }
    
    // Make the AI response sound more conversational
    const naturalResponse = this.makeResponseConversational(aiResponse);
    
    response.say(
      this.createNaturalSay(naturalResponse), 
      this.addNaturalPauses(naturalResponse)
    );
    
    // More natural follow-up question
    const followUp = "Does that help answer your question? Feel free to ask if you need me to clarify anything or if there's something else I can help you with.";
    
    response.say(
      this.createNaturalSay(followUp), 
      this.addNaturalPauses(followUp)
    );
    
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

  // Make AI responses sound more conversational
  makeResponseConversational(aiResponse) {
    return aiResponse
      // Add conversational starters
      .replace(/^/, "Absolutely! ")
      // Make instructions sound friendlier
      .replace(/You need to/, "What you'll want to do is")
      .replace(/You should/, "I'd recommend that you")
      .replace(/You can/, "You can go ahead and")
      // Add encouragement
      .replace(/Follow these steps:/, "Here's what we'll do - it's actually pretty straightforward:")
      // Make it sound more personal
      .replace(/The system/, "your system")
      .replace(/The account/, "your account")
      // Add reassurance
      .replace(/If (that|this) doesn't work/, "If that doesn't do the trick")
      .replace(/Contact support/, "feel free to give us another call");
  }

  // Create natural goodbye response
  createGoodbyeResponse() {
    const response = new this.twiml.VoiceResponse();
    
    const goodbyeMessage = "Perfect! I'm glad I could help you out today. Thanks for calling AI Technical Support, and don't hesitate to reach out if you need anything else. Have a great day!";
    
    response.say(
      this.createNaturalSay(goodbyeMessage), 
      this.addNaturalPauses(goodbyeMessage)
    );
    
    response.hangup();
    
    return response.toString();
  }
}

module.exports = new TwilioService();
