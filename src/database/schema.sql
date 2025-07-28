-- AI Technical Support Service Database Schema

-- Users table for customer authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    name VARCHAR(255),
    voice_print_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge base articles and solutions
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT[],
    category VARCHAR(100),
    subcategory VARCHAR(100),
    solution_steps JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
    id SERIAL PRIMARY KEY,
    twilio_call_sid VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    authentication_method VARCHAR(50),
    authentication_success BOOLEAN DEFAULT false
);

-- Real-time conversation transcripts
CREATE TABLE IF NOT EXISTS call_transcripts (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence_score DECIMAL(3,2),
    audio_segment_url TEXT
);

-- Intent detection and NLU results
CREATE TABLE IF NOT EXISTS conversation_intents (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_message_id INTEGER REFERENCES call_transcripts(id),
    detected_intent VARCHAR(100),
    confidence_score DECIMAL(3,2),
    entities JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge base queries and matches
CREATE TABLE IF NOT EXISTS kb_queries (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    matched_articles INTEGER[] DEFAULT '{}',
    relevance_scores DECIMAL(3,2)[] DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI responses and actions taken
CREATE TABLE IF NOT EXISTS ai_responses (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    response_type VARCHAR(50),
    response_text TEXT NOT NULL,
    knowledge_base_id INTEGER REFERENCES knowledge_base(id),
    success BOOLEAN,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment analysis results
CREATE TABLE IF NOT EXISTS sentiment_analysis (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    transcript_id INTEGER REFERENCES call_transcripts(id),
    sentiment_score DECIMAL(3,2),
    emotion VARCHAR(50),
    urgency_level INTEGER CHECK (urgency_level BETWEEN 1 AND 5),
    escalation_recommended BOOLEAN DEFAULT false,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Human agent escalations
CREATE TABLE IF NOT EXISTS escalations (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    agent_id VARCHAR(100),
    escalation_reason VARCHAR(200),
    escalation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolution_time TIMESTAMP,
    resolution_notes TEXT,
    customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5)
);

-- System performance and analytics
CREATE TABLE IF NOT EXISTS call_analytics (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE CASCADE,
    resolution_achieved BOOLEAN DEFAULT false,
    resolution_time_seconds INTEGER,
    number_of_ai_responses INTEGER DEFAULT 0,
    knowledge_base_hits INTEGER DEFAULT 0,
    escalated BOOLEAN DEFAULT false,
    customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users for the reporting dashboard
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_start_time ON call_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_session_id ON call_transcripts(call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_timestamp ON call_transcripts(timestamp);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_session_id ON sentiment_analysis(call_session_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_urgency ON sentiment_analysis(urgency_level);
CREATE INDEX IF NOT EXISTS idx_escalations_session_id ON escalations(call_session_id);
