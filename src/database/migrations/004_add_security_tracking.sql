-- File: src/database/migrations/004_add_security_tracking.sql
-- Migration: Add Security and Tracking Tables
-- Run this after your existing migrations

-- Enhanced pending_signups table with security fields
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS signup_ip INET;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS signup_user_agent TEXT;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en-US';
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS preferred_voice_speed VARCHAR(20) DEFAULT 'slow';
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS hearing_assistance BOOLEAN DEFAULT false;
ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);

-- Security events tracking
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'suspicious_activity', 'rate_limit', 'fraud_attempt'
    ip_address INET NOT NULL,
    user_agent TEXT,
    event_details JSONB,
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP blocking/allowlist
CREATE TABLE IF NOT EXISTS ip_management (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL, -- 'blocked', 'trusted', 'monitored'
    reason TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    violation_count INTEGER DEFAULT 1,
    window_start TIMESTAMP NOT NULL,
    last_violation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ip_address, endpoint, window_start)
);

-- Email delivery tracking
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'signup_confirmation', 'security_alert'
    message_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent', -- sent, failed, bounced
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_ip_time ON security_events(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_ip_endpoint ON rate_limit_violations(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_pending_signups_phone ON pending_signups(senior_phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(family_email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_ip ON pending_signups(signup_ip, created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email, created_at);
CREATE INDEX IF NOT EXISTS idx_ip_management_status ON ip_management(status, expires_at);

-- Add comments for documentation
COMMENT ON TABLE security_events IS 'Tracks security-related events and potential threats';
COMMENT ON TABLE ip_management IS 'Manages IP blocking, whitelisting, and monitoring';
COMMENT ON TABLE rate_limit_violations IS 'Tracks rate limiting violations for analysis';
COMMENT ON TABLE email_logs IS 'Logs email delivery status for monitoring and debugging';

-- Create a view for recent security activity (useful for monitoring)
CREATE OR REPLACE VIEW recent_security_activity AS
SELECT 
    se.event_type,
    se.ip_address,
    se.severity,
    se.blocked,
    se.created_at,
    im.status as ip_status,
    COUNT(*) OVER (PARTITION BY se.ip_address) as events_from_ip
FROM security_events se
LEFT JOIN ip_management im ON se.ip_address = im.ip_address
WHERE se.created_at > NOW() - INTERVAL '24 hours'
ORDER BY se.created_at DESC;

-- Create function to automatically clean old security events (optional)
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS void AS $$
BEGIN
    -- Keep only last 30 days of security events
    DELETE FROM security_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Keep only last 7 days of rate limit violations
    DELETE FROM rate_limit_violations 
    WHERE window_start < NOW() - INTERVAL '7 days';
    
    -- Keep only last 90 days of email logs
    DELETE FROM email_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Remove expired IP blocks
    DELETE FROM ip_management 
    WHERE status = 'blocked' AND expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (uncomment if you want automatic cleanup)
-- SELECT cron.schedule('cleanup-security', '0 2 * * *', 'SELECT cleanup_old_security_events();');