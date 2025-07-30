#!/bin/bash

# Development Startup Script for AI Technical Support Service
# This script starts both backend and frontend in development mode

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use $1; then
        print_warning "Port $1 is in use. Killing existing process..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:$port/health >/dev/null 2>&1 || 
           curl -s http://localhost:$port >/dev/null 2>&1; then
            print_success "$service_name is ready on port $port"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "$service_name failed to start on port $port"
            return 1
        fi
        
        sleep 2
        attempt=$((attempt + 1))
    done
}

# Cleanup function for graceful shutdown
cleanup() {
    print_warning "\nShutting down services..."
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    kill_port 3000
    kill_port 3001
    
    print_success "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_status "Starting AI Technical Support Service Development Environment"
print_status "================================================================"

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

if ! command_exists psql; then
    print_warning "PostgreSQL client not found. Database checks will be skipped."
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ and try again."
    exit 1
fi

print_success "Node.js version $NODE_VERSION is compatible"

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

print_success ".env file found"

# Load environment variables
set -a
source .env
set +a

# Check database connection
if command_exists psql && [ ! -z "$DATABASE_URL" ]; then
    print_status "Checking database connection..."
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Cannot connect to database. Please ensure PostgreSQL is running and DATABASE_URL is correct."
        print_status "Try: brew services start postgresql"
        exit 1
    fi
fi

# Check if PostgreSQL is running
# if command_exists brew; then
#     if ! brew services list | grep postgresql | grep started >/dev/null 2>&1; then
#         print_warning "PostgreSQL service not detected as running"
#         print_status "Attempting to start PostgreSQL..."
#         brew services start postgresql
#         sleep 3
#     fi
# fi

# Clean up any existing processes on our ports
print_status "Cleaning up existing processes..."
kill_port 3000
kill_port 3001

# Install backend dependencies
print_status "Installing/updating backend dependencies..."
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
if [ -d "admin-dashboard" ]; then
    print_status "Installing/updating frontend dependencies..."
    cd admin-dashboard
    if npm install; then
        print_success "Frontend dependencies installed"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    cd ..
else
    print_warning "admin-dashboard directory not found. Frontend will not be started."
fi

# Run any pending migrations
print_status "Running database migrations..."
if npm run migrate; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed"
    exit 1
fi

# Start backend service
print_status "Starting backend service on port 3000..."
npm run dev > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
if wait_for_service 3000 "Backend API"; then
    print_success "Backend service started successfully (PID: $BACKEND_PID)"
else
    print_error "Backend service failed to start"
    cleanup
    exit 1
fi

# Start frontend service (if directory exists)
if [ -d "admin-dashboard" ]; then
    print_status "Starting frontend service on port 3001..."
    cd admin-dashboard
    BROWSER=none npm start > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to be ready
    if wait_for_service 3001 "Frontend Dashboard"; then
        print_success "Frontend service started successfully (PID: $FRONTEND_PID)"
    else
        print_warning "Frontend service may have issues starting"
    fi
fi

# Display service status
print_success "================================================================"
print_success "🚀 AI Technical Support Service is ready for development!"
print_success "================================================================"
echo ""
print_status "📊 Service URLs:"
echo "   • Backend API:      http://localhost:3000"
echo "   • Health Check:     http://localhost:3000/health"
echo "   • API Docs:         http://localhost:3000/api"
if [ -d "admin-dashboard" ]; then
echo "   • Admin Dashboard:  http://localhost:3001"
fi
echo ""
print_status "📞 Test Phone Numbers:"
echo "   • Mary Johnson:     +15551234567 (Enrolled)"
echo "   • Robert Wilson:    +15551234568 (Enrolled)"
echo "   • Dorothy Smith:    +15551234569 (Needs Enrollment)"
echo "   • Margaret Brown:   +15551234570 (Pending Signup)"
echo "   • Frank Miller:     +15551234571 (Pending Signup)"
echo ""
print_status "📝 Development Commands:"
echo "   • Test Family Signup: curl -X POST http://localhost:3000/api/subscribers/signup -H 'Content-Type: application/json' -d '{...}'"
echo "   • View Logs:          tail -f logs/backend.log"
echo "   • Test Health:        curl http://localhost:3000/health"
echo ""
print_status "🔧 Environment:"
echo "   • Node.js Version:   $NODE_VERSION"
echo "   • Environment:       ${NODE_ENV:-development}"
echo "   • Database:          ${DATABASE_URL}"
echo "   • Twilio Phone:      ${TWILIO_PHONE_NUMBER:-Not configured}"
echo ""
print_warning "💡 Tips:"
echo "   • Configure your Twilio webhook to: ${TWILIO_WEBHOOK_URL:-https://yourdomain.com}/webhooks/twilio/incoming"
echo "   • Use ngrok for local webhook testing: ngrok http 3000"
echo "   • Press Ctrl+C to stop all services"
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

# Show real-time logs
print_status "📋 Showing real-time backend logs (Press Ctrl+C to stop):"
echo "================================================================"

# Follow backend logs
tail -f logs/backend.log 2>/dev/null || {
    print_warning "Backend log file not found, showing direct output..."
    wait
}

# This should never be reached due to the signal handler
cleanup