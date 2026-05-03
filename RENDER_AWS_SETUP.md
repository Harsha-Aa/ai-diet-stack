# Render AWS Environment Variables Setup

## Overview
Your backend now uses real AWS services (Cognito, DynamoDB, S3, Bedrock). You need to add AWS credentials to Render so the deployed backend can access these services.

---

## Step 1: Open Render Dashboard

1. Go to https://dashboard.render.com/
2. Click on your **ai-diet-api** service
3. Click on **Environment** in the left sidebar

---

## Step 2: Add AWS Environment Variables

Click **Add Environment Variable** and add each of these:

### AWS Credentials
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
```

**Note**: Get your actual AWS credentials from the `.env` file in `local-server/.env` or from your AWS IAM console.

### Cognito Configuration
```
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi
```

### DynamoDB Tables
```
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
```

### S3 Buckets
```
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images-407902217908-us-east-1
S3_REPORTS_BUCKET=dev-ai-diet-reports-407902217908-us-east-1
S3_GLUCOSE_UPLOADS_BUCKET=dev-ai-diet-glucose-uploads-407902217908-us-east-1
```

### Bedrock Configuration
```
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1
```

### Feature Flags
```
ENABLE_AWS_SERVICES=true
USE_MOCK_DATA=false
NODE_ENV=production
```

---

## Step 3: Save and Deploy

1. After adding all variables, click **Save Changes**
2. Render will automatically redeploy your service
3. Wait for deployment to complete (2-3 minutes)

---

## Step 4: Verify Deployment

### Check Health Endpoint
```bash
curl https://ai-diet-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-03T...",
  "environment": "production",
  "aws_integration": "enabled"
}
```

### Check Logs
1. In Render dashboard, click **Logs** tab
2. Look for these messages:
   - ✅ AWS SDK configured for region: us-east-1
   - ✅ AWS credentials: Configured
   - ✅ AWS Integration: ENABLED

---

## Step 5: Test Authentication

### Register a New User
```bash
curl -X POST https://ai-diet-api.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "age": 30,
    "weight_kg": 70,
    "height_cm": 170,
    "diabetes_type": "type2"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "test@example.com",
    "subscriptionTier": "free",
    "message": "Registration successful"
  }
}
```

### Login
```bash
curl -X POST https://ai-diet-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "test@example.com",
    "accessToken": "...",
    "refreshToken": "...",
    "idToken": "...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

---

## Step 6: Test Glucose Readings

### Log a Reading
```bash
curl -X POST https://ai-diet-api.onrender.com/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "reading_value": 120,
    "reading_unit": "mg/dL",
    "meal_context": "fasting"
  }'
```

### Get Readings
```bash
curl https://ai-diet-api.onrender.com/glucose/readings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Step 7: Test Dashboard

```bash
curl https://ai-diet-api.onrender.com/analytics/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "ea1c": 5.8,
    "time_in_range": {
      "tir_7d": { "percentage": 75, ... },
      "tir_14d": { ... },
      "tir_30d": { ... }
    },
    "average_glucose": 120,
    "trends": [...],
    ...
  }
}
```

---

## Troubleshooting

### Error: "AWS credentials not configured"
- Check that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set correctly
- Make sure there are no extra spaces in the values

### Error: "Token verification failed"
- Check that COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are correct
- Verify the region is us-east-1

### Error: "Table not found"
- Check that all DYNAMODB_*_TABLE variables are set
- Verify table names match the CDK deployment

### Deployment Failed
- Check Render logs for specific error messages
- Verify all dependencies are in package.json
- Make sure TypeScript compiled successfully (dist folder exists)

---

## What's Working Now

✅ **Authentication**: Users register and login with Cognito  
✅ **User Profiles**: Stored in DynamoDB Users table  
✅ **Glucose Readings**: Stored and retrieved from DynamoDB  
✅ **Dashboard Analytics**: Real-time calculations from DynamoDB data  
✅ **JWT Verification**: Secure authentication with Cognito tokens  

---

## What's Still Mock Data

⏳ **Food Logging**: Still using mock data (needs S3 + Bedrock)  
⏳ **AI Meal Recommendations**: Still using mock data (needs Bedrock)  
⏳ **Pattern Analysis**: Partially working (uses real glucose data but mock AI)  
⏳ **Usage Tracking**: Not implemented yet  

---

## Next Steps

1. Add AWS credentials to Render (this guide)
2. Test all endpoints with real AWS services
3. Implement Bedrock AI features for food analysis
4. Implement S3 for image uploads
5. Add missing GET endpoints for AI insights
6. Implement usage tracking in DynamoDB

---

## Security Notes

- AWS credentials are stored securely in Render's environment variables
- Never commit AWS credentials to Git
- Cognito handles password hashing and security
- JWT tokens expire after 1 hour
- All API endpoints require authentication (except /health, /auth/register, /auth/login)

---

## Cost Monitoring

- **Cognito**: Free tier covers 50,000 MAUs (Monthly Active Users)
- **DynamoDB**: Free tier covers 25 GB storage + 25 WCU/RCU
- **S3**: Free tier covers 5 GB storage + 20,000 GET requests
- **Bedrock**: Pay per token (Claude 3 Sonnet: $0.003/1K input tokens)

Monitor usage in AWS Console: https://console.aws.amazon.com/billing/

---

## Support

If you encounter issues:
1. Check Render logs: https://dashboard.render.com/
2. Check AWS CloudWatch logs
3. Verify environment variables are set correctly
4. Test locally first with `npm start` in local-server/
