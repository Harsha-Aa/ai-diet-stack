# Region Configuration Summary

## ✅ Current Status

### AWS Infrastructure Deployment
- **Current Region**: `us-east-1` (US East - N. Virginia)
- **Previous Region**: `ap-south-1` (Asia Pacific - Mumbai) - **NO STACKS FOUND** ✅
- **Account ID**: `407902217908`

### Deployed Stacks in us-east-1
All 6 CDK stacks are successfully deployed in **us-east-1**:

1. **dev-auth** - Cognito User Pool
   - User Pool ID: `us-east-1_mzKjA4m2a`
   - Client ID: `59kkpi3ujptbngvp8im8sft1mi`

2. **dev-storage** - S3 Buckets & KMS
   - Food Images: `dev-ai-diet-food-images`
   - Reports: `dev-ai-diet-reports`
   - Glucose Uploads: `dev-ai-diet-glucose-uploads`
   - KMS Key: `ef65634c-7b5f-48dc-98c4-6405fbd85bff`

3. **dev-secrets** - Secrets Manager & Parameter Store
   - JWT Secret, Encryption Key, Database Credentials
   - Stripe API Key, Dexcom/Libre API Credentials
   - Bedrock Model ID, SES Email, Free Tier Limits

4. **dev-data** - DynamoDB Tables (10 tables)
   - Users, User Profiles, Glucose Readings, Food Logs
   - Usage Tracking, Activity Logs, AI Insights, Predictions
   - Provider Access, Audit Logs

5. **dev-compute** - Lambda Functions (7 functions)
   - Register, Login, Dashboard
   - Predict Glucose, Analyze Text, Update Food Log
   - API Authorizer

6. **dev-api** - API Gateway
   - Endpoint: `https://u4d3l1pdk1.execute-api.us-east-1.amazonaws.com/dev/`
   - Free Tier Plan ID: `b7u2x5`
   - Premium Tier Plan ID: `293qbs`

---

## 🎯 Why us-east-1?

### Bedrock AI Model Access
Amazon Bedrock AI models (Claude 3 Sonnet) are available in **us-east-1** region. This is critical for:
- AI-powered meal recommendations
- Pattern analysis
- Glucose predictions
- Text analysis for food logging

### Other Benefits
- **Lowest latency** for most global users
- **Most AWS services available** (first region to get new features)
- **Cost-effective** (often lowest pricing)
- **High availability** (most availability zones)

---

## 📝 Environment Configuration Updates

### Updated Files
All environment configuration files now default to **us-east-1**:

1. **`.env.example`** (Root)
   ```bash
   # AWS Configuration
   # Default region is us-east-1 for Bedrock AI model access
   AWS_REGION=us-east-1
   CDK_DEFAULT_REGION=us-east-1
   
   # Bedrock Configuration
   BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
   BEDROCK_REGION=us-east-1
   ```

2. **`local-server/.env.example`**
   ```bash
   # AWS Configuration
   # Default region is us-east-1 for Bedrock AI model access
   AWS_REGION=us-east-1
   ```

3. **`bin/app.ts`** (CDK App)
   ```typescript
   const env = {
     account: process.env.CDK_DEFAULT_ACCOUNT,
     region: process.env.CDK_DEFAULT_REGION || 'us-east-1', // Defaults to us-east-1
   };
   ```

---

## 🚀 Next Steps

### 1. Verify No Stacks in ap-south-1
```bash
aws cloudformation list-stacks --region ap-south-1 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```
**Result**: ✅ No stacks found in ap-south-1

### 2. Deploy Backend to Render.com
Use the credentials from `cdk-outputs.json` to deploy the Express.js backend:

```bash
# Environment Variables for Render.com
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi
DYNAMODB_USERS_TABLE=dev-ai-diet-users
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings
DYNAMODB_FOOD_TABLE=dev-ai-diet-food-logs
# ... (see RENDER_DEPLOYMENT_CREDENTIALS.md for full list)
```

### 3. Update Frontend Configuration
After Render deployment, update `frontend/.env`:
```bash
REACT_APP_API_URL=https://your-app.onrender.com
REACT_APP_USE_MOCK=false
```

---

## 📊 Cost Monitoring

### Current AWS Resources (us-east-1)
- **Cognito**: Free tier (50,000 MAUs)
- **DynamoDB**: Pay-per-request (free tier: 25 GB storage, 25 WCU/RCU)
- **S3**: Standard storage (free tier: 5 GB)
- **Lambda**: Free tier (1M requests/month, 400,000 GB-seconds)
- **API Gateway**: Free tier (1M requests/month for 12 months)
- **Secrets Manager**: $0.40/secret/month (7 secrets = ~$2.80/month)
- **KMS**: $1/key/month (1 key = $1/month)

**Estimated Monthly Cost**: ~$4-5/month (mostly Secrets Manager + KMS)

---

## 🔒 Security Notes

1. **Encryption**: All data encrypted at rest using KMS
2. **Secrets**: Stored in AWS Secrets Manager (not in code)
3. **Authentication**: Cognito User Pool with JWT tokens
4. **API Security**: API Gateway with authorizer function
5. **IAM Roles**: Least privilege access for Lambda functions

---

## 📚 Related Documentation

- `cdk-outputs.json` - All deployed resource IDs
- `RENDER_DEPLOYMENT_CREDENTIALS.md` - Render.com deployment guide
- `AWS_CREDENTIALS_GUIDE.md` - AWS credential extraction guide
- `DEPLOYMENT.md` - General deployment documentation

---

**Last Updated**: May 2, 2026
**Region**: us-east-1 (US East - N. Virginia)
**Environment**: dev
**Status**: ✅ All stacks deployed successfully
