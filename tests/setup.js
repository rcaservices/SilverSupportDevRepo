// Global test setup
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ai_support_test';
process.env.JWT_SECRET = 'test-secret';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
