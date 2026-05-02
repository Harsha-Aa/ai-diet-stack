# Render Deployment - Quick Reference Card

## 🚀 5-Minute Deployment Checklist

### 1. Get AWS Credentials
```bash
cat ~/.aws/credentials
```
Or create new access key in [AWS IAM Console](https://console.aws.amazon.com/iam/) → Users → kiro-agent

---

### 2. Render Service Settings

| Setting | Value |
|---------|-------|
| **Name** | `ai-diet-api` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `local-server` ⚠️ |
| **Environment** | Docker ⚠️ |
| **Instance Type** | Free ⭐ |

---

### 3. Environment Variables (Copy-Paste)

```env
NODE_ENV=production
PORT=3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_SECRET>
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

**⚠️ Replace `<YOUR_KEY>` and `<YOUR_SECRET>` with actual AWS credentials!**

---

### 4. Test Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Register user
curl -X POST https://your-app.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","age":30,"weight_kg":70,"height_cm":170,"diabetes_type":"type2"}'

# Login
curl -X POST https://your-app.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

---

### 5. Update Frontend

```bash
# frontend/.env
REACT_APP_API_URL=https://your-app.onrender.com
REACT_APP_USE_MOCK=false
```

---

## 🔧 Common Issues

| Issue | Solution |
|-------|----------|
| Build failed | Check Root Directory = `local-server` |
| Service won't start | Verify all environment variables set |
| Unauthorized errors | Check AWS credentials and Cognito IDs |
| Cold starts (30s delay) | Use [UptimeRobot](https://uptimerobot.com) (free) to ping every 5 min |

---

## 📊 Your AWS Resources (us-east-1)

| Resource | Value |
|----------|-------|
| **Cognito User Pool** | `us-east-1_mzKjA4m2a` |
| **Cognito Client** | `59kkpi3ujptbngvp8im8sft1mi` |
| **API Gateway** | `https://u4d3l1pdk1.execute-api.us-east-1.amazonaws.com/dev/` |
| **Region** | `us-east-1` |
| **Account** | `407902217908` |

---

## 💰 Cost

- **Render Free Tier**: $0/month (with cold starts)
- **AWS Resources**: ~$4-5/month
- **Total**: ~$4-5/month

---

## 🎯 Next Steps

1. ✅ Deploy to Render
2. ✅ Test API endpoints
3. ✅ Update frontend
4. ✅ Set up UptimeRobot (optional, prevents cold starts)
5. ✅ Test end-to-end

---

**Full Guide**: See `RENDER_DEPLOYMENT_STEP_BY_STEP.md`
