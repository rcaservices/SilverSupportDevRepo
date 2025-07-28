# Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis (optional, for caching)
- SSL certificate for HTTPS
- Domain name

## Environment Variables
Create a production `.env` file with:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
JWT_SECRET=your_super_secure_secret
```

## Docker Deployment

1. Build the image:
```bash
docker build -t ai-tech-support .
```

2. Run with docker-compose:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Manual Deployment

1. Install dependencies:
```bash
npm ci --production
```

2. Run database migrations:
```bash
npm run migrate
```

3. Start the application:
```bash
npm start
```

## Health Checks
The application provides a health check endpoint at `/health`

## Monitoring
- Set up log aggregation
- Monitor `/health` endpoint
- Set up alerts for error rates
- Monitor database performance
