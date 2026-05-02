# 🚀 Complete Deployment Guide: Render + AWS

## Overview

This guide shows you how to:
1. **Set up AWS services** (Cognito, DynamoDB, S3) - Required for backend
2. **Deploy Express.js backend to Render.com** - FREE tier available
3. **Get actual AWS credentials** for Render deployment

---

## 📋 Current Status

Based on your AWS account (`407902217908`), here's what we found:

### ✅ AWS Account Configured
- **Account ID**: 407902217908
- **IAM User**: kiro-agent
- **Region**: ap-south-1 (Asia Pacific - Mumbai)
- **AWS CLI**: Configured and working

### ❌ AWS Resources Not Yet Deployed
- **Cognito User Pool**: Not created
- **DynamoDB Tables**: Not created
- **S3 Buckets**: Not created
- **CloudFormation Stacks**: Not deployed

**Action Required**: Deploy AWS infrastructure first, then deploy backend to Render.

---

## 🎯 Two-Phase Deployment

### Phase 1: Deploy AWS Infrastructure (One-time setup)
### Phase 2: Deploy Backend to Render.com (FREE tier)

---

## Phase 1: Deploy AWS Infrastructure

You have two options:

### Option A: Automated Deployment with CDK (Recommended) ⭐

This will create all AWS resources automatically:

```bash
# 1. Install dependencies
npm install

# 2. Bootstrap CDK (first time only)
npx cdk bootstrap --region ap-south-1

# 3. Deploy all stacks
npx cdk deploy --all --region ap-south-1

# 4. Save outputs to file
npx cdk deploy --all --region ap-south-1 --outputs-file cdk-outputs.json
```

**What gets created**:
- ✅ Cognito User Pool + App Client
- ✅ 10 DynamoDB tables (Users, GlucoseReadings, FoodLogs, etc.)
- ✅ 3 S3 buckets (food-images, reports, glucose-uploads)
- ✅ KMS encryption keys
- ✅ IAM roles and policies

**Time**: ~10-15 minutes

**Cost**: 
- **First 12 months**: $0-15/month (AWS Free Tier)
- **After free tier**: $17-65/month

After deployment, the `cdk-outputs.json` file will contain all the values you need for Render.

### Option B: Manual Setup via AWS Console

If you prefer manual setup, follow these steps:

#### 1. Create Cognito User Pool

1. Go to **AWS Console** → **Cognito** → **User Pools**
2. Click **"Create user pool"**
3. Configure sign-in:
   - **Sign-in options**: Email
   - **User name requirements**: Allow email
4. Configure security:
   - **Password policy**: 
     - Minimum length: 12 characters
     - Require: uppercase, lowercase, numbers, symbols
   - **MFA**: Optional (recommended for production)
5. Configure sign-up:
   - **Self-registration**: Enabled
   - **Email verification**: Required
6. Configure message delivery:
   - **Email provider**: Cognito (default)
7. Integrate your app:
   - **User pool name**: `ai-diet-users`
   - **App client name**: `ai-diet-web-client`
   - **Client secret**: Don't generate
8. Review and create

**Save these values**:
- User Pool ID (e.g., `ap-south-1_XXXXXXXXX`)
- App Client ID (e.g., `XXXXXXXXXXXXXXXXXXXXXXXXXX`)

#### 2. Create DynamoDB Tables

Create these tables in **ap-south-1** region with **On-demand** billing:

| Table Name | Partition Key | Sort Key | GSI |
|------------|---------------|----------|-----|
| **Users** | user_id (String) | - | - |
| **GlucoseReadings** | user_id (String) | timestamp (String) | DateIndex (user_id, date) |
| **FoodLogs** | user_id (String) | timestamp (String) | DateIndex (user_id, date) |
| **UsageTracking** | user_id (String) | month (String) | - |
| **ActivityLogs** | user_id (String) | timestamp (String) | - |
| **AIInsights** | userId (String) | insightId (String) | CreatedAtIndex (userId, createdAt) |

**For each table**:
1. Go to **DynamoDB** → **Tables** → **Create table**
2. Enter table name and keys
3. **Table settings**: On-demand
4. **Encryption**: AWS owned key (free)
5. Create table
6. Add GSI if specified (after table creation)

#### 3. Create S3 Buckets

Create these buckets in **ap-south-1** region:

1. **ai-diet-food-images-{random}**
   - Purpose: Store food images
   - Versioning: Enabled
   - Encryption: AES-256
   - Block public access: Yes

2. **ai-diet-reports-{random}**
   - Purpose: Store generated reports
   - Versioning: Enabled
   - Encryption: AES-256
   - Block public access: Yes

3. **ai-diet-glucose-uploads-{random}**
   - Purpose: Store glucose file uploads
   - Versioning: Disabled
   - Encryption: AES-256
   - Block public access: Yes
   - Lifecycle rule: Delete after 30 days

**For each bucket**:
1. Go to **S3** → **Buckets** → **Create bucket**
2. Enter bucket name (must be globally unique)
3. **Region**: ap-south-1
4. **Block Public Access**: Enable all
5. **Versioning**: Enable (except glucose-uploads)
6. **Encryption**: Server-side encryption (SSE-S3)
7. Create bucket

#### 4. Create IAM User for Backend

1. Go to **IAM** → **Users** → **Create user**
2. **User name**: `ai-diet-backend-user`
3. **Access type**: Programmatic access
4. **Permissions**: Attach policies directly
   - `AmazonCognitoPowerUser`
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonBedrockFullAccess`
5. Create user
6. **Download credentials CSV** or copy:
   - Access Key ID
   - Secret Access Key

**⚠️ IMPORTANT**: Save these credentials securely. You won't be able to see the secret key again.

---

## Phase 2: Deploy Backend to Render.com

### Why Render.com?

✅ **FREE tier available** (750 hours/month)
✅ **No credit card required** for free tier
✅ **Automatic SSL** certificates
✅ **Auto-deploy** from GitHub
✅ **100% compatible** with Express.js backend
✅ **Easy setup** (5 minutes)

**Limitations of FREE tier**:
- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- 512MB RAM
- Shared CPU

**Perfect for**: MVP, testing, demos, low-traffic applications

### Step 1: Prepare Environment Variables

Based on your AWS setup, gather these values:

#### From AWS (Phase 1)

**If you used CDK**:
```bash
# Read outputs from cdk-outputs.json
cat cdk-outputs.json
```

**If you used manual setup**:
- Copy values from AWS Console

#### Environment Variables Template

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<from IAM user>
AWS_SECRET_ACCESS_KEY=<from IAM user>

# Cognito Configuration
COGNITO_USER_POOL_ID=<from Cognito console>
COGNITO_CLIENT_ID=<from Cognito app client>

# DynamoDB Tables
DYNAMODB_USERS_TABLE=Users
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings
DYNAMODB_FOOD_TABLE=FoodLogs
DYNAMODB_USAGE_TABLE=UsageTracking
DYNAMODB_ACTIVITY_TABLE=ActivityLogs
DYNAMODB_AI_INSIGHTS_TABLE=AIInsights

# S3 Buckets
S3_FOOD_IMAGES_BUCKET=<your food images bucket name>
S3_REPORTS_BUCKET=<your reports bucket name>
S3_GLUCOSE_FILES_BUCKET=<your glucose uploads bucket name>
```

### Step 2: Push Code to GitHub

```bash
# Ensure latest code is committed
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 3: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started"**
3. Sign up with **GitHub**
4. Authorize Render to access your repositories

### Step 4: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Select your GitHub repository
3. Configure service:

**Basic Settings**:
- **Name**: `ai-diet-api`
- **Region**: Singapore (closest to ap-south-1)
- **Branch**: `main`
- **Root Directory**: `local-server`

**Build Settings**:
- **Environment**: `Docker`
- **Dockerfile Path**: `Dockerfile` (default)

**Plan**:
- **Instance Type**: `Free` ✅

### Step 5: Configure Environment Variables

In the Render dashboard, go to **Environment** tab and add all variables from Step 1:

**Quick Add Method**:
1. Click **"Add from .env"**
2. Paste all environment variables
3. Click **"Add Variables"**

**Or add individually**:
1. Click **"Add Environment Variable"**
2. Enter key and value
3. Repeat for all variables

### Step 6: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Build Docker image from `local-server/Dockerfile`
   - Deploy container
   - Assign URL: `https://ai-diet-api.onrender.com`
3. Monitor deployment logs in real-time

**Deployment time**: ~5-10 minutes

### Step 7: Verify Deployment

```bash
# Test health endpoint
curl https://ai-diet-api.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-05-02T...",
  "uptime": 123.45,
  "environment": "production"
}
```

### Step 8: Test API Endpoints

```bash
# Register a test user
curl -X POST https://ai-diet-api.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "age": 30,
    "weight_kg": 70,
    "height_cm": 170,
    "diabetes_type": "type2"
  }'

# Login
curl -X POST https://ai-diet-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Save the token from login response
TOKEN="<token_from_login>"

# Get profile
curl https://ai-diet-api.onrender.com/auth/profile \
  -H "Authorization: Bearer $TOKEN"

# Create glucose reading
curl -X POST https://ai-diet-api.onrender.com/glucose/readings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reading_value": 120,
    "timestamp": "2026-05-02T10:00:00Z",
    "meal_context": "before_meal"
  }'

# Get dashboard analytics
curl https://ai-diet-api.onrender.com/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

---

## Phase 3: Configure Frontend

Update `frontend/.env`:

```env
REACT_APP_API_URL=https://ai-diet-api.onrender.com
REACT_APP_USE_MOCK=false
```

Test frontend:
```bash
cd frontend
npm start
```

---

## 💰 Cost Breakdown

### AWS Services (Required for all deployment options)

| Service | Free Tier (12 months) | After Free Tier |
|---------|----------------------|-----------------|
| **Cognito** | 50,000 MAU (always free) | $0 |
| **DynamoDB** | 25GB storage | $5-10/month |
| **S3** | 5GB storage | $2-5/month |
| **Bedrock (AI)** | Pay per use | $10-50/month |
| **Data Transfer** | 100GB/month | $5-10/month |
| **Total AWS** | **$10-15/month** | **$22-75/month** |

### Render.com Hosting

| Plan | Cost | Features |
|------|------|----------|
| **Free** | **$0/month** | 750 hours, cold starts, 512MB RAM |
| **Starter** | $7/month | No cold starts, 512MB RAM |
| **Standard** | $25/month | No cold starts, 2GB RAM, better CPU |

### Grand Total

| Phase | Render | AWS | Total |
|-------|--------|-----|-------|
| **Months 1-12 (Free Tier)** | $0 | $10-15 | **$10-15/month** ✅ |
| **Months 1-12 (Starter)** | $7 | $10-15 | **$17-22/month** |
| **Month 13+ (Free)** | $0 | $22-75 | **$22-75/month** |
| **Month 13+ (Starter)** | $7 | $22-75 | **$29-82/month** |
| **Month 13+ (Standard)** | $25 | $22-75 | **$47-100/month** |

---

## 🔧 Handling Cold Starts (Free Tier)

### Problem
Free tier services spin down after 15 minutes of inactivity. First request takes ~30 seconds.

### Solutions

#### Option 1: Upgrade to Paid Plan ($7/month)
- No cold starts
- Always-on service
- Better performance

#### Option 2: Keep-Alive Ping (Free)
Use a cron job service to ping your API every 14 minutes:

**Using cron-job.org** (free):
1. Go to [cron-job.org](https://cron-job.org)
2. Create account
3. Create new cron job:
   - **URL**: `https://ai-diet-api.onrender.com/health`
   - **Interval**: Every 14 minutes
   - **Enabled**: Yes

**Using UptimeRobot** (free):
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create account
3. Add new monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://ai-diet-api.onrender.com/health`
   - **Interval**: 5 minutes

#### Option 3: Accept Cold Starts
- Good for: MVP, demos, testing
- Not good for: Production, user-facing apps

---

## 🎯 Deployment Checklist

### Phase 1: AWS Infrastructure
- [ ] AWS account configured (Account: 407902217908)
- [ ] Choose deployment method (CDK or Manual)
- [ ] Deploy Cognito User Pool
- [ ] Deploy DynamoDB tables
- [ ] Deploy S3 buckets
- [ ] Create IAM user with credentials
- [ ] Save all resource IDs and credentials

### Phase 2: Render Deployment
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Web service created
- [ ] Environment variables configured
- [ ] Deployment successful
- [ ] Health check passing
- [ ] API endpoints tested

### Phase 3: Frontend Configuration
- [ ] Frontend .env updated with Render URL
- [ ] Frontend tested locally
- [ ] End-to-end flow tested
- [ ] User registration working
- [ ] Authentication working
- [ ] Data persistence working

---

## 🚨 Troubleshooting

### Issue: CDK Deployment Fails

**Error**: "Need to perform AWS calls for account..."

**Solution**:
```bash
# Bootstrap CDK
npx cdk bootstrap --region ap-south-1

# Try deployment again
npx cdk deploy --all --region ap-south-1
```

### Issue: Render Build Fails

**Error**: "Docker build failed"

**Solution**:
1. Test Docker build locally:
   ```bash
   cd local-server
   docker build -t test .
   ```
2. Check Dockerfile syntax
3. Ensure all dependencies in package.json
4. Check Render build logs for specific error

### Issue: Backend Can't Connect to AWS

**Error**: "Unable to locate credentials"

**Solution**:
1. Verify environment variables in Render dashboard
2. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
3. Ensure IAM user has correct permissions
4. Check AWS region matches (ap-south-1)

### Issue: Cognito Authentication Fails

**Error**: "User pool not found"

**Solution**:
1. Verify COGNITO_USER_POOL_ID is correct
2. Verify COGNITO_CLIENT_ID is correct
3. Check Cognito User Pool exists in ap-south-1
4. Ensure app client has no secret

---

## 📚 Next Steps

### Immediate
1. ✅ Deploy AWS infrastructure (Phase 1)
2. ✅ Deploy backend to Render (Phase 2)
3. ✅ Configure frontend (Phase 3)
4. ✅ Test end-to-end

### Short-term
- [ ] Set up monitoring (CloudWatch, Render metrics)
- [ ] Configure custom domain
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Implement keep-alive ping (if using free tier)

### Long-term
- [ ] Upgrade to paid Render plan (when traffic increases)
- [ ] Implement caching (Redis)
- [ ] Set up staging environment
- [ ] Performance optimization

---

## 🎉 Summary

### What You'll Have After Deployment

✅ **Backend API** running on Render.com (FREE tier)
✅ **AWS services** (Cognito, DynamoDB, S3) in ap-south-1
✅ **10 API endpoints** operational
✅ **2 AI features** (meal recommendations, pattern analysis)
✅ **Automatic SSL** and custom domain support
✅ **Auto-deploy** from GitHub

### Total Cost

**First 12 months**: $10-15/month (AWS Free Tier + Render Free)
**After free tier**: $22-75/month (depending on usage)

### Deployment Time

- **AWS setup**: 10-30 minutes (depending on method)
- **Render deployment**: 5-10 minutes
- **Total**: 15-40 minutes

---

## 📞 Support Resources

- **Render Documentation**: https://render.com/docs
- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk
- **AWS Free Tier**: https://aws.amazon.com/free
- **Project Documentation**: See `local-server/DEPLOYMENT_GUIDE.md`

---

**Ready to deploy? Start with Phase 1!** 🚀
