# AI Technical Support Service with Voice Authentication

An AI-powered technical support service specifically designed for seniors, featuring seamless voice authentication and family-friendly signup process. No passwords, no complicated menus - just call and get help.

## 🚀 New Features

- **🎤 Voice Authentication**: Seniors are recognized by their voice alone
- **👨‍👩‍👧‍👦 Family Signup Portal**: Children/grandchildren can sign up their seniors online
- **📞 Natural Phone Interface**: No button pressing or complex menus
- **👥 Human Fallback**: Always escalates to real people when needed
- **📊 Family Dashboard**: Usage analytics and peace of mind for families
- **💰 Flexible Pricing**: Tiered plans based on usage with transparent billing

## 🎯 How It Works for Seniors

1. **First Call**: "Hi, I need help with my computer"
2. **System**: "Hello! I don't recognize your voice yet. What's your name?"
3. **Senior**: "Mary Johnson"
4. **System**: "Perfect! Now I'll remember your voice..." [enrollment]
5. **Future Calls**: "Hi Mary! I recognize you. How can I help?"

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: PostgreSQL with voice authentication tables
- **Telephony**: Twilio API with enhanced call routing
- **Speech Recognition**: OpenAI Whisper
- **Voice Biometrics**: Azure Voice ID / AWS Connect (configurable)
- **AI**: Anthropic Claude / Google Gemini
- **Frontend**: React (Admin Dashboard + Family Portal)

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 12+
- Twilio account with phone number
- OpenAI API key (for Whisper)
- Anthropic API key (for Claude)
- Azure Speech Services OR AWS Connect (for voice biometrics)

## 🚀 Quick Start

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo-url>
   cd SilverSupportDevRepo
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database credentials
   ```

3. **Set up database with voice authentication**:
   ```bash
   # Start PostgreSQL
   brew services start postgresql
   
   # Run migrations (includes voice auth tables)
   npm run migrate
   ```

4. **Seed test data**:
   ```bash
   npm run seed:test-data
   ```

5. **Import FAQ data**:
   ```bash
   npm run import-faq
   ```

6. **Start the service**:
   ```bash
   npm run dev
   ```

7. **Start admin dashboard**:
   ```bash
   cd admin-dashboard
   npm install
   npm start
   ```

## 📞 Testing Voice Authentication

The system creates test accounts you can use:

- **Mary Johnson**: +15551234567 (Basic plan, voice enrolled)
- **Robert Wilson**: +15551234568 (Premium plan, voice enrolled)  
- **Dorothy Smith**: +15551234569 (Family plan, needs enrollment)

Call your Twilio number from these numbers to test different scenarios.

## 👨‍👩‍👧‍👦 Family Signup Process

### Online Signup (Recommended)
1. Family member visits `/signup` endpoint
2. Fills out senior's information
3. System creates pending enrollment
4. Senior calls to complete voice setup

### Phone Signup
1. Senior calls without being registered
2. System guides them through signup
3. Can add family member via 3-way call if needed

## 📊 Subscription Tiers

### Basic ($29/month)
- 50 AI-handled calls per month
- Voice authentication
- Basic analytics
- Email support

### Premium ($79/month)
- 200 AI-handled calls per month
- Priority human escalation
- Advanced sentiment analysis
- Family dashboard access

### Family ($149/month)
- 500 AI-handled calls per month
- Multiple senior support
- Dedicated account manager
- Custom training

**Overage**: $0.15 per additional call

## 🔐 Authentication Flow

### For Seniors (Voice-Based)
```
Incoming Call → Voice Recognition → 
  ├─ Recognized: Proceed with support
  ├─ New caller: Start signup flow  
  ├─ Pending signup: Complete enrollment
  └─ Low confidence: Re-enrollment
```

### For Admin Dashboard (Traditional)
```
Login → JWT Token → Protected Routes
```

## 📁 Project Structure

```
src/
├── controllers/
│   ├── webhookController.js    # Enhanced with voice auth flow
│   └── subscriberController.js # New subscriber management
├── services/
│   ├── voiceAuthService.js     # New voice authentication logic
│   ├── whisperService.js       # Speech-to-text processing
│   ├── aiService.js           # AI response generation
│   └── twilioService.js       # Twilio integration
├── routes/
│   ├── webhooks.js            # Updated webhook routes
│   ├── subscribers.js         # New subscriber management routes
│   └── calls.js              # Enhanced call routing
├── middleware/
│   ├── twilioAuth.js          # New Twilio signature validation
│   ├── rateLimiter.js         # API rate limiting
│   └── auth.js               # JWT authentication
├── database/
│   ├── migrations/
│   │   └── 003_add_voice_authentication.sql
│   └── schema.sql            # Updated database schema
└── utils/
    └── logger.js             # Logging utilities
```

## 🔧 API Endpoints

### Public Endpoints (No Auth Required)
```
POST /api/subscribers/signup          # Family member signup
GET  /health                         # Health check
POST /webhooks/twilio/*              # Twilio webhooks
```

### Admin Endpoints (JWT Auth Required)
```
GET    /api/subscribers              # List all subscribers
GET    /api/subscribers/:id          # Get subscriber details
PUT    /api/subscribers/:id          # Update subscriber
GET    /api/subscribers/:id/usage    # Get usage analytics
GET    /api/subscribers/admin/pending-signups  # Pending enrollments
```

### Webhook Flow
```
POST /webhooks/twilio/incoming       # Initial call handling
POST /webhooks/twilio/voice-auth     # Voice authentication
POST /webhooks/twilio/support-request # Authenticated support
POST /webhooks/twilio/complete-enrollment # Voice enrollment
POST /webhooks/twilio/signup-response # New user signup
POST /webhooks/twilio/follow-up      # Conversation continuation
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Manual Testing Scenarios

1. **New Senior Calls** (No Registration)
   - Call from unregistered number
   - System should offer signup process
   - Can escalate to human agent

2. **Family Pre-Registration**
   - POST to `/api/subscribers/signup`
   - Senior calls to complete voice enrollment
   - System recognizes pending signup

3. **Returning Senior**
   - Call from enrolled number
   - System should recognize voice immediately
   - Proceed directly to support

4. **Voice Recognition Failure**
   - Enrolled senior with poor audio quality
   - System should request re-enrollment
   - Fallback to human agent if needed

## 🚀 Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://...
TWILIO_WEBHOOK_URL=https://yourdomain.com/webhooks/twilio
SKIP_TWILIO_VALIDATION=false

# Voice biometrics (choose one)
VOICE_SERVICE_PROVIDER=azure
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region
```

### Database Migration
```bash
# Run migrations on production
npm run migrate

# Or run specific voice auth migration
npm run migrate:voice-auth
```

### Twilio Webhook Configuration
Set your Twilio phone number webhooks to:
- **Incoming Calls**: `https://yourdomain.com/webhooks/twilio/incoming`
- **Call Status**: `https://yourdomain.com/webhooks/twilio/status`

## 📊 Monitoring & Analytics

### Admin Dashboard Features
- Real-time call monitoring
- Voice authentication success rates
- Customer satisfaction scores
- Usage analytics by subscriber
- Monthly billing summaries
- Pending enrollments management

### Family Portal Features
- Signup form for seniors
- Usage monitoring for their senior
- Billing and payment management
- Support ticket creation
- Emergency contact updates

## 🔍 Troubleshooting

### Common Issues

**Voice Authentication Not Working**
```bash
# Check voice service configuration
echo $VOICE_SERVICE_PROVIDER
echo $AZURE_SPEECH_KEY

# Review authentication logs
tail -f logs/application.log | grep "voice_auth"
```

**Twilio Webhooks Failing**
```bash
# Test webhook signature validation
curl -X POST https://yourdomain.com/webhooks/twilio/incoming \
  -H "X-Twilio-Signature: test" \
  -d "CallSid=test&From=+1234567890"

# Check Twilio auth settings
echo $TWILIO_AUTH_TOKEN
```

**Database Connection Issues**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM subscribers;"

# Run health check
curl http://localhost:3000/health
```

### Voice Authentication Debug Mode
```bash
# Enable detailed voice auth logging
LOG_LEVEL=debug
VOICE_DEBUG_MODE=true

# Skip voice biometrics for testing
VOICE_SERVICE_PROVIDER=simple
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/voice-improvement`
3. **Add comprehensive tests** for voice authentication
4. **Test with real seniors** (if possible)
5. **Update documentation**
6. **Submit pull request**

### Voice Authentication Testing
When contributing voice auth features:
- Test with different accents and speech patterns
- Verify accessibility for hearing impaired
- Ensure graceful degradation to human agents
- Test family signup flow end-to-end

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Technical Issues**: Create GitHub issue
- **Voice Auth Problems**: Check logs in `logs/voice_auth.log`
- **Family Signup Issues**: Test with `/api/subscribers/signup`
- **Production Support**: Configure monitoring alerts

## 🔮 Roadmap

- **Multi-language Support**: Spanish, Mandarin voice recognition
- **Advanced Voice Biometrics**: Emotion detection, health monitoring
- **Smart Home Integration**: Help with smart devices over phone
- **Caregiver Alerts**: Automatic notifications for concerning calls
- **Video Support**: Optional video calls for complex technical issues

---

**Remember**: This system is designed for seniors who may not be tech-savvy. Always prioritize simplicity and human fallback options over complex features.