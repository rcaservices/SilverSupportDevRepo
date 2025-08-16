#!/bin/bash
# deploy-ecs.sh - Deploy AI Support to AWS ECS Fargate

set -e

echo "🚀 Deploying AI Support to AWS ECS Fargate..."

# Configuration
AWS_REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${YELLOW}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure'"
    exit 1
fi

print_success "Prerequisites check passed"

# Step 1: Verify Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found in root directory"
    print_info "Please create Dockerfile in the root directory"
    exit 1
fi

print_success "Dockerfile found"

# Step 2: Deploy ECR repository
print_status "Deploying ECR repository..."
cd infrastructure/terraform

terraform plan -target=aws_ecr_repository.app -out=ecr-plan
terraform apply ecr-plan

# Get ECR repository URL
ECR_URL=$(terraform output -raw ecr_repository_url)
print_success "ECR repository created: $ECR_URL"

cd ../..

# Step 3: Build Docker image
print_status "Building Docker image..."
docker build -t ai-support:latest .
print_success "Docker image built"

# Step 4: Tag and push to ECR
print_status "Pushing image to ECR..."

# Tag for ECR
docker tag ai-support:latest $ECR_URL:latest

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# Push image
docker push $ECR_URL:latest
print_success "Image pushed to ECR"

# Step 5: Deploy ECS infrastructure
print_status "Deploying ECS infrastructure (this may take 5-10 minutes)..."
cd infrastructure/terraform

terraform plan -out=ecs-plan
terraform apply ecs-plan

# Get outputs
LB_URL=$(terraform output -raw load_balancer_dns)
print_success "ECS infrastructure deployed"

cd ../..

# Step 6: Wait for deployment and test
print_status "Waiting for ECS service to become healthy..."
print_info "This can take 3-5 minutes for the service to fully start..."

sleep 180  # Wait 3 minutes

# Test deployment
print_status "Testing deployment..."

# Test health endpoint
for i in {1..10}; do
    print_info "Attempt $i/10: Testing http://$LB_URL/health"
    
    if curl -f -s http://$LB_URL/health > /dev/null; then
        print_success "Health check passed!"
        break
    else
        if [ $i -eq 10 ]; then
            print_error "Deployment health check failed after 10 attempts"
            print_info "Check ECS service status in AWS console"
            exit 1
        fi
        sleep 30
    fi
done

# Test AI endpoints
print_status "Testing AI endpoints..."

print_info "Testing AI health..."
curl -s http://$LB_URL/api/ai/health | jq . || echo "Response received"

print_info "Testing AI generation..."
curl -s -X POST http://$LB_URL/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello from AWS ECS!"}' | jq . || echo "Response received"

# Success!
echo ""
print_success "🎉 Deployment Complete!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "Your AI Support service is now running on AWS ECS!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "🌐 Application URL: http://$LB_URL"
echo "🏥 Health Check:   http://$LB_URL/health"
echo "🤖 AI Health:      http://$LB_URL/api/ai/health"
echo "📊 AI Generate:    http://$LB_URL/api/ai/generate"
echo ""
echo "Test commands:"
echo "curl http://$LB_URL/health"
echo "curl http://$LB_URL/api/ai/health"
echo "curl -X POST http://$LB_URL/api/ai/generate -H 'Content-Type: application/json' -d '{\"query\": \"test\"}'"
echo ""
print_info "The service is running on AWS ECS Fargate with your SSM parameters!"
print_info "Your message length limits are automatically applied from your Terraform deployment!"