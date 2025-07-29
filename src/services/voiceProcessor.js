class VoiceProcessor {
  
  // Convert AI text to natural SSML
  static createNaturalSSML(text) {
    let ssml = `<speak>`;
    
    // Add natural breathing and pauses
    ssml += text
      // Friendly greeting with warmth
      .replace(/^(Hello|Hi)/i, '<prosody pitch="+2st" rate="0.95">$1</prosody><break time="0.3s"/>')
      
      // Slow down and emphasize key actions
      .replace(/(log into|navigate to|click on|select|choose)/gi, 
        '<prosody rate="0.85" pitch="-1st">$1</prosody>')
      
      // Add natural rhythm to lists
      .replace(/(\d+\.)\s*([^.]+)/g, 
        '<break time="0.4s"/>$1 <prosody rate="0.9">$2</prosody>')
      
      // Emphasize important words naturally
      .replace(/(important|careful|make sure|note that)/gi, 
        '<emphasis level="moderate">$1</emphasis>')
      
      // Add warmth to helpful phrases
      .replace(/(I'm happy to help|I'd be glad to|Let me help you)/gi, 
        '<prosody pitch="+1st">$1</prosody>')
      
      // Natural excitement for positive outcomes
      .replace(/(That should work|Perfect|Great|Excellent)/gi, 
        '<prosody pitch="+2st" rate="1.05">$1</prosody>')
      
      // Gentler tone for apologies
      .replace(/(I apologize|I'm sorry|Unfortunately)/gi, 
        '<prosody pitch="-1st" rate="0.9">$1</prosody>')
      
      // Add natural hesitation for complex topics
      .replace(/(complex|complicated|advanced)/gi, 
        '<break time="0.2s"/>$1')
      
      // End with warm conclusion
      .replace(/(Is there anything else|Can I help|Any other questions)/gi, 
        '<break time="0.5s"/><prosody pitch="+1st">$1</prosody>');
    
    ssml += `</speak>`;
    return ssml;
  }
  
  // Add personality to responses
  static addPersonality(text) {
    const personalityMarkers = [
      'Absolutely!',
      'Sure thing!',
      'No problem at all!',
      'I\'d be happy to help with that!',
      'Great question!',
      'Let me walk you through this -',
      'Here\'s what we\'ll do:'
    ];
    
    const randomMarker = personalityMarkers[Math.floor(Math.random() * personalityMarkers.length)];
    
    return `${randomMarker} ${text}`;
  }
}

module.exports = VoiceProcessor;
