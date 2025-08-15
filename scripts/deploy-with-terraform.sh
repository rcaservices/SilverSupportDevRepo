#!/bin/bash
set -e

echo "🚀 Deploying AI Support Service with Terraform..."

# Change to terraform directory
cd infrastructure/terraform

# Initialize Terraform
echo "📝 Initializing Terraform..."
terraform init

# Plan the deployment
echo "📋 Planning Terraform deployment..."
terraform plan -out=tfplan

# Apply the changes
echo "🔧 Applying Terraform changes..."
terraform apply tfplan

# Get outputs for application deployment
echo "📤 Getting Terraform outputs..."
export MAX_MESSAGE_LENGTH=$(terraform output -raw message_limits_config | jq -r '.max_message_length')
export MAX_TRANSCRIPTION_LENGTH=$(terraform output -raw message_limits_config | jq -r '.max_transcription_length')

echo "✅ Message limits configured:"
echo "   Max Message Length: $MAX_MESSAGE_LENGTH"
echo "   Max Transcription Length: $MAX_TRANSCRIPTION_LENGTH"

# Return to project root
cd ../..

# Build and deploy application
echo "🏗️ Building application..."
docker build -t ai-support:latest .

echo "🚀 Starting application with Terraform configuration..."
docker run -d \
  --name ai-support \
  -p 3000:3000 \
  -e MAX_MESSAGE_LENGTH=$MAX_MESSAGE_LENGTH \
  -e MAX_TRANSCRIPTION_LENGTH=$MAX_TRANSCRIPTION_LENGTH \
  ai-support:latest

echo "✅ Deployment complete!"