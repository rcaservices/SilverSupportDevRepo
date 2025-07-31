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

echo "🚀 Running security migration..."
echo "Database URL: ${DATABASE_URL}"

# Run the security migration
if psql "$DATABASE_URL" -f src/database/migrations/004_add_security_tracking.sql; then
    echo "✅ Security migration completed successfully!"
    
    # Verify tables were created
    echo "🔍 Verifying tables..."
    psql "$DATABASE_URL" -c "\dt" | grep -E "(security_events|ip_management|rate_limit_violations|email_logs)"
    
else
    echo "❌ Migration failed!"
    exit 1
fi
