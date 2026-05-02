# 🚀 START HERE - Render Deployment Guide

## Welcome! Let's Deploy Your Backend to Render.com (FREE)

This guide will help you deploy your AI Diet & Meal Recommendation System backend to Render.com's free tier in about **10 minutes**.

---

## 📚 Documentation Overview

We've created several guides for you:

### 1. **START_HERE.md** (You are here!)
Quick overview and navigation guide

### 2. **RENDER_QUICK_REFERENCE.md** ⭐ RECOMMENDED
One-page cheat sheet with all essential information

### 3. **RENDER_DEPLOYMENT_STEP_BY_STEP.md** 📖 DETAILED
Complete step-by-step guide with screenshots and troubleshooting

### 4. **DEPLOYMENT_ARCHITECTURE.md** 🏗️ TECHNICAL
System architecture, data flow, and security details

### 5. **RENDER_AWS_REGION_COMPATIBILITY.md** 🌍 REFERENCE
Explains why us-east-1 works perfectly with Render

### 6. **REGION_CONFIGURATION_SUMMARY.md** ✅ STATUS
Current AWS deployment status and configuration

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Get AWS Credentials

```bash
# Check if you already have credentials
cat ~/.aws/credentials
```

If not found, create new access key:
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **kiro-agent**
3. Click **Security credentials** → **Create access key**
4. Copy both keys (you won't see the secret again!)

---

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure service:
   - **Name**: `ai-diet-api`
   - **Region**: Oregon (US West)
   - **Root Directory**: `local-server` ⚠️
   - **Environment**: Docker ⚠️
   - **Instance Type**: Free ⭐

---

### Step 3: Add Environment Variables

Click **"Advanced"** → **"Add from .env"** and paste:

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

**⚠️ IMPORTANT**: Replace `<YOUR_AWS_ACCESS_KEY>` and `<YOUR_AWS_SECRET_KEY>` with your actual credentials from Step 1!

---

### Step 4: Deploy!

1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Copy your URL: `https://ai-diet-api-XXXX.onrender.com`

---

### Step 5: Test Deployment

```bash
# Test health endpoint
curl https://ai-diet-api-XXXX.onrender.com/health

# Expected response:
# {"status":"healthy","timestamp":"...","environment":"local"}
```

---

### Step 6: Update Frontend

```bash
cd frontend
```

Edit `frontend/.env`:
```bash
REACT_APP_API_URL=https://ai-diet-api-XXXX.onrender.com
REACT_APP_USE_MOCK=false
```

Restart frontend:
```bash
npm start
```

---

## ✅ Success Checklist

- [ ] AWS credentials obtained
- [ ] Render account created
- [ ] Service deployed to Render
- [ ] Health endpoint responding
- [ ] Frontend configured
- [ ] End-to-end test successful

---

## 🎯 What You Get

### FREE Hosting:
- ✅ $0/month (Render free tier)
- ✅ Automatic SSL (HTTPS)
- ✅ Auto-deploy on git push
- ✅ Built-in monitoring
- ⚠️ Cold starts after 15 min inactivity (~30s)

### AWS Resources (us-east-1):
- ✅ Cognito authentication
- ✅ 10 DynamoDB tables
- ✅ 3 S3 buckets
- ✅ Bedrock AI (Claude 3 Sonnet)
- ✅ Secrets Manager
- ✅ KMS encryption
- 💰 ~$4-5/month

### Total Cost: ~$4-5/month

---

## 🔧 Common Issues

### Issue: "Build Failed"
**Solution**: Verify Root Directory = `local-server` and Environment = `Docker`

### Issue: "Service Won't Start"
**Solution**: Check all environment variables are set correctly

### Issue: "Unauthorized Errors"
**Solution**: Verify AWS credentials and Cognito IDs match

### Issue: "Cold Starts (30s delay)"
**Solution**: Use [UptimeRobot](https://uptimerobot.com) (free) to ping every 5 minutes

---

## 📊 Your AWS Resources

All deployed in **us-east-1** region:

| Resource | Value |
|----------|-------|
| **Cognito User Pool** | `us-east-1_mzKjA4m2a` |
| **Cognito Client ID** | `59kkpi3ujptbngvp8im8sft1mi` |
| **Region** | `us-east-1` |
| **Account** | `407902217908` |

**Why us-east-1?** Bedrock AI (Claude 3 Sonnet) is only available in us-east-1.

---

## 🚀 Next Steps

### Immediate:
1. ✅ Deploy to Render (follow steps above)
2. ✅ Test all API endpoints
3. ✅ Connect frontend
4. ✅ Test end-to-end user flow

### Short-term:
1. Set up [UptimeRobot](https://uptimerobot.com) to prevent cold starts
2. Test meal recommendations feature
3. Test pattern analysis feature
4. Add monitoring alerts

### Long-term:
1. Consider upgrading to Render Starter ($7/month) for no cold starts
2. Set up staging environment
3. Add custom domain
4. Implement CI/CD pipeline

---

## 📚 Need More Help?

### Quick Reference:
→ See **RENDER_QUICK_REFERENCE.md** for one-page cheat sheet

### Detailed Guide:
→ See **RENDER_DEPLOYMENT_STEP_BY_STEP.md** for complete walkthrough

### Architecture Details:
→ See **DEPLOYMENT_ARCHITECTURE.md** for system architecture

### Region Info:
→ See **RENDER_AWS_REGION_COMPATIBILITY.md** for region details

### Troubleshooting:
→ Check the troubleshooting section in **RENDER_DEPLOYMENT_STEP_BY_STEP.md**

---

## 💡 Pro Tips

1. **Use UptimeRobot** (free) to ping your API every 5 minutes → prevents cold starts
2. **Enable auto-deploy** in Render → automatic deployments on git push
3. **Monitor logs** in Render dashboard → catch errors early
4. **Set up alerts** in Render → get notified of issues
5. **Test thoroughly** before sharing with users

---

## 🎉 Ready to Deploy?

### Option 1: Quick Deploy (5 minutes)
Follow the **Quick Start** section above

### Option 2: Detailed Deploy (10 minutes)
Read **RENDER_DEPLOYMENT_STEP_BY_STEP.md** for complete guide

### Option 3: Just the Essentials
Use **RENDER_QUICK_REFERENCE.md** as a cheat sheet

---

## 🆘 Need Help?

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Community**: [community.render.com](https://community.render.com)
- **AWS Documentation**: [docs.aws.amazon.com](https://docs.aws.amazon.com)

---

## 🎊 Let's Get Started!

**Choose your path:**

1. **I want the quickest way** → Follow **Quick Start** above
2. **I want detailed instructions** → Read **RENDER_DEPLOYMENT_STEP_BY_STEP.md**
3. **I want a cheat sheet** → Use **RENDER_QUICK_REFERENCE.md**
4. **I want to understand the architecture** → Read **DEPLOYMENT_ARCHITECTURE.md**

---

**Happy Deploying!** 🚀

Your AI Diet & Meal Recommendation System will be live in minutes!
