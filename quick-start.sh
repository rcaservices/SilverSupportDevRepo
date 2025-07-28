#!/bin/bash

echo "🚀 Starting AI Technical Support Development Environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null && ! command -v docker &> /dev/null; then
    echo "⚠️  Neither PostgreSQL nor Docker found. You'll need one to run the database."
    echo "   Install PostgreSQL: brew install postgresql"
    echo "   Or install Docker: https://docker.com"
fi

echo "📦 Installing dependencies..."
npm install

echo "📋 Copying environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file - please edit it with your API keys"
else
    echo "⚠️  .env file already exists"
fi

echo "🗄️  Setting up database..."
if command -v docker &> /dev/null; then
    echo "Starting PostgreSQL with Docker..."
    docker-compose up -d postgres
    sleep 5
    npm run setup:db
else
    echo "Please ensure PostgreSQL is running and run: npm run setup:db"
fi

echo "📚 Importing FAQ data..."
npm run import-faq

echo "🎉 Setup complete! Next steps:"
echo "   1. Edit .env file with your API keys"
echo "   2. Start development: npm run dev"
echo "   3. Start admin dashboard: cd admin-dashboard && npm install && npm run dev"
echo "   4. Visit http://localhost:3000/health to verify the API"
echo "   5. Visit http://localhost:3001 for the admin dashboard"
