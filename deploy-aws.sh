#!/bin/bash
# File: deploy-aws.sh
# SilverSupport Alpha AWS Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="silversupport"
ENVIRONMENT="alpha"
AWS_REGION="us-east-1"
AWS_PROFILE="ai-support-project"
DOMAIN_NAME="silverzupport.us"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"
DOCKER_DIR="$PROJECT_ROOT"

echo -e "${BLUE}=================================================================${NC}"
echo -e "${BLUE}🚀 SilverSupport Alpha AWS Deployment${NC}"
echo -e "${BLUE}=================================================================${NC}"
echo -e "Project: $PROJECT_NAME"
echo -e "Environment: $ENVIRONMENT"
echo -e "Region: $AWS_REGION"
echo -e "Domain: $DOMAIN_NAME"
echo -e "Profile: $AWS_PROFILE"
echo ""

# Function to print status messages
print_status() {
    echo -e "${BLUE}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for user confirmation
confirm() {
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
}

# Pre-flight checks
print_status "Running pre-flight checks..."

# Check required tools
if ! command_exists aws; then
    print_error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command_exists terraform; then
    print_error "Terraform not found. Please install Terraform."
    exit 1
fi

if ! command_exists docker; then
    print_error "Docker not found. Please install Docker."
    exit 1
fi

print_success "All required tools found"

# Check AWS credentials
print_status "Verifying AWS credentials..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
    print_error "AWS credentials not configured for profile: $AWS_PROFILE"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
print_success "AWS credentials verified for account: $ACCOUNT_ID"

# Check if domain exists in Route53
print_status "Verifying Route53 hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones --profile "$AWS_PROFILE" --query "HostedZones[?Name=='$DOMAIN_NAME.'].Id" --output text | sed 's|/hostedzone/||')

if [ -z "$HOSTED_ZONE_ID" ]; then
    print_error "Route53 hosted zone not found for domain: $DOMAIN_NAME"
    exit 1
fi

print_success "Route53 hosted zone found: $HOSTED_ZONE_ID"

# Create necessary directories
print_status "Creating project directories..."
mkdir -p "$TERRAFORM_DIR"
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/.docker"

# Set environment variables
export AWS_PROFILE="$AWS_PROFILE"
export AWS_DEFAULT_REGION="$AWS_REGION"
export TF_VAR_aws_region="$AWS_REGION"
export TF_VAR_aws_profile="$AWS_PROFILE"
export TF_VAR_domain_name="$DOMAIN_NAME"
export TF_VAR_environment="$ENVIRONMENT"
export TF_VAR_project_name="$PROJECT_NAME"

print_success "Environment variables set"

# Display deployment plan
echo ""
print_status "Deployment Plan:"
echo "• VPC with public/private subnets"
echo "• RDS PostgreSQL database (db.t3.micro)"
echo "• ECS Fargate cluster with auto-scaling"
echo "• Application Load Balancer with SSL"
echo "• S3 buckets for storage"
echo "• CloudWatch monitoring"
echo "• Route53 DNS configuration"
echo ""
echo "Estimated monthly cost: \$86-126"
echo ""
print_warning "This will create AWS resources that incur costs."
confirm

# Phase 1: Infrastructure Deployment
print_status "Phase 1: Deploying infrastructure with Terraform..."

cd "$TERRAFORM_DIR"

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init

# Plan deployment
print_status "Creating Terraform plan..."
terraform plan -out=tfplan

print_warning "Review the Terraform plan above."
confirm

# Apply infrastructure
print_status "Applying Terraform configuration..."
terraform apply tfplan

# Get outputs
ECR_REPOSITORY_URL=$(terraform output -raw ecr_repository_url)
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
ALB_DNS_NAME=$(terraform output -raw alb_dns_name)

print_success "Infrastructure deployed successfully"

cd "$PROJECT_ROOT"

# Phase 2: Docker Build and Push
print_status "Phase 2: Building and pushing Docker image..."

# Create Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
    print_status "Creating Dockerfile..."
    cat > Dockerfile << 'EOF'
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/app.js"]
EOF
    print_success "Dockerfile created"
fi

# Create .dockerignore if it doesn't exist
if [ ! -f ".dockerignore" ]; then
    cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
logs
.git
.gitignore
README.md
Dockerfile
.dockerignore
admin-dashboard
infrastructure
.env*
.DS_Store
*.log
EOF
    print_success ".dockerignore created"
fi

# Login to ECR
print_status "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
    docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"

# Build Docker image
print_status "Building Docker image..."
docker build -t "$PROJECT_NAME-$ENVIRONMENT" .

# Tag for ECR
print_status "Tagging image for ECR..."
docker tag "$PROJECT_NAME-$ENVIRONMENT:latest" "$ECR_REPOSITORY_URL:latest"

# Push to ECR
print_status "Pushing image to ECR..."
docker push "$ECR_REPOSITORY_URL:latest"

print_success "Docker image pushed successfully"

# Phase 3: Update ECS Service
print_status "Phase 3: Updating ECS service..."

# Force new deployment to pick up the new image
CLUSTER_NAME="$PROJECT_NAME-$ENVIRONMENT-cluster"
SERVICE_NAME="$PROJECT_NAME-$ENVIRONMENT-service"

aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --force-new-deployment \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" >/dev/null

print_success "ECS service updated"

# Phase 4: Database Setup
print_status "Phase 4: Setting up database..."

# Get database credentials from Secrets Manager
DB_SECRET_ARN=$(cd "$TERRAFORM_DIR" && terraform output -raw rds_secret_arn)
DB_CREDENTIALS=$(aws secretsmanager get-secret-value \
    --secret-id "$DB_SECRET_ARN" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query SecretString --output text)

DB_HOST=$(echo "$DB_CREDENTIALS" | jq -r '.host')
DB_PORT=$(echo "$DB_CREDENTIALS" | jq -r '.port')
DB_NAME=$(echo "$DB_CREDENTIALS" | jq -r '.dbname')
DB_USER=$(echo "$DB_CREDENTIALS" | jq -r '.username')
DB_PASSWORD=$(echo "$DB_CREDENTIALS" | jq -r '.password')

# Wait for RDS to be available
print_status "Waiting for RDS instance to be available..."
aws rds wait db-instance-available \
    --db-instance-identifier "$PROJECT_NAME-$ENVIRONMENT-database" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"

# Create a temporary container to run database migrations
print_status "Running database migrations..."
docker run --rm \
    -e DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" \
    -v "$PROJECT_ROOT/src/database:/migrations" \
    postgres:15-alpine \
    sh -c "PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -f /migrations/schema.sql"

print_success "Database migrations completed"

# Phase 5: Final Configuration
print_status "Phase 5: Final configuration and validation..."

# Wait for ECS service to stabilize
print_status "Waiting for ECS service to stabilize..."
aws ecs wait services-stable \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION"

# Test health endpoint
print_status "Testing application health..."
ALPHA_URL="https://alpha.$DOMAIN_NAME"

# Wait for SSL certificate and DNS propagation
sleep 30

for i in {1..10}; do
    if curl -f -s "$ALPHA_URL/health" >/dev/null 2>&1; then
        print_success "Application is responding"
        break
    else
        print_status "Waiting for application to be ready... (attempt $i/10)"
        sleep 30
    fi
    
    if [ $i -eq 10 ]; then
        print_warning "Application health check failed. Check ECS logs for details."
    fi
done

# Display deployment summary
echo ""
print_success "================================================================="
print_success "🎉 SilverSupport Alpha Deployment Complete!"
print_success "================================================================="
echo ""
echo "🌐 Application URLs:"
echo "   Alpha Environment: https://alpha.$DOMAIN_NAME"
echo "   API Endpoint:      https://api.$DOMAIN_NAME"
echo "   Admin Dashboard:   https://admin.$DOMAIN_NAME"
echo ""
echo "🗄️  Database:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo ""
echo "📊 AWS Resources:"
echo "   Load Balancer: $ALB_DNS_NAME"
echo "   ECS Cluster: $CLUSTER_NAME"
echo "   ECR Repository: $ECR_REPOSITORY_URL"
echo ""
echo "🔐 Next Steps:"
echo "   1. Add your API keys to AWS Secrets Manager:"
echo "      • TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"
echo "      • ANTHROPIC_API_KEY"
echo "      • OPENAI_API_KEY"
echo "   2. Test voice authentication functionality"
echo "   3. Set up monitoring alerts"
echo "   4. Begin alpha testing with selected users"
echo ""
echo "💰 Estimated monthly cost: \$86-126"
echo ""
print_success "Deployment completed successfully! 🚀"

# Create a configuration file for easy access
cat > "$PROJECT_ROOT/aws-config.env" << EOF
# SilverSupport Alpha AWS Configuration
# Generated on $(date)

AWS_REGION=$AWS_REGION
AWS_PROFILE=$AWS_PROFILE
DOMAIN_NAME=$DOMAIN_NAME
ENVIRONMENT=$ENVIRONMENT

# Application URLs
ALPHA_URL=https://alpha.$DOMAIN_NAME
API_URL=https://api.$DOMAIN_NAME
ADMIN_URL=https://admin.$DOMAIN_NAME

# AWS Resources
ECS_CLUSTER=$CLUSTER_NAME
ECS_SERVICE=$SERVICE_NAME
ECR_REPOSITORY_URL=$ECR_REPOSITORY_URL
RDS_ENDPOINT=$DB_HOST
ALB_DNS_NAME=$ALB_DNS_NAME

# Database (credentials in Secrets Manager)
DB_SECRET_ARN=$DB_SECRET_ARN
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
EOF

print_success "Configuration saved to aws-config.env"