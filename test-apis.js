require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const twilio = require('twilio');

async function testAPIs() {
  console.log('🧪 Testing API connections...\n');

  // Test Anthropic (Claude)
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Updated model name
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "AI Support Test" if you can hear me.' }]
    });
    
    console.log('✅ Anthropic/Claude API: Working');
    console.log('   Response:', message.content[0].text);
  } catch (error) {
    console.log('❌ Anthropic API: Failed');
    console.log('   Error:', error.message);
  }

  console.log('');

  // Test OpenAI (for future Whisper integration)
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Test with a simple completion instead of Whisper for now
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "OpenAI Test" if you can hear me.' }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API: Working');
    console.log('   Response:', completion.choices[0].message.content);
  } catch (error) {
    console.log('❌ OpenAI API: Failed');
    console.log('   Error:', error.message);
  }

  console.log('');

  // Test Twilio
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Just test account fetch (no SMS/calls)
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    
    console.log('✅ Twilio API: Working');
    console.log('   Account Status:', account.status);
    console.log('   Account Type:', account.type);
  } catch (error) {
    console.log('❌ Twilio API: Failed');
    console.log('   Error:', error.message);
  }

  console.log('\n🎉 API testing complete!');
}

testAPIs();
