# 🔑 AWS Credentials & Environment Variables Guide

## Your Question

You asked for these environment variables with actual values:

```bash
NODE_ENV=production
PORT=3000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your_aws_access_key>
AWS_SECRET_ACCESS_KEY=<your_aws_secret_key>
COGNITO_USER_POOL_ID=<your_cognito_pool_id>
COGNITO_CLIENT_ID=<your_cognito_client_id>
DYNAMODB_USERS_TABLE=Users
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings
DYNAMODB_FOOD_TABLE=FoodLogs
DYNAMODB_USAGE_TABLE=UsageTracking
DYNAMODB_ACTIVITY_TABLE=ActivityLogs
DYNAMODB_AI_INSIGHTS_TABLE=AIInsights
S3_FOOD_IMAGES_BUCKET=<your_s3_bucket_name>
S3_REPORTS_BUCKET=<your_s3_bucket_name>
S3_GLUCOSE_FILES_BUCKET=<your_s3_bucket_name>
```

## Current Status

### ✅ What We Found

**Your AWS Account**:
- **Account ID**: 407902217908
- **IAM User**: kiro-agent (configured and working)
- **Region**: ap-south-1 (Asia Pacific - Mumbai)
- **AWS CLI**: Configured ✅

### ❌ What's Missing

**AWS Resources** (not yet deployed):
- ❌ Cognito User Pool (no User Pool ID yet)
- ❌ Cognito App Client (no Client ID yet)
- ❌ DynamoDB Tables (not created yet)
- ❌ S3 Buckets (not created yet)

**Why?** The AWS infrastructure hasn't been deployed yet. Your backend code is ready, but the AWS services it depends on don't exist yet.

---

## The Answer: You Need to Deploy AWS Infrastructure First

### Backend Architecture Clarification

Your backend is **Express.js** (NOT Lambda serverless), which means:

✅ **Compatible with Render.com** - No code changes needed
✅ **Can run on any platform** - Render, Railway, AWS EC2, etc.
✅ **Uses AWS services** - Cognito, DynamoDB, S3, Bedrock
✅ **Already has Dockerfile** - Ready for deployment

**The backend code is ready. The AWS services are not.**

---

## How to Get Your Actual Credentials

You have **two options**:

### Option 1: Automated Deployment with CDK (Recommended) ⭐

This will create everything automatically and give you all the values:

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Bootstrap CDK (first time only)
npx cdk bootstrap --region ap-south-1

# 3. Deploy all AWS infrastructure
npx cdk deploy --all --region ap-south-1

# 4. Save outputs to file
npx cdk deploy --all --region ap-south-1 --outputs-file cdk-outputs.json
```

**What gets created**:
- ✅ Cognito User Pool + App Client → gives you User Pool ID and Client ID
- ✅ 10 DynamoDB tables → gives you table names
- ✅ 3 S3 buckets → gives you bucket names
- ✅ KMS encryption keys
- ✅ IAM roles and policies

**Time**: 10-15 minutes

**After deployment**, you'll have a `cdk-outputs.json` file with all values:

```json
{
  "dev-auth": {
    "UserPoolId": "ap-south-1_XXXXXXXXX",
    "UserPoolClientId": "XXXXXXXXXXXXXXXXXXXXXXXXXX"
  },
  "dev-storage": {
    "FoodImagesBucketName": "dev-ai-diet-food-images",
    "ReportsBucketName": "dev-ai-diet-reports",
    "GlucoseUploadsBucketName": "dev-ai-diet-glucose-uploads"
  },
  "dev-data": {
    "UsersTableName": "dev-ai-diet-users",
    "GlucoseReadingsTableName": "dev-ai-diet-glucose-readings",
    "FoodLogsTableName": "dev-ai-diet-food-logs",
    "UsageTrackingTableName": "dev-ai-diet-usage-tracking",
    "ActivityLogsTableName": "dev-ai-diet-activity-logs",
    "AIInsightsTableName": "dev-ai-diet-ai-insights"
  }
}
```

Then your environment variables would be:

```bash
NODE_ENV=production
PORT=3000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<from kiro-agent IAM user>
AWS_SECRET_ACCESS_KEY=<from kiro-agent IAM user>
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX  # from cdk-outputs.json
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX  # from cdk-outputs.json
DYNAMODB_USERS_TABLE=dev-ai-diet-users  # from cdk-outputs.json
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings  # from cdk-outputs.json
DYNAMODB_FOOD_TABLE=dev-ai-diet-food-logs  # from cdk-outputs.json
DYNAMODB_USAGE_TABLE=dev-ai-diet-usage-tracking  # from cdk-outputs.json
DYNAMODB_ACTIVITY_TABLE=dev-ai-diet-activity-logs  # from cdk-outputs.json
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-ai-insights  # from cdk-outputs.json
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images  # from cdk-outputs.json
S3_REPORTS_BUCKET=dev-ai-diet-reports  # from cdk-outputs.json
S3_GLUCOSE_FILES_BUCKET=dev-ai-diet-glucose-uploads  # from cdk-outputs.json
```

### Option 2: Manual Setup via AWS Console

If you prefer to create resources manually:

#### Step 1: Create Cognito User Pool

1. Go to **AWS Console** → **Cognito** → **User Pools**
2. Click **"Create user pool"**
3. Configure:
   - Sign-in: Email
   - Password: 12+ chars, uppercase, lowercase, numbers, symbols
   - Self-registration: Enabled
   - User pool name: `ai-diet-users`
   - App client name: `ai-diet-web-client` (no secret)
4. After creation, copy:
   - **User Pool ID**: `ap-south-1_XXXXXXXXX`
   - **App Client ID**: `XXXXXXXXXXXXXXXXXXXXXXXXXX`

#### Step 2: Create DynamoDB Tables

Create these tables in **ap-south-1** with **On-demand** billing:

1. **Users** (Partition: user_id)
2. **GlucoseReadings** (Partition: user_id, Sort: timestamp)
3. **FoodLogs** (Partition: user_id, Sort: timestamp)
4. **UsageTracking** (Partition: user_id, Sort: month)
5. **ActivityLogs** (Partition: user_id, Sort: timestamp)
6. **AIInsights** (Partition: userId, Sort: insightId)

Table names will be exactly as you create them (e.g., "Users", "GlucoseReadings", etc.)

#### Step 3: Create S3 Buckets

Create these buckets in **ap-south-1**:

1. `ai-diet-food-images-{random}` (e.g., `ai-diet-food-images-abc123`)
2. `ai-diet-reports-{random}` (e.g., `ai-diet-reports-abc123`)
3. `ai-diet-glucose-uploads-{random}` (e.g., `ai-diet-glucose-uploads-abc123`)

Bucket names must be globally unique, so add random suffix.

#### Step 4: Get AWS Credentials

You already have the `kiro-agent` IAM user. To get credentials:

**Option A: Use existing kiro-agent credentials**
- If you have the Access Key ID and Secret Access Key for `kiro-agent`, use those
- Check your AWS CLI configuration: `cat ~/.aws/credentials`

**Option B: Create new access key for kiro-agent**
1. Go to **IAM** → **Users** → **kiro-agent**
2. Go to **Security credentials** tab
3. Click **"Create access key"**
4. Choose **"Application running outside AWS"**
5. Copy Access Key ID and Secret Access Key

**Option C: Create new IAM user**
1. Go to **IAM** → **Users** → **Create user**
2. User name: `ai-diet-backend-user`
3. Attach policies:
   - `AmazonCognitoPowerUser`
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonBedrockFullAccess`
4. Create access key
5. Copy Access Key ID and Secret Access Key

---

## Complete Environment Variables Template

After deploying AWS infrastructure (Option 1 or 2), your complete `.env` will look like:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...  # From IAM user
AWS_SECRET_ACCESS_KEY=...  # From IAM user (keep secret!)

# Cognito Configuration (from AWS Console or cdk-outputs.json)
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX

# DynamoDB Tables (from AWS Console or cdk-outputs.json)
DYNAMODB_USERS_TABLE=Users  # or dev-ai-diet-users if using CDK
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings  # or dev-ai-diet-glucose-readings
DYNAMODB_FOOD_TABLE=FoodLogs  # or dev-ai-diet-food-logs
DYNAMODB_USAGE_TABLE=UsageTracking  # or dev-ai-diet-usage-tracking
DYNAMODB_ACTIVITY_TABLE=ActivityLogs  # or dev-ai-diet-activity-logs
DYNAMODB_AI_INSIGHTS_TABLE=AIInsights  # or dev-ai-diet-ai-insights

# S3 Buckets (from AWS Console or cdk-outputs.json)
S3_FOOD_IMAGES_BUCKET=ai-diet-food-images-abc123  # Your actual bucket name
S3_REPORTS_BUCKET=ai-diet-reports-abc123  # Your actual bucket name
S3_GLUCOSE_FILES_BUCKET=ai-diet-glucose-uploads-abc123  # Your actual bucket name
```

---

## Render.com Compatibility

### Your Question: "Can these functions run in Render?"

**Answer: YES! 100% Compatible** ✅

Your backend was **originally designed for Express.js**, not Lambda serverless. Here's why it works perfectly on Render:

#### Backend Architecture
- ✅ **Express.js server** (`local-server/server.js`)
- ✅ **PM2 process manager** (configured in Dockerfile)
- ✅ **Docker containerization** (Dockerfile ready)
- ✅ **Health check endpoint** (`/health`)
- ✅ **Environment variables** (standard approach)

#### What Render Provides
- ✅ **Docker support** - Uses your Dockerfile
- ✅ **Environment variables** - Easy to configure
- ✅ **Automatic SSL** - HTTPS out of the box
- ✅ **Auto-deploy** - From GitHub
- ✅ **FREE tier** - 750 hours/month

#### No Code Changes Needed
Your backend code is already compatible. You just need to:
1. Deploy AWS infrastructure (get credentials)
2. Configure environment variables in Render
3. Deploy!

---

## Step-by-Step: Get Your Credentials Now

### Quick Start (Recommended)

```bash
# 1. Deploy AWS infrastructure with CDK
npm install
npx cdk bootstrap --region ap-south-1
npx cdk deploy --all --region ap-south-1 --outputs-file cdk-outputs.json

# 2. Extract credentials
cat cdk-outputs.json

# 3. Get AWS access keys
# Option A: Check existing credentials
cat ~/.aws/credentials

# Option B: Create new access key for kiro-agent
# Go to AWS Console → IAM → Users → kiro-agent → Security credentials → Create access key

# 4. Create .env file for Render
cat > render.env << 'EOF'
NODE_ENV=production
PORT=3000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<paste from step 3>
AWS_SECRET_ACCESS_KEY=<paste from step 3>
COGNITO_USER_POOL_ID=<paste from cdk-outputs.json>
COGNITO_CLIENT_ID=<paste from cdk-outputs.json>
DYNAMODB_USERS_TABLE=<paste from cdk-outputs.json>
DYNAMODB_GLUCOSE_TABLE=<paste from cdk-outputs.json>
DYNAMODB_FOOD_TABLE=<paste from cdk-outputs.json>
DYNAMODB_USAGE_TABLE=<paste from cdk-outputs.json>
DYNAMODB_ACTIVITY_TABLE=<paste from cdk-outputs.json>
DYNAMODB_AI_INSIGHTS_TABLE=<paste from cdk-outputs.json>
S3_FOOD_IMAGES_BUCKET=<paste from cdk-outputs.json>
S3_REPORTS_BUCKET=<paste from cdk-outputs.json>
S3_GLUCOSE_FILES_BUCKET=<paste from cdk-outputs.json>
EOF

# 5. Copy this file to Render dashboard when deploying
```

---

## Cost Summary

### AWS Infrastructure (Required)

| Service | Free Tier (12 months) | After Free Tier |
|---------|----------------------|-----------------|
| Cognito | 50,000 MAU (always free) | $0 |
| DynamoDB | 25GB storage | $5-10/month |
| S3 | 5GB storage | $2-5/month |
| Bedrock | Pay per use | $10-50/month |
| **Total** | **$10-15/month** | **$17-65/month** |

### Render.com Hosting

| Plan | Cost | Cold Starts |
|------|------|-------------|
| **Free** | **$0/month** | Yes (15 min) |
| Starter | $7/month | No |
| Standard | $25/month | No |

### Grand Total

**First 12 months**: $10-15/month (AWS Free Tier + Render Free)
**After free tier**: $17-65/month (depending on usage)

---

## Next Steps

1. **Choose deployment method**:
   - Option 1: CDK (automated) ← Recommended
   - Option 2: Manual (AWS Console)

2. **Deploy AWS infrastructure**:
   ```bash
   npx cdk deploy --all --region ap-south-1 --outputs-file cdk-outputs.json
   ```

3. **Get credentials**:
   - From `cdk-outputs.json`
   - From AWS CLI: `cat ~/.aws/credentials`

4. **Deploy to Render**:
   - Create web service
   - Add environment variables
   - Deploy!

5. **Test**:
   ```bash
   curl https://ai-diet-api.onrender.com/health
   ```

---

## Summary

### What You Asked For
✅ Environment variables with actual values

### What You Need to Do First
1. Deploy AWS infrastructure (CDK or manual)
2. Get actual resource IDs (User Pool ID, bucket names, etc.)
3. Get AWS access keys (from kiro-agent or new user)

### Why You Can't Get Values Yet
- AWS resources don't exist yet
- Need to create them first
- Then you'll have all the values

### Backend Compatibility
✅ Your Express.js backend is 100% compatible with Render.com
✅ No code changes needed
✅ Just need AWS credentials

---

## Quick Commands

```bash
# Deploy AWS infrastructure
npx cdk deploy --all --region ap-south-1 --outputs-file cdk-outputs.json

# View outputs
cat cdk-outputs.json

# Check AWS credentials
cat ~/.aws/credentials

# Test locally
cd local-server
docker build -t test .
docker run -p 3000:3000 --env-file .env test
curl http://localhost:3000/health
```

---

**Ready to deploy? Start with AWS infrastructure deployment!** 🚀

For detailed guides, see:
- `RENDER_DEPLOYMENT_WITH_AWS_SETUP.md` - Complete deployment guide
- `local-server/DEPLOYMENT_GUIDE.md` - Detailed deployment options
- `AWS_FREE_TIER_DEPLOYMENT.md` - AWS Free Tier guide
