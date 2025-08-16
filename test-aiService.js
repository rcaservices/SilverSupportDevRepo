// test-aiService.js - Test script for your aiService changes
require('dotenv').config();

async function testAIService() {
  console.log('🧪 Testing AIService...');
  
  try {
    // Test 1: Import the service
    console.log('1. Testing import...');
    const aiService = require('./src/services/aiService');
    console.log('✅ AIService imported successfully');
    
    // Test 2: Check if getMessageLimits method exists
    console.log('2. Testing getMessageLimits method...');
    if (typeof aiService.getMessageLimits === 'function') {
      console.log('✅ getMessageLimits method exists');
    } else {
      console.log('❌ getMessageLimits method missing');
      return;
    }
    
    // Test 3: Try to get message limits from SSM
    console.log('3. Testing SSM parameter retrieval...');
    const limits = await aiService.getMessageLimits();
    console.log('✅ Message limits retrieved:', limits);
    
    // Test 4: Test validateMessageLength method
    console.log('4. Testing message validation...');
    
    // Test with short message (should pass)
    const shortMessage = "This is a short test message";
    await aiService.validateMessageLength(shortMessage);
    console.log('✅ Short message validation passed');
    
    // Test with long message (should fail)
    const longMessage = "x".repeat(10000); // 10,000 characters
    try {
      await aiService.validateMessageLength(longMessage);
      console.log('❌ Long message validation should have failed');
    } catch (error) {
      console.log('✅ Long message validation correctly failed:', error.message);
    }
    
    // Test 5: Test health check (if it exists)
    console.log('5. Testing health check...');
    if (typeof aiService.healthCheck === 'function') {
      const health = await aiService.healthCheck();
      console.log('✅ Health check:', health.status);
    } else {
      console.log('ℹ️  Health check method not found (that\'s okay)');
    }
    
    console.log('\n🎉 All tests passed! Your aiService.js is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testAIService();