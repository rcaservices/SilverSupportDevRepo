# AI Technical Support Service

An AI-powered technical support service that provides automated customer assistance via phone calls using advanced speech recognition, natural language processing, and conversational AI.

## 🚀 Features

- **Automated Voice Recognition**: Real-time speech-to-text using Whisper
- **Natural Language Understanding**: Intent detection and entity extraction
- **Knowledge Base Integration**: FAQ and solution matching
- **Real-time AI Responses**: Generated via Claude/Gemini with TTS delivery
- **Sentiment Analysis**: Emotion detection with automatic escalation
- **Human Agent Escalation**: Seamless handoff with full context
- **Dual Authentication**: Account number + voice recognition
- **Admin Dashboard**: Real-time monitoring and analytics

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Telephony**: Twilio API
- **Speech-to-Text**: OpenAI Whisper
- **Conversational AI**: Anthropic Claude / Google Gemini
- **Frontend**: React (Admin Dashboard)

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 12+
- Twilio account with phone number
- OpenAI API key (for Whisper)
- Anthropic API key (for Claude)

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

3. **Set up database**:
   ```bash
   # Start PostgreSQL
   brew services start postgresql
   # Or using Docker:
   docker-compose up -d postgres
   
   # Initialize database
   npm run setup:db
   npm run migrate
   ```

4. **Import FAQ data**:
   ```bash
   npm run import-faq
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Start admin dashboard**:
   ```bash
   cd admin-dashboard
   npm install
   npm start
   ```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route handlers
├── services/        # Business logic
├── models/          # Database models
├── routes/          # API routes
├── middleware/      # Express middleware
├── utils/           # Helper functions
└── database/        # Migrations and seeds
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📚 API Documentation

API documentation is available in `docs/API.md`.

## 🚀 Deployment

See `docs/DEPLOYMENT.md` for production deployment instructions.

## 📊 Monitoring

The admin dashboard provides real-time monitoring at `http://localhost:3001`

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run linting: `npm run lint`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
