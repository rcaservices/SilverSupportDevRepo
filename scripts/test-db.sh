#!/bin/bash

# Load DATABASE_URL from .env file
if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
else
    echo "❌ .env file not found"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env file"
    exit 1
fi

echo "🔍 Testing database connection..."
echo "Database URL: ${DATABASE_URL}"

# Test the connection
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful!"
    
    # Check if security tables exist
    echo "🔍 Checking for security tables..."
    
    TABLES=$(psql "$DATABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('security_events', 'ip_management', 'rate_limit_violations', 'email_logs');")
    
    if [[ $TABLES == *"security_events"* ]]; then
        echo "✅ Security tables already exist"
    else
        echo "⚠️  Security tables not found - migration needed"
        echo "   Run: ./scripts/migrate-security.sh"
    fi
    
else
    echo "❌ Database connection failed!"
    echo "   Check your DATABASE_URL in .env file"
    echo "   Make sure your PostgreSQL container is running"
    exit 1
fi