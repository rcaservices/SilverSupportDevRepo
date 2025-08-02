#!/bin/bash

# Load DATABASE_URL from .env file
if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
else    
    echo "❌ .env file not found"
    exit 1
fi

echo "📊 Recent Signups:"
psql "$DATABASE_URL" -c "SELECT id, senior_name, senior_phone_number, family_email, created_at FROM pending_signups ORDER BY created_at DESC LIMIT 10;"

echo ""
echo "📋 Table Counts:"
psql "$DATABASE_URL" -c "SELECT 'pending_signups' as table_name, COUNT(*) as count FROM pending_signups UNION SELECT 'subscribers', COUNT(*) FROM subscribers;"
