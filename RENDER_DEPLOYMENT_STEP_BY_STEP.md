# Render.com Deployment - Step-by-Step Guide

## 🎯 Complete Deployment Guide with Actual AWS Credentials

This guide will walk you through deploying your Express.js backend to Render.com's **FREE tier** using your actual AWS resources deployed in **us-east-1**.

---

## ✅ Prerequisites Checklist

Before starting, ensure you have:

- [ ] GitHub account (for repository connection)
- [ ] Render.com account (free - sign up at [render.com](https://render.com))
- [ ] AWS credentials (Access Key ID and Secret Access Key)
- [ ] This repository pushed to GitHub

---

## 📋 Step 1: Get AWS Credentials

You need AWS credentials for the `kiro-agent` IAM user to access your AWS resources.

### Option A: Check Existing Credentials

```bash
# Check if credentials already exist
cat ~/.aws/credentials
```

Look for a section like:
```ini
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```

### Option B: Create New Access Key

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **kiro-agent**
3. Click **Security credentials** tab
4. Click **Create access key**
5. Choose **Application running outside AWS**
6. Click **Create access key**
7. **IMPORTANT**: Copy both keys immediately (you can't see the secret key again!)

---

## 📋 Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (recommended for auto-deploy)
4. Authorize Render to access your GitHub repositories

---

## 📋 Step 3: Create New Web Service

1. In Render dashboard, click **"New +"** button (top right)
2. Select **"Web Service"**
3. Click **"Build and deploy from a Git repository"**
4. Click **"Next"**

---

## 📋 Step 4: Connect Repository

### If Repository is Public:
1. Paste your repository URL
2. Click **"Continue"**

### If Repository is Private:
1. Click **"Connect GitHub"**
2. Select your repository from the list
3. Click **"Connect"**

---

## 📋 Step 5: Configure Service Settings

Fill in these exact values:

| Setting | Value | Notes |
|---------|-------|-------|
| **Name** | `ai-diet-api` | Or your preferred name |
| **Region** | `Oregon (US West)` | Closest to AWS us-east-1 |
| **Branch** | `main` | Or your default branch |
| **Root Directory** | `local-server` | ⚠️ IMPORTANT: Must be `local-server` |
| **Environment** | `Docker` | ⚠️ IMPORTANT: Select Docker |
| **Instance Type** | **Free** | ⭐ Select the FREE tier |

**⚠️ CRITICAL**: 
- Root Directory MUST be `local-server` (where Dockerfile is located)
- Environment MUST be `Docker` (not Node)

---

## 📋 Step 6: Add Environment Variables

Click **"Advanced"** to expand advanced settings, then scroll to **"Environment Variables"** section.

### Add These Variables ONE BY ONE:

Click **"Add Environment Variable"** for each:

#### 1. Server Configuration
```bash
NODE_ENV=production
PORT=3000
```

#### 2. AWS Configuration
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_FROM_STEP_1>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_KEY_FROM_STEP_1>
```

**⚠️ REPLACE** `<YOUR_AWS_ACCESS_KEY_FROM_STEP_1>` and `<YOUR_AWS_SECRET_KEY_FROM_STEP_1>` with your actual credentials!

#### 3. Cognito Configuration (Actual Values from us-east-1)
```bash
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi
```

#### 4. DynamoDB Tables (Actual Values from us-east-1)
```bash
DYNAMODB_USERS_TABLE=dev-ai-diet-users
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings
DYNAMODB_FOOD_TABLE=dev-ai-diet-food-logs
DYNAMODB_USAGE_TABLE=dev-ai-diet-usage-tracking
DYNAMODB_ACTIVITY_TABLE=dev-ai-diet-activity-logs
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-ai-insights
DYNAMODB_PROVIDER_ACCESS_TABLE=dev-ai-diet-provider-access
DYNAMODB_AUDIT_LOGS_TABLE=dev-ai-diet-audit-logs
DYNAMODB_PREDICTIONS_TABLE=dev-ai-diet-predictions
DYNAMODB_USER_PROFILES_TABLE=dev-ai-diet-user-profiles
```

#### 5. S3 Buckets (Actual Values from us-east-1)
```bash
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images
S3_REPORTS_BUCKET=dev-ai-diet-reports
S3_GLUCOSE_FILES_BUCKET=dev-ai-diet-glucose-uploads
```

### 💡 Pro Tip: Copy-Paste All at Once

Instead of adding one by one, you can use Render's **"Add from .env"** feature:

1. Click **"Add from .env"** button
2. Paste this entire block:

```env
NODE_ENV=production
PORT=3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_KEY>
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi
DYNAMODB_USERS_TABLE=dev-ai-diet-users
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-glucose-readings
DYNAMODB_FOOD_TABLE=dev-ai-diet-food-logs
DYNAMODB_USAGE_TABLE=dev-ai-diet-usage-tracking
DYNAMODB_ACTIVITY_TABLE=dev-ai-diet-activity-logs
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-ai-insights
DYNAMODB_PROVIDER_ACCESS_TABLE=dev-ai-diet-provider-access
DYNAMODB_AUDIT_LOGS_TABLE=dev-ai-diet-audit-logs
DYNAMODB_PREDICTIONS_TABLE=dev-ai-diet-predictions
DYNAMODB_USER_PROFILES_TABLE=dev-ai-diet-user-profiles
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images
S3_REPORTS_BUCKET=dev-ai-diet-reports
S3_GLUCOSE_FILES_BUCKET=dev-ai-diet-glucose-uploads
```

**⚠️ REMEMBER**: Replace `<YOUR_AWS_ACCESS_KEY>` and `<YOUR_AWS_SECRET_KEY>` with your actual credentials!

---

## 📋 Step 7: Deploy!

1. Scroll to the bottom
2. Click **"Create Web Service"**
3. Render will now:
   - Clone your repository
   - Navigate to `local-server/` directory
   - Build Docker image from `Dockerfile`
   - Start the container
   - Assign a free URL

### Watch the Deployment

You'll see real-time logs like:
```
==> Cloning from https://github.com/your-repo...
==> Checking out commit abc123...
==> Building Docker image...
==> Step 1/8 : FROM node:18-alpine
==> Step 2/8 : WORKDIR /app
...
==> Successfully built image
==> Starting service...
==> Your service is live at https://ai-diet-api.onrender.com
```

**⏱️ First deployment takes 3-5 minutes**

---

## 📋 Step 8: Get Your API URL

Once deployment completes, you'll see:

```
✅ Your service is live at https://ai-diet-api-XXXX.onrender.com
```

**Copy this URL** - you'll need it for the frontend!

---

## ✅ Step 9: Verify Deployment

### Test 1: Health Check

Open your browser or use curl:

```bash
curl https://ai-diet-api-XXXX.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-02T12:34:56.789Z",
  "environment": "local"
}
```

### Test 2: Register a User

```bash
curl -X POST https://ai-diet-api-XXXX.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
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
    "userId": "user-1234567890",
    "email": "test@example.com",
    "subscriptionTier": "free",
    "message": "Registration successful"
  }
}
```

### Test 3: Login

```bash
curl -X POST https://ai-diet-api-XXXX.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "idToken": "...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### ✅ All Tests Passed?

**Congratulations! Your backend is live!** 🎉

---

## 📋 Step 10: Configure Frontend

Now update your React frontend to use the Render API.

### Update Frontend Environment

```bash
cd frontend
```

Edit `frontend/.env`:

```bash
# Replace with your actual Render URL
REACT_APP_API_URL=https://ai-diet-api-XXXX.onrender.com
REACT_APP_USE_MOCK=false
```

### Restart Frontend

```bash
npm start
```

Your frontend will now connect to the Render-hosted backend! 🚀

---

## 🔄 Step 11: Enable Auto-Deploy (Optional but Recommended)

Render automatically deploys when you push to your main branch.

### Test Auto-Deploy:

1. Make a small change to your code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test auto-deploy"
   git push origin main
   ```
3. Go to Render dashboard
4. Watch automatic deployment start
5. New version will be live in ~2-3 minutes

---

## 🔧 Troubleshooting

### Issue 1: "Build Failed"

**Check logs in Render dashboard:**
- Look for error messages
- Common issue: Missing `Dockerfile` in `local-server/` directory

**Solution:**
```bash
# Verify Dockerfile exists
ls local-server/Dockerfile

# If missing, create it (should already exist in your repo)
```

### Issue 2: "Service Won't Start"

**Check logs for:**
- Missing environment variables
- Port configuration errors

**Solution:**
1. Verify all environment variables are set
2. Ensure `PORT=3000` is set
3. Check that `NODE_ENV=production` is set

### Issue 3: "Unauthorized" Errors

**Possible causes:**
- Wrong AWS credentials
- Wrong Cognito User Pool ID or Client ID

**Solution:**
1. Double-check AWS credentials in Step 1
2. Verify Cognito IDs match `cdk-outputs.json`:
   - User Pool ID: `us-east-1_mzKjA4m2a`
   - Client ID: `59kkpi3ujptbngvp8im8sft1mi`

### Issue 4: "Cold Start" Delays

**Free tier services spin down after 15 minutes of inactivity.**

**Solutions:**
1. **Use UptimeRobot (Free)**: Ping your API every 5 minutes
   - Go to [uptimerobot.com](https://uptimerobot.com)
   - Create free account
   - Add monitor: `https://ai-diet-api-XXXX.onrender.com/health`
   - Interval: 5 minutes
   - Keeps service warm 24/7!

2. **Upgrade to Paid Plan**: $7/month for no cold starts

3. **Accept Cold Starts**: Add loading message in frontend

### Issue 5: "Out of Memory"

**Free tier has 512MB RAM limit**

**Solutions:**
1. Optimize code to use less memory
2. Upgrade to Starter plan ($7/month, 512MB) or Standard ($25/month, 2GB)

---

## 📊 Monitoring Your Deployment

### View Logs

1. Go to Render dashboard
2. Click on your service (`ai-diet-api`)
3. Click **"Logs"** tab
4. See real-time logs

### View Metrics

1. Click **"Metrics"** tab
2. Monitor:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Set Up Alerts

1. Click **"Settings"** → **"Notifications"**
2. Add your email
3. Get notified on:
   - Deployment success/failure
   - Service crashes
   - Health check failures

---

## 🎉 Success Checklist

- [ ] Render account created
- [ ] Repository connected
- [ ] Service configured (Docker, Free tier, `local-server` root directory)
- [ ] All environment variables added (AWS credentials, Cognito, DynamoDB, S3)
- [ ] Service deployed successfully
- [ ] Health endpoint responding (`/health`)
- [ ] Registration endpoint working (`/auth/register`)
- [ ] Login endpoint working (`/auth/login`)
- [ ] Frontend configured with Render URL
- [ ] Auto-deploy enabled
- [ ] (Optional) UptimeRobot configured for keep-alive

---

## 🚀 What's Next?

### Immediate Next Steps:
1. ✅ Test all API endpoints from frontend
2. ✅ Register a real user account
3. ✅ Log some glucose readings
4. ✅ Test meal recommendations
5. ✅ Test pattern analysis

### Short-term:
1. Set up UptimeRobot to prevent cold starts
2. Configure custom domain (optional)
3. Add monitoring alerts
4. Test end-to-end user flows

### Long-term:
1. Consider upgrading to paid plan for production
2. Set up staging environment
3. Implement CI/CD pipeline
4. Add performance monitoring (e.g., Sentry, DataDog)

---

## 💰 Cost Summary

### Current Setup (FREE):
- **Render Free Tier**: $0/month
- **AWS Resources**: ~$4-5/month (Secrets Manager + KMS)
- **Total**: ~$4-5/month

### If You Upgrade Render:
- **Render Starter**: $7/month (no cold starts, 512MB RAM)
- **Render Standard**: $25/month (no cold starts, 2GB RAM)
- **AWS Resources**: ~$4-5/month
- **Total**: $11-30/month

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Docker Deployment Guide](https://render.com/docs/docker)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)
- [UptimeRobot](https://uptimerobot.com) - Free keep-alive service

---

## 🎊 Congratulations!

**Your AI Diet & Meal Recommendation System backend is now live on Render.com!** 🎉

- ✅ **FREE hosting** (with cold starts)
- ✅ **Automatic SSL** (HTTPS enabled)
- ✅ **Auto-deploy** on git push
- ✅ **Connected to AWS us-east-1** resources
- ✅ **Ready for frontend integration**

**API URL**: `https://ai-diet-api-XXXX.onrender.com`

**Next**: Connect your React frontend and start testing! 🚀

---

**Questions or Issues?**
- Check [Render's documentation](https://render.com/docs)
- Visit [Render community forum](https://community.render.com)
- Review the troubleshooting section above

**Happy Deploying!** 🎉
