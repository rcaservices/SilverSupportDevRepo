# API Documentation

## Overview
This document describes the REST API endpoints for the AI Technical Support Service.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Calls Management

#### Get All Calls
```http
GET /api/calls
```

#### Create New Call Session
```http
POST /api/calls/incoming
```

#### Get Call Details
```http
GET /api/calls/:sessionId
```

### Knowledge Base

#### Search Knowledge Base
```http
GET /api/knowledge?q=search_term
```

#### Add Knowledge Base Article
```http
POST /api/knowledge
```

### Analytics

#### Get Call Analytics
```http
GET /api/analytics/calls
```

#### Get Resolution Rates
```http
GET /api/analytics/resolution
```

#### Get Sentiment Analysis
```http
GET /api/analytics/sentiment
```

### Webhooks

#### Twilio Incoming Call Webhook
```http
POST /webhooks/twilio/incoming
```

#### Twilio Status Webhook
```http
POST /webhooks/twilio/status
```

## Error Responses

All endpoints return errors in the following format:
```json
{
  "error": "Error message description"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
