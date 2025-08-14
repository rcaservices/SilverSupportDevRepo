# 🚀 SilverSupport Alpha AWS Deployment Instructions

## Prerequisites Checklist

Before running the deployment, ensure you have:

- ✅ **AWS CLI** installed and configured with `ai-support-project` profile
- ✅ **Terraform** installed (version 1.0+)
- ✅ **Docker** installed and running
- ✅ **jq** installed (for JSON parsing)
- ✅ **Domain** `silverzupport.us` with Route53 hosted zone
- ✅ **API Keys** ready: Twilio, Anthropic, OpenAI

## 📋 Step-by-Step Deployment

### Step 1: Install Missing Tools (if needed)

```bash
# Install Terraform (macOS)
brew install terraform

# Install jq (macOS)
brew install jq

# Verify installations
terraform version
docker version
jq --version
```

### Step 2: Prepare Project Structure

```bash
# Create infrastructure directory
mkdir -p infrastructure/terraform

# Save the Terraform files to infrastructure/terraform/
# - main.tf (main infrastructure)
# - rds.tf (database configuration)  
# - ecs.tf (container orchestration)
# - alb.tf (load balancer and SSL)
```

### Step 3: Make Deployment Script Executable

```bash
# Make the deployment script executable
chmod +x deploy-aws.sh
```

### Step 4: Run Deployment

```bash
# Start the deployment
./deploy-aws.sh
```

The script will:
1. ✅ Verify prerequisites and AWS access
2. ✅ Deploy infrastructure with Terraform (~15 minutes)
3. ✅ Build and push Docker container to ECR (~5 minutes)
4. ✅ Deploy ECS service with auto-scaling (~5 minutes)
5. ✅ Set up database and run migrations (~3 minutes)
6. ✅ Configure SSL certificates and DNS (~2 minutes)

**Total deployment time: ~30 minutes**

## 🔧 Post-Deployment Configuration

### Step 5: Add API Keys to Secrets Manager

After deployment, you need to add your API keys to AWS Secrets Manager:

```bash
# Get the secret ARN from deployment output
SECRET_ARN=$(cd infrastructure/terraform && terraform output -raw app_secrets_arn)

# Update the secret with your API keys
aws secretsmanager update-secret \
  --secret-id "$SECRET_ARN" \
  --secret-string '{
    "JWT_SECRET": "auto-generated",
    "ENCRYPTION_KEY": "auto-generated", 
    "SESSION_SECRET": "auto-generated",
    "TWILIO_ACCOUNT_SID": "your_twilio_account_sid",
    "TWILIO_AUTH_TOKEN": "your_twilio_auth_token",
    "TWILIO_PHONE_NUMBER": "your_twilio_phone_number",
    "ANTHROPIC_API_KEY": "your_anthropic_api_key",
    "OPENAI_API_KEY": "your_openai_api_key",
    "AZURE_SPEECH_KEY": "your_azure_speech_key",
    "AZURE_SPEECH_REGION": "your_azure_region"
  }' \
  --profile ai-support-project
```

### Step 6: Restart ECS Service to Pick Up New Secrets

```bash
# Force ECS service to restart with new secrets
aws ecs update-service \
  --cluster silversupport-alpha-cluster \
  --service silversupport-alpha-service \
  --force-new-deployment \
  --profile ai-support-project \
  --region us-east-1
```

### Step 7: Verify Deployment

```bash
# Check application health
curl https://alpha.silverzupport.us/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-08-14T...",
  "service": "SilverSupport.ai - AI Technical Support",
  "version": "1.1.0",
  "features": [
    "voice-authentication",
    "senior-friendly-signup", 
    "family-portal",
    "usage-analytics"
  ]
}
```

## 🌐 Your Deployed URLs

After successful deployment, you'll have:

- **Alpha Environment**: https://alpha.silverzupport.us
- **API Endpoints**: https://api.silverzupport.us
- **Admin Dashboard**: https://admin.silverzupport.us

## 📊 Monitoring and Management

### CloudWatch Dashboards

Access your monitoring dashboards:
1. Go to AWS CloudWatch Console
2. Navigate to "Dashboards"
3. Find dashboards starting with "silversupport-alpha"

### Key Metrics to Monitor

- **ECS Service Health**: Task count, CPU/Memory usage
- **RDS Performance**: Connections, CPU, storage
- **ALB Metrics**: Response times, error rates
- **Application Logs**: Error patterns, voice auth success rates

### View Application Logs

```bash
# View ECS container logs
aws logs tail /ecs/silversupport-alpha \
  --follow \
  --profile ai-support-project \
  --region us-east-1
```

## 🔧 Common Management Tasks

### Update Application Code

```bash
# After making code changes, redeploy:
./deploy-aws.sh

# Or manually:
docker build -t silversupport-alpha .
docker tag silversupport-alpha:latest $ECR_REPOSITORY_URL:latest
docker push $ECR_REPOSITORY_URL:latest

aws ecs update-service \
  --cluster silversupport-alpha-cluster \
  --service silversupport-alpha-service \
  --force-new-deployment \
  --profile ai-support-project
```

### Scale ECS Service

```bash
# Scale to 4 tasks
aws ecs update-service \
  --cluster silversupport-alpha-cluster \
  --service silversupport-alpha-service \
  --desired-count 4 \
  --profile ai-support-project
```

### Database Access

```bash
# Connect to RDS database
SECRET_ARN=$(cd infrastructure/terraform && terraform output -raw rds_secret_arn)
DB_CREDS=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text)

DB_HOST=$(echo "$DB_CREDS" | jq -r '.host')
DB_USER=$(echo "$DB_CREDS" | jq -r '.username') 
DB_PASSWORD=$(echo "$DB_CREDS" | jq -r '.password')
DB_NAME=$(echo "$DB_CREDS" | jq -r '.dbname')

# Connect via psql (requires VPN or bastion host for production)
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME"
```

## 🚨 Troubleshooting

### ECS Service Won't Start

```bash
# Check service events
aws ecs describe-services \
  --cluster silversupport-alpha-cluster \
  --services silversupport-alpha-service \
  --profile ai-support-project \
  --query 'services[0].events[0:10]'

# Check task definition
aws ecs describe-task-definition \
  --task-definition silversupport-alpha-app \
  --profile ai-support-project
```

### SSL Certificate Issues

```bash
# Check certificate status
aws acm list-certificates \
  --profile ai-support-project \
  --region us-east-1

# Check DNS validation records
dig _acme-challenge.silverzupport.us TXT
```

### Database Connection Issues

```bash
# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier silversupport-alpha-database \
  --profile ai-support-project \
  --query 'DBInstances[0].DBInstanceStatus'

# Check security groups
aws ec2 describe-security-groups \
  --group-names silversupport-alpha-rds-sg \
  --profile ai-support-project
```

### High Costs

```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-08-01,End=2025-08-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --profile ai-support-project
```

## 💰 Cost Optimization Tips

### For Alpha Testing

1. **Use Spot Instances**: Consider Fargate Spot for non-critical workloads
2. **Right-size RDS**: Monitor actual usage and downsize if needed
3. **S3 Lifecycle Policies**: Archive old voice recordings to cheaper storage
4. **CloudWatch Log Retention**: Reduce retention period for verbose logs

### Monitor and Optimize

```bash
# Set up billing alerts
aws budgets create-budget \
  --account-id 276824025294 \
  --budget '{
    "BudgetName": "SilverSupport-Alpha-Monthly",
    "BudgetLimit": {
      "Amount": "150",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --profile ai-support-project
```

## 🔄 Backup and Recovery

### Automated Backups

The deployment includes:
- **RDS automated backups** (7 days retention)
- **S3 versioning** for voice recordings
- **CloudWatch log retention** (7 days)

### Manual Backup

```bash
# Create RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier silversupport-alpha-database \
  --db-snapshot-identifier silversupport-alpha-backup-$(date +%Y%m%d) \
  --profile ai-support-project
```

### Disaster Recovery

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier silversupport-alpha-database-restored \
  --db-snapshot-identifier silversupport-alpha-backup-20250814 \
  --profile ai-support-project
```

## 📈 Scaling for Production

When ready to move from alpha to production:

### Infrastructure Changes

1. **Multi-AZ RDS** for high availability
2. **Multiple regions** for global users  
3. **ElastiCache** for session caching
4. **CloudFront CDN** for static assets
5. **WAF protection** against attacks

### Update Terraform Configuration

```hcl
# In rds.tf, change:
multi_az = true
instance_class = "db.t3.small"  # or larger

# In main.tf, add:
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
}
```

## 🎯 Alpha Testing Success Metrics

Monitor these KPIs during alpha testing:

### Technical Metrics
- **Uptime**: >99.5%
- **API Response Time**: <500ms (95th percentile)
- **Voice Auth Accuracy**: >85%
- **Error Rate**: <1%

### User Experience Metrics  
- **Call Completion Rate**: >90%
- **User Satisfaction**: >4/5 stars
- **Support Escalation Rate**: <20%
- **Feature Usage**: Track most/least used features

### Business Metrics
- **Cost per User**: Target <$5/month during alpha
- **Voice Data Storage**: Monitor growth rate
- **Database Performance**: Query response times

## 🆘 Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review CloudWatch alarms and metrics
2. **Monthly**: Analyze costs and optimize resources
3. **Quarterly**: Update dependencies and security patches

### Emergency Contacts

- **AWS Support**: Available through AWS Console
- **Twilio Support**: 24/7 via Twilio Console  
- **Database Issues**: Monitor RDS Performance Insights

### Rollback Procedure

```bash
# Emergency rollback to previous version
PREVIOUS_TASK_DEF=$(aws ecs list-task-definitions \
  --family-prefix silversupport-alpha-app \
  --status ACTIVE \
  --sort DESC \
  --max-items 2 \
  --query 'taskDefinitionArns[1]' \
  --output text \
  --profile ai-support-project)

aws ecs update-service \
  --cluster silversupport-alpha-cluster \
  --service silversupport-alpha-service \
  --task-definition "$PREVIOUS_TASK_DEF" \
  --profile ai-support-project
```

---

## 🎉 Congratulations!

You now have a fully deployed, production-ready alpha environment for SilverSupport running on AWS! 

Your alpha testing environment is ready at **https://alpha.silverzupport.us** with:
- ✅ Voice authentication system
- ✅ AI-powered support responses  
- ✅ Family signup portal
- ✅ Auto-scaling infrastructure
- ✅ SSL certificates and monitoring
- ✅ Database with migrations applied

**Next steps**: Add your API keys, test the voice authentication, and begin onboarding alpha testers!