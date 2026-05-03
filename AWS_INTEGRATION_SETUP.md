# AWS Integration Setup Guide

## Overview

This guide will help you integrate real AWS services (DynamoDB, S3, Cognito, Bedrock) into the backend, replacing the current mock data implementation.

---

## Prerequisites

✅ AWS Account: 407902217908  
✅ IAM User: kiro-agent  
✅ AWS Resources: Deployed via CDK (see `cdk-outputs.json`)  
✅ Region: us-east-1

---

## Step 1: Get AWS Credentials

You need to obtain AWS Access Keys for the `kiro-agent` IAM user.

### Option A: If you have AWS Console access

1. Go to AWS Console → IAM → Users → kiro-agent
2. Click "Security credentials" tab
3. Click "Create access key"
4. Choose "Application running outside AWS"
5. Copy the Access Key ID and Secret Access Key
6. **Save them securely** - you won't be able to see the secret again!

### Option B: If you have AWS CLI configured

```bash
# Check if credentials exist
aws configure list

# If configured, credentials are in:
cat ~/.aws/credentials
```

---

## Step 2: Install Dependencies

```bash
cd local-server
npm install
```

This will install:
- `@aws-sdk/client-dynamodb` - DynamoDB operations
- `@aws-sdk/client-s3` - S3 file storage
- `@aws-sdk/client-cognito-identity-provider` - User authentication
- `@aws-sdk/client-bedrock-runtime` - AI features
- `@aws-sdk/client-rekognition` - Image recognition
- `aws-jwt-verify` - JWT token verification
- `dotenv` - Environment variable management

---

## Step 3: Configure Environment Variables

Create `local-server/.env` file (copy from `.env.example`):

```bash
cd local-server
cp .env.example .env
```

Edit `.env` and add your AWS credentials:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...  # <-- Paste your Access Key ID here
AWS_SECRET_ACCESS_KEY=...  # <-- Paste your Secret Access Key here

# Cognito (already configured from cdk-outputs.json)
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi

# DynamoDB Tables (already configured)
DYNAMODB_USERS_TABLE=dev-ai-diet-users
DYNAMODB_USER_PROFILES_TABLE=dev-ai-diet-user-profiles
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings
DYNAMODB_FOOD_LOGS_TABLE=dev-ai-diet-food-logs
DYNAMODB_USAGE_TRACKING_TABLE=dev-ai-diet-usage-tracking
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-ai-insights
DYNAMODB_PREDICTIONS_TABLE=dev-ai-diet-predictions
DYNAMODB_ACTIVITY_LOGS_TABLE=dev-ai-diet-activity-logs
DYNAMODB_PROVIDER_ACCESS_TABLE=dev-ai-diet-provider-access
DYNAMODB_AUDIT_LOGS_TABLE=dev-ai-diet-audit-logs

# S3 Buckets (already configured)
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images
S3_REPORTS_BUCKET=dev-ai-diet-reports
S3_GLUCOSE_UPLOADS_BUCKET=dev-ai-diet-glucose-uploads

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1

# Feature Flags
USE_MOCK_DATA=false
ENABLE_AWS_SERVICES=true
```

---

## Step 4: Verify AWS Connection

Test if AWS services are accessible:

```bash
# Test DynamoDB connection
node -e "
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });
client.send(new ListTablesCommand({}))
  .then(data => console.log('✅ DynamoDB tables:', data.TableNames))
  .catch(err => console.error('❌ DynamoDB error:', err.message));
"

# Test S3 connection
node -e "
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({ region: 'us-east-1' });
client.send(new ListBucketsCommand({}))
  .then(data => console.log('✅ S3 buckets:', data.Buckets.map(b => b.Name)))
  .catch(err => console.error('❌ S3 error:', err.message));
"
```

---

## Step 5: Update Render Environment Variables

Add AWS credentials to Render.com:

1. Go to https://dashboard.render.com/
2. Select your `ai-diet-api` service
3. Go to "Environment" tab
4. Add these variables:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi
DYNAMODB_USERS_TABLE=dev-ai-diet-users
DYNAMODB_USER_PROFILES_TABLE=dev-ai-diet-user-profiles
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings
DYNAMODB_FOOD_LOGS_TABLE=dev-ai-diet-food-logs
DYNAMODB_USAGE_TRACKING_TABLE=dev-ai-diet-usage-tracking
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-ai-insights
DYNAMODB_PREDICTIONS_TABLE=dev-ai-diet-predictions
DYNAMODB_ACTIVITY_LOGS_TABLE=dev-ai-diet-activity-logs
DYNAMODB_PROVIDER_ACCESS_TABLE=dev-ai-diet-provider-access
DYNAMODB_AUDIT_LOGS_TABLE=dev-ai-diet-audit-logs
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images
S3_REPORTS_BUCKET=dev-ai-diet-reports
S3_GLUCOSE_UPLOADS_BUCKET=dev-ai-diet-glucose-uploads
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1
USE_MOCK_DATA=false
ENABLE_AWS_SERVICES=true
```

5. Click "Save Changes"
6. Render will automatically redeploy

---

## Step 6: Test Local Server

```bash
cd local-server
npm start
```

Check the console output:
- ✅ Should see: "AWS SDK configured for region: us-east-1"
- ✅ Should see: "AWS credentials: Configured"
- ❌ If you see "Not configured (using mock mode)" - check your .env file

---

## Step 7: Verify Endpoints

Test each endpoint to ensure AWS integration works:

### Test Authentication (Cognito)
```bash
# Register a new user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "age": 30,
    "weight_kg": 70,
    "height_cm": 170,
    "diabetes_type": "type2"
  }'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Test Glucose Logging (DynamoDB)
```bash
# Add glucose reading (use token from login)
curl -X POST http://localhost:3001/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "reading_value": 120,
    "reading_unit": "mg/dL",
    "timestamp": "2026-05-03T10:00:00Z"
  }'

# Get glucose readings
curl -X GET "http://localhost:3001/glucose/readings" \
  -H "Authorization: Bearer <your-token>"
```

### Test Dashboard (DynamoDB Query)
```bash
curl -X GET "http://localhost:3001/analytics/dashboard" \
  -H "Authorization: Bearer <your-token>"
```

---

## Step 8: Deploy to Render

Once local testing works:

```bash
git add .
git commit -m "Integrate AWS services (DynamoDB, S3, Cognito, Bedrock)"
git push origin main
```

Render will automatically deploy. Monitor at: https://dashboard.render.com/

---

## Troubleshooting

### Error: "AWS credentials not configured"
- Check `.env` file exists in `local-server/` directory
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Ensure no extra spaces or quotes around values

### Error: "AccessDeniedException"
- IAM user `kiro-agent` needs permissions for DynamoDB, S3, Cognito, Bedrock
- Check IAM policies attached to the user

### Error: "ResourceNotFoundException"
- Table/bucket name might be wrong
- Verify names in `cdk-outputs.json` match `.env` file
- Ensure resources are deployed in `us-east-1` region

### Error: "ValidationException: Invalid region"
- Bedrock is only available in specific regions
- Ensure `BEDROCK_REGION=us-east-1`

---

## Next Steps

After AWS integration is working:

1. ✅ **Phase 2**: Replace all mock data with real AWS calls
2. ✅ **Phase 3**: Add missing GET endpoints
3. ✅ **Phase 4**: Write integration tests
4. ✅ **Phase 5**: Deploy to production

---

## Files Created

- ✅ `local-server/src/config/aws.ts` - AWS SDK clients
- ✅ `local-server/src/config/index.ts` - Configuration loader
- ✅ `local-server/.env.example` - Environment template
- ✅ `local-server/package.json` - Updated with AWS SDK dependencies

## Files to Update Next

- 🔄 `local-server/server.js` - Replace mock data with AWS calls
- 🔄 Add repositories for DynamoDB operations
- 🔄 Add services for business logic
- 🔄 Add missing GET endpoints

---

## Support

If you encounter issues:
1. Check Render logs: https://dashboard.render.com/
2. Check AWS CloudWatch logs
3. Verify IAM permissions
4. Test AWS CLI access: `aws sts get-caller-identity`

