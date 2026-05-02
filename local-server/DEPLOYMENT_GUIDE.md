# Deployment Guide - AI Diet & Meal Recommendation System

This guide covers deploying the Express.js API server to production using Docker containers.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Option 1: Deploy to Render.com](#option-1-deploy-to-rendercom)
3. [Option 2: Deploy to Railway.app](#option-2-deploy-to-railwayapp)
4. [Option 3: Deploy to AWS EC2](#option-3-deploy-to-aws-ec2)
5. [Post-Deployment Steps](#post-deployment-steps)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- ✅ AWS Account with configured services:
  - Cognito User Pool
  - DynamoDB Tables (Users, GlucoseReadings, FoodLogs, UsageTracking, etc.)
  - S3 Buckets (food-images, reports, glucose-files)
  - IAM User with programmatic access
- ✅ Environment variables ready (see `.env.example`)
- ✅ Docker installed locally (for testing)
- ✅ Git repository with latest code

### Test Docker Build Locally

```bash
# Build Docker image
docker build -t ai-diet-api:latest .

# Test run locally
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e AWS_REGION=ap-south-1 \
  -e AWS_ACCESS_KEY_ID=your_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret \
  ai-diet-api:latest

# Test health endpoint
curl http://localhost:3000/health
```

---

## Option 1: Deploy to Render.com

**Cost**: ~$7/month (Starter plan) or $25/month (Standard plan)
**Pros**: Easy setup, automatic SSL, built-in monitoring
**Cons**: Cold starts on free tier, limited to 512MB RAM on starter

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub/GitLab
3. Connect your repository

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Select your repository
3. Configure:
   - **Name**: `ai-diet-api`
   - **Region**: Choose closest to your users (e.g., Singapore)
   - **Branch**: `main`
   - **Root Directory**: `local-server`
   - **Environment**: `Docker`
   - **Plan**: Starter ($7/month) or Standard ($25/month)

### Step 3: Configure Environment Variables

Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=3000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your_access_key>
AWS_SECRET_ACCESS_KEY=<your_secret_key>
COGNITO_USER_POOL_ID=<your_pool_id>
COGNITO_CLIENT_ID=<your_client_id>
DYNAMODB_USERS_TABLE=Users
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings
DYNAMODB_FOOD_TABLE=FoodLogs
DYNAMODB_USAGE_TABLE=UsageTracking
DYNAMODB_ACTIVITY_TABLE=ActivityLogs
DYNAMODB_AI_INSIGHTS_TABLE=AIInsights
S3_FOOD_IMAGES_BUCKET=<your_bucket_name>
S3_REPORTS_BUCKET=<your_bucket_name>
S3_GLUCOSE_FILES_BUCKET=<your_bucket_name>
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Build Docker image
   - Deploy to their infrastructure
   - Assign a URL: `https://ai-diet-api.onrender.com`
3. Monitor deployment logs in real-time

### Step 5: Configure Health Checks

Render automatically uses the `HEALTHCHECK` from Dockerfile:
- Endpoint: `/health`
- Interval: 30 seconds
- Timeout: 3 seconds

### Step 6: Set Up Auto-Deploy

1. Go to **Settings** → **Build & Deploy**
2. Enable **"Auto-Deploy"** for `main` branch
3. Every push to `main` triggers automatic deployment

### Render-Specific Notes

- **Scaling**: Upgrade to Standard plan for horizontal scaling
- **Logs**: View logs in Render dashboard or use `render logs`
- **Custom Domain**: Add custom domain in Settings → Custom Domains
- **SSL**: Automatic SSL certificates via Let's Encrypt

---

## Option 2: Deploy to Railway.app

**Cost**: $5/month base + usage (~$10-15/month total)
**Pros**: Simple deployment, good developer experience, fair pricing
**Cons**: Newer platform, fewer features than Render

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Install Railway CLI (optional):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

### Step 2: Create New Project

**Via Dashboard:**
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository
4. Railway auto-detects Dockerfile

**Via CLI:**
```bash
cd local-server
railway init
railway up
```

### Step 3: Configure Environment Variables

**Via Dashboard:**
1. Go to project → **Variables**
2. Add all environment variables (same as Render list above)

**Via CLI:**
```bash
railway variables set NODE_ENV=production
railway variables set AWS_REGION=ap-south-1
railway variables set AWS_ACCESS_KEY_ID=<your_key>
# ... add all other variables
```

### Step 4: Deploy

**Via Dashboard:**
- Railway automatically deploys on push to `main`

**Via CLI:**
```bash
railway up
```

### Step 5: Get Deployment URL

```bash
railway domain
```

Or in dashboard: Settings → Domains → Generate Domain

### Step 6: Configure Health Checks

Railway uses Docker `HEALTHCHECK` automatically.

### Railway-Specific Notes

- **Scaling**: Vertical scaling available, horizontal scaling in beta
- **Logs**: `railway logs` or view in dashboard
- **Custom Domain**: Add in Settings → Domains
- **SSL**: Automatic SSL certificates
- **Database**: Can add PostgreSQL/Redis with one click

---

## Option 3: Deploy to AWS EC2

**Cost**: 
- **First 12 months**: $0-16/month (t2.micro free tier + optional Load Balancer)
- **After free tier**: $36-56/month (t3.small/medium + Load Balancer)

**Pros**: Full control, best performance, AWS ecosystem integration, **FREE for first year**
**Cons**: More complex setup, requires DevOps knowledge

### AWS Free Tier Benefits (First 12 Months)

- ✅ **EC2**: 750 hours/month of t2.micro (1 vCPU, 1GB RAM) - **FREE**
- ✅ **DynamoDB**: 25GB storage + 25 read/write capacity units - **FREE**
- ✅ **S3**: 5GB storage + 20,000 GET requests + 2,000 PUT requests - **FREE**
- ✅ **Cognito**: 50,000 monthly active users - **FREE** (always free)
- ✅ **Data Transfer**: 100GB outbound per month - **FREE**
- ⚠️ **Bedrock**: Pay per use (not included in free tier)
- ⚠️ **Load Balancer**: ~$16/month (not included in free tier)

**Note**: t2.micro (1GB RAM) may be sufficient for MVP/testing but consider upgrading to t3.small (2GB RAM) for production workloads.

### AWS Free Tier Benefits (First 12 Months)

- ✅ **EC2**: 750 hours/month of t2.micro (1 vCPU, 1GB RAM) - **FREE**
- ✅ **DynamoDB**: 25GB storage + 25 read/write capacity units - **FREE**
- ✅ **S3**: 5GB storage + 20,000 GET requests + 2,000 PUT requests - **FREE**
- ✅ **Cognito**: 50,000 monthly active users - **FREE** (always free)
- ✅ **Data Transfer**: 100GB outbound per month - **FREE**
- ⚠️ **Bedrock**: Pay per use (not included in free tier)
- ⚠️ **Load Balancer**: ~$16/month (not included in free tier)

**Note**: t2.micro (1GB RAM) may be sufficient for MVP/testing but consider upgrading to t3.small (2GB RAM) for production workloads.

### Important Free Tier Notes

1. **750 hours/month = 1 instance running 24/7** (31 days × 24 hours = 744 hours)
2. **Free tier is valid for 12 months** from AWS account creation date
3. **t2.micro limitations**:
   - 1 vCPU, 1GB RAM
   - Burstable performance (CPU credits)
   - May struggle with high traffic or AI workloads
   - Good for: MVP, testing, low-traffic applications
4. **After free tier expires**: Consider t3.small ($15/month) or t3.medium ($30/month)

### Step 1: Launch EC2 Instance (Free Tier)

1. Go to AWS Console → EC2
2. Click **"Launch Instance"**
3. Configure:
   - **Name**: `ai-diet-api-server`
   - **AMI**: Amazon Linux 2023 or Ubuntu 22.04
   - **Instance Type**: 
     - **t2.micro** (1 vCPU, 1GB RAM) - **FREE TIER** (first 12 months)
     - **t3.small** (2 vCPU, 2GB RAM) - Recommended for production (~$15/month)
     - **t3.medium** (2 vCPU, 4GB RAM) - For higher traffic (~$30/month)
   - **Key Pair**: Create or select existing
   - **Security Group**: 
     - Allow SSH (22) from your IP
     - Allow HTTP (80) from anywhere
     - Allow HTTPS (443) from anywhere
     - Allow Custom TCP (3000) from anywhere (temporary, will use Nginx later)

### Step 2: Connect to Instance

```bash
# SSH into instance
ssh -i your-key.pem ec2-user@<instance-public-ip>

# Or for Ubuntu
ssh -i your-key.pem ubuntu@<instance-public-ip>
```

### Step 3: Install Docker

**Amazon Linux 2023:**
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user
```

**Ubuntu:**
```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ubuntu
```

Log out and back in for group changes to take effect.

### Step 4: Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### Step 5: Clone Repository

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo/local-server
```

### Step 6: Create Environment File

```bash
nano .env
```

Add all environment variables (same as Render list above).

### Step 7: Build and Run with Docker

**Option A: Docker Compose (Recommended)**
```bash
docker-compose up -d
docker-compose logs -f
```

**Option B: Docker Run**
```bash
# Build image
docker build -t ai-diet-api:latest .

# Run container
docker run -d \
  --name ai-diet-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  ai-diet-api:latest

# View logs
docker logs -f ai-diet-api
```

### Step 8: Set Up Nginx Reverse Proxy

```bash
# Install Nginx
sudo yum install -y nginx  # Amazon Linux
# OR
sudo apt install -y nginx  # Ubuntu

# Create Nginx config
sudo nano /etc/nginx/conf.d/ai-diet-api.conf
```

Add this configuration:

```nginx
upstream api_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/api_access.log;
    error_log /var/log/nginx/api_error.log;

    # Health check endpoint
    location /health {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    # API endpoints
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req zone=api_limit burst=20 nodelay;
}
```

Start Nginx:
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### Step 9: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx  # Amazon Linux
# OR
sudo apt install -y certbot python3-certbot-nginx  # Ubuntu

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
sudo certbot renew --dry-run
```

### Step 10: Set Up Application Load Balancer (Optional)

For high availability and auto-scaling:

1. Create Target Group:
   - Target type: Instance
   - Protocol: HTTP
   - Port: 3000
   - Health check: `/health`

2. Create Application Load Balancer:
   - Scheme: Internet-facing
   - Listeners: HTTP (80), HTTPS (443)
   - Availability Zones: Select 2+
   - Security Group: Allow 80, 443

3. Create Auto Scaling Group:
   - Launch Template: Use your EC2 instance as template
   - Min: 2, Max: 10, Desired: 2
   - Target Tracking: CPU 70%

### Step 11: Set Up CloudWatch Monitoring

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json
```

### EC2-Specific Notes

- **Elastic IP**: Assign static IP for consistent access
- **Backups**: Create AMI snapshots regularly
- **Security**: Use AWS Systems Manager Session Manager instead of SSH
- **Scaling**: Use Auto Scaling Groups for horizontal scaling
- **Monitoring**: Set up CloudWatch alarms for CPU, memory, disk

---

## Post-Deployment Steps

### 1. Verify Deployment

```bash
# Test health endpoint
curl https://your-domain.com/health

# Expected response:
# {"status":"healthy","timestamp":"2026-05-02T...","uptime":123.45}
```

### 2. Test API Endpoints

```bash
# Register user
curl -X POST https://your-domain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","age":30,"weight_kg":70,"height_cm":170,"diabetes_type":"type2"}'

# Login
curl -X POST https://your-domain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

### 3. Configure Frontend

Update frontend `.env` with production API URL:

```env
REACT_APP_API_URL=https://your-domain.com
```

### 4. Set Up Monitoring

**CloudWatch Alarms:**
- CPU Utilization > 80%
- Memory Utilization > 85%
- HTTP 5xx errors > 10/minute
- Response time > 2 seconds

**Log Aggregation:**
- Send application logs to CloudWatch Logs
- Set up log retention (30 days recommended)
- Create metric filters for errors

### 5. Set Up Backups

**Database Backups:**
- Enable DynamoDB Point-in-Time Recovery
- Set up daily backups

**Application Backups:**
- Create AMI snapshots (EC2)
- Enable automatic backups (Render/Railway)

### 6. Configure CI/CD

**GitHub Actions Example:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST https://api.render.com/v1/services/$SERVICE_ID/deploys \
            -H "Authorization: Bearer $RENDER_API_KEY"
```

---

## Monitoring & Maintenance

### Health Checks

Monitor these endpoints:
- `/health` - Server health
- CloudWatch metrics
- Application logs

### Performance Monitoring

**Key Metrics:**
- Response time (target: <1s for non-AI, <10s for AI)
- Error rate (target: <1%)
- CPU usage (target: <70%)
- Memory usage (target: <80%)
- Request rate

### Log Monitoring

**Important Logs:**
- Application errors
- Authentication failures
- API rate limit hits
- AWS service errors

### Scaling Triggers

Scale up when:
- CPU > 70% for 5 minutes
- Memory > 80% for 5 minutes
- Response time > 2 seconds
- Request queue > 100

### Maintenance Tasks

**Daily:**
- Check error logs
- Monitor response times
- Verify health checks

**Weekly:**
- Review CloudWatch metrics
- Check disk space (EC2)
- Update dependencies

**Monthly:**
- Security patches
- Cost optimization review
- Performance optimization
- Backup verification

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs ai-diet-api

# Common issues:
# - Missing environment variables
# - Port already in use
# - Insufficient memory
```

### High Memory Usage

```bash
# Check PM2 status
docker exec ai-diet-api pm2 status

# Restart PM2
docker exec ai-diet-api pm2 restart all
```

### Slow Response Times

1. Check CloudWatch metrics
2. Review application logs
3. Check AWS service status
4. Consider scaling up

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

---

## Cost Estimates

### Render.com
- Starter: $7/month
- Standard: $25/month
- Pro: $85/month

### Railway.app
- Base: $5/month
- Usage: ~$5-10/month
- Total: ~$10-15/month

### AWS EC2
- **Free Tier (First 12 months)**: t2.micro (750 hours/month) - **FREE**
- t3.small: ~$15/month (after free tier or if you need more power)
- t3.medium: ~$30/month
- Load Balancer: ~$16/month (not included in free tier)
- Data Transfer: First 100GB free, then ~$0.09/GB
- **Total with Free Tier**: ~$0-16/month (first 12 months)
- **Total after Free Tier**: ~$36-56/month

### AWS Services (All Options)
- **DynamoDB**: First 25GB free, then ~$5-10/month
- **S3**: First 5GB free, then ~$2-5/month
- **Cognito**: Free tier (50,000 MAU) - **FREE**
- **Bedrock**: Pay per use (~$10-50/month depending on usage)
- **Total AWS Services**: ~$0-15/month (with free tier), ~$17-65/month (after)

**Grand Total (First 12 Months with AWS Free Tier):**
- Render: $7-25/month (Render) + $0-15/month (AWS) = **$7-40/month**
- Railway: $10-15/month (Railway) + $0-15/month (AWS) = **$10-30/month**
- EC2: $0/month (EC2 free tier) + $0-15/month (AWS) = **$0-15/month** ⭐ Best value!

**Grand Total (After Free Tier Expires):**
- Render: $24-90/month
- Railway: $27-80/month
- EC2: $53-121/month

---

## Next Steps

1. Choose deployment platform
2. Follow deployment steps
3. Configure monitoring
4. Set up CI/CD
5. Test thoroughly
6. Monitor and optimize

For questions or issues, refer to:
- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2)
