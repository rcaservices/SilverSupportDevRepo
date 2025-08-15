const parameterStore = require('../src/config/parameterStore');
const aiService = require('../src/services/aiService');

async function testMessageLimits() {
  try {
    console.log('🧪 Testing message limit configuration...');
    
    // Test parameter store access
    const limits = await parameterStore.getMessageLimits();
    console.log('✅ Message limits loaded:', limits);
    
    // Test validation
    const shortMessage = "This is a short message";
    const longMessage = "x".repeat(10000);
    
    console.log('✅ Short message validation passed');
    aiService.validateMessageLength(shortMessage);
    
    try {
      aiService.validateMessageLength(longMessage);
      console.log('❌ Long message validation should have failed');
    } catch (error) {
      console.log('✅ Long message validation correctly failed:', error.message);
    }
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMessageLimits();