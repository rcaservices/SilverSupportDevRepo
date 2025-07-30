-- Migration: Add Voice Authentication Tables
-- File: src/database/migrations/003_add_voice_authentication.sql

-- Main subscribers table (enhanced from existing users table)
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255), -- Often family member's email
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    
    -- Voice authentication
    voice_print_hash TEXT,
    enrollment_phrase TEXT,
    voice_confidence_threshold DECIMAL(3,2) DEFAULT 0.75,
    voice_enrollment_completed BOOLEAN DEFAULT false,
    
    -- Subscription details
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    subscription_status VARCHAR(50) DEFAULT 'active',
    monthly_call_limit INTEGER DEFAULT 50,
    calls_used_this_month INTEGER DEFAULT 0,
    billing_cycle_start DATE DEFAULT CURRENT_DATE,
    
    -- Family/caregiver info
    enrolled_by VARCHAR(255), -- Family member who set it up
    family_contact_email VARCHAR(255), -- For billing and notifications
    family_contact_phone VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    
    -- Preferences for seniors
    preferred_language VARCHAR(10) DEFAULT 'en-US',
    preferred_voice_speed VARCHAR(20) DEFAULT 'slow', -- slow, normal, fast
    hearing_assistance BOOLEAN DEFAULT false,
    large_text_preference BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending signups (when family members pre-register)
CREATE TABLE IF NOT EXISTS pending_signups (
    id SERIAL PRIMARY KEY,
    
    -- Senior information
    senior_name VARCHAR(255) NOT NULL,
    senior_phone_number VARCHAR(20) NOT NULL,
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(50),
    
    -- Family member who signed them up
    family_member_name VARCHAR(255) NOT NULL,
    family_email VARCHAR(255) NOT NULL,
    family_phone VARCHAR(20),
    relationship VARCHAR(100), -- daughter, son, spouse, etc.
    
    -- Subscription details
    selected_tier VARCHAR(50) DEFAULT 'basic',
    payment_method_token TEXT, -- Payment processor token
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'awaiting_voice_enrollment',
    signup_method VARCHAR(50) DEFAULT 'online',
    signup_source VARCHAR(100),
    
    -- Security
    verification_code VARCHAR(10),
    verification_expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    completed_at TIMESTAMP
);

-- Voice authentication attempts and security
CREATE TABLE IF NOT EXISTS voice_auth_attempts (
    id SERIAL PRIMARY KEY,
    call_session_id INTEGER REFERENCES call_sessions(id),
    phone_number VARCHAR(20) NOT NULL,
    
    -- Voice analysis results
    confidence_score DECIMAL(3,2),
    voice_quality VARCHAR(50), -- good, poor, noisy, etc.
    audio_duration_seconds INTEGER,
    background_noise_level VARCHAR(50),
    
    -- Authentication result
    auth_successful BOOLEAN DEFAULT false,
    failure_reason VARCHAR(255),
    action_taken VARCHAR(100), -- 'proceed', 'enrollment', 'human_transfer'
    
    -- Security tracking
    suspicious_activity BOOLEAN DEFAULT false,
    fraud_indicators JSONB,
    ip_address INET,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support interaction tracking
CREATE TABLE IF NOT EXISTS support_interactions (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER REFERENCES subscribers(id),
    call_session_id INTEGER REFERENCES call_sessions(id),
    
    -- Interaction details
    issue_category VARCHAR(100), -- internet, computer, phone, billing
    issue_description TEXT,
    resolution_provided TEXT,
    was_resolved BOOLEAN DEFAULT false,
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    
    -- AI vs Human handling
    handled_by VARCHAR(50) DEFAULT 'ai', -- 'ai', 'human', 'both'
    escalated_to_human BOOLEAN DEFAULT false,
    escalation_reason VARCHAR(255),
    
    -- Timing
    interaction_duration_seconds INTEGER,
    resolution_time_seconds INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family member access (for checking on their senior)
CREATE TABLE IF NOT EXISTS family_access (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER REFERENCES subscribers(id),
    family_email VARCHAR(255) NOT NULL,
    family_name VARCHAR(255),
    relationship VARCHAR(100),
    access_level VARCHAR(50) DEFAULT 'view_only',
    can_receive_alerts BOOLEAN DEFAULT true,
    can_modify_settings BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly usage for billing
CREATE TABLE IF NOT EXISTS monthly_usage (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER REFERENCES subscribers(id),
    billing_month DATE NOT NULL,
    
    -- Call statistics
    total_calls INTEGER DEFAULT 0,
    ai_handled_calls INTEGER DEFAULT 0,
    human_escalated_calls INTEGER DEFAULT 0,
    average_call_duration_seconds INTEGER DEFAULT 0,
    
    -- Cost breakdown
    base_subscription_cost_cents INTEGER,
    overage_calls INTEGER DEFAULT 0,
    overage_cost_cents INTEGER DEFAULT 0,
    premium_features_cost_cents INTEGER DEFAULT 0,
    total_cost_cents INTEGER,
    
    -- Service quality metrics
    average_satisfaction DECIMAL(3,2),
    resolution_rate DECIMAL(3,2),
    first_call_resolution_rate DECIMAL(3,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscriber_id, billing_month)
);

-- Enhance existing call_sessions table
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS voice_auth_id INTEGER REFERENCES voice_auth_attempts(id);
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS auth_confidence DECIMAL(3,2);
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS subscriber_id INTEGER REFERENCES subscribers(id);
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'support'; -- support, enrollment, billing

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscribers_voice_hash ON subscribers(voice_print_hash) WHERE voice_print_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(subscription_status);
CREATE INDEX IF NOT EXISTS idx_pending_signups_phone ON pending_signups(senior_phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON pending_signups(status);
CREATE INDEX IF NOT EXISTS idx_pending_signups_expires ON pending_signups(expires_at);
CREATE INDEX IF NOT EXISTS idx_voice_auth_phone ON voice_auth_attempts(phone_number);
CREATE INDEX IF NOT EXISTS idx_voice_auth_call_session ON voice_auth_attempts(call_session_id);
CREATE INDEX IF NOT EXISTS idx_support_interactions_subscriber ON support_interactions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_subscriber_month ON monthly_usage(subscriber_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_call_sessions_subscriber ON call_sessions(subscriber_id) WHERE subscriber_id IS NOT NULL;