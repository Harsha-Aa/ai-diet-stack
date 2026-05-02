# Deploy to Render.com (FREE Tier)

## Overview

Render.com offers a **FREE tier** perfect for development, testing, and low-traffic applications. This guide shows how to deploy the Express.js backend to Render's free tier.

---

## ✨ Render Free Tier Benefits

- ✅ **$0/month** - Completely free
- ✅ **Automatic SSL** - HTTPS enabled by default
- ✅ **Automatic deploys** - Deploy on git push
- ✅ **Built-in monitoring** - Logs and metrics included
- ✅ **Easy setup** - No DevOps knowledge required
- ✅ **Docker support** - Uses your Dockerfile
- ⚠️ **Limitations**: 
  - Spins down after 15 minutes of inactivity (cold starts ~30 seconds)
  - 512MB RAM
  - Shared CPU
  - Good for: Development, testing, demos, low-traffic apps

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started"**
3. Sign up with **GitHub** (recommended for auto-deploy)

### Step 2: Connect Repository

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect GitHub"** and authorize Render
3. Select your repository: `ai-diet-meal-recommendation-system`
4. Click **"Connect"**

### Step 3: Configure Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `ai-diet-api` (or your choice) |
| **Region** | Choose closest to you (e.g., Singapore, Oregon) |
| **Branch** | `main` |
| **Root Directory** | `local-server` |
| **Environment** | `Docker` |
| **Instance Type** | **Free** ⭐ |

### Step 4: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add these:

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

**💡 Tip**: You can also use Render's **Secret Files** feature to store `.env` file securely.

### Step 5: Deploy!

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Build Docker image from `local-server/Dockerfile`
   - Deploy to their infrastructure
   - Assign a free URL: `https://ai-diet-api.onrender.com`
3. Watch the deployment logs in real-time

**⏱️ First deployment takes ~3-5 minutes**

### Step 6: Get Your API URL

Once deployed, you'll see:
```
Your service is live at https://ai-diet-api.onrender.com
```

Copy this URL - you'll need it for the frontend!

---

## ✅ Verify Deployment

### Test Health Endpoint

```bash
curl https://ai-diet-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-02T...",
  "environment": "production"
}
```

### Test API Endpoints

```bash
# Register a user
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
```

---

## 🔧 Configure Frontend

Update your frontend to use the Render API:

### Option 1: Update `.env` file

```bash
# frontend/.env
REACT_APP_API_URL=https://ai-diet-api.onrender.com
```

### Option 2: Update `api.ts` directly

```typescript
// frontend/src/services/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ai-diet-api.onrender.com';
```

### Restart Frontend

```bash
cd frontend
npm start
```

---

## 🔄 Automatic Deployments

Render automatically deploys when you push to `main` branch:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

Render will:
1. Detect the push
2. Build new Docker image
3. Deploy automatically
4. Zero-downtime deployment

**⏱️ Subsequent deployments take ~2-3 minutes**

---

## 📊 Monitoring & Logs

### View Logs

1. Go to Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. See real-time logs

### View Metrics

1. Click **"Metrics"** tab
2. See:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Set Up Alerts

1. Click **"Settings"** → **"Notifications"**
2. Add email for deployment notifications
3. Get notified on:
   - Deployment success/failure
   - Service crashes
   - Health check failures

---

## ⚡ Handling Cold Starts

**Free tier services spin down after 15 minutes of inactivity.**

### What Happens?
- First request after inactivity: ~30 seconds (cold start)
- Subsequent requests: Normal speed (<1 second)

### Solutions:

**Option 1: Keep-Alive Ping (Free)**
Use a service like [UptimeRobot](https://uptimerobot.com) (free) to ping your API every 5 minutes:
- URL to ping: `https://ai-diet-api.onrender.com/health`
- Interval: 5 minutes
- Keeps service warm 24/7

**Option 2: Upgrade to Paid Plan**
- Starter: $7/month (no cold starts, 512MB RAM)
- Standard: $25/month (no cold starts, 2GB RAM)

**Option 3: Accept Cold Starts**
- Good for: Development, testing, demos
- Add loading message in frontend: "Waking up server..."

---

## 🔒 Security Best Practices

### 1. Use Environment Variables
✅ Never commit secrets to git
✅ Use Render's environment variables
✅ Rotate AWS keys regularly

### 2. Enable HTTPS
✅ Automatic with Render (free SSL)
✅ All traffic encrypted

### 3. Configure CORS
Already configured in `local-server/server.js`:
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
```

Update environment variable:
```bash
FRONTEND_URL=https://your-frontend-domain.com
```

### 4. Rate Limiting
Already configured in `local-server/server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Render** | ✅ FREE (with cold starts) | $7-25/month | Development, testing, demos |
| **Railway** | ❌ No free tier | $5 base + usage | Production apps |
| **AWS EC2** | ✅ FREE (12 months) | $15-30/month | Full control, scaling |
| **Heroku** | ❌ No free tier (discontinued) | $7-25/month | Legacy apps |

**Winner for Free Tier: Render.com** ⭐

---

## 🎯 When to Upgrade

### Stay on Free Tier If:
- ✅ Development/testing environment
- ✅ Demo or portfolio project
- ✅ Low traffic (<100 requests/day)
- ✅ Can tolerate cold starts

### Upgrade to Paid If:
- ❌ Production application
- ❌ High traffic (>1000 requests/day)
- ❌ Need instant response times
- ❌ Business-critical application

---

## 🔧 Troubleshooting

### Issue: Service Won't Start

**Check logs in Render dashboard:**
```
Common issues:
- Missing environment variables
- Docker build errors
- Port configuration (must use PORT=3000)
```

**Solution:**
1. Verify all environment variables are set
2. Check Dockerfile is in `local-server/` directory
3. Ensure `PORT` environment variable is set to `3000`

### Issue: Cold Start Too Slow

**Solutions:**
1. Use UptimeRobot to keep service warm (free)
2. Upgrade to Starter plan ($7/month)
3. Add loading indicator in frontend

### Issue: Out of Memory

**Free tier has 512MB RAM limit**

**Solutions:**
1. Optimize code (reduce memory usage)
2. Upgrade to Starter plan (512MB) or Standard plan (2GB)
3. Use caching to reduce database queries

### Issue: Environment Variables Not Working

**Check:**
1. Variables are set in Render dashboard (not in code)
2. Service was redeployed after adding variables
3. Variable names match exactly (case-sensitive)

---

## 📚 Additional Resources

### Render Documentation
- [Render Docs](https://render.com/docs)
- [Docker Deployment](https://render.com/docs/docker)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)

### Keep-Alive Services (Free)
- [UptimeRobot](https://uptimerobot.com) - Free, 50 monitors
- [Cron-job.org](https://cron-job.org) - Free, unlimited jobs
- [Pingdom](https://www.pingdom.com) - Free trial

---

## 🎉 Success Checklist

- [ ] Render account created
- [ ] Repository connected
- [ ] Service configured (Docker, Free tier)
- [ ] Environment variables added
- [ ] Service deployed successfully
- [ ] Health endpoint responding
- [ ] API endpoints tested
- [ ] Frontend configured with Render URL
- [ ] Auto-deploy enabled
- [ ] (Optional) Keep-alive ping configured

---

## 🚀 Next Steps

### Immediate
1. ✅ Deploy to Render (FREE)
2. ✅ Test all API endpoints
3. ✅ Configure frontend
4. ✅ Test end-to-end flow

### Short-term
1. Set up UptimeRobot for keep-alive
2. Configure custom domain (optional)
3. Set up monitoring alerts
4. Add deployment notifications

### Long-term
1. Consider upgrading to paid plan for production
2. Set up staging environment
3. Implement CI/CD pipeline
4. Add performance monitoring

---

## 💡 Pro Tips

1. **Use Render's Secret Files** for `.env` instead of individual variables
2. **Enable Auto-Deploy** for automatic deployments on git push
3. **Use UptimeRobot** to prevent cold starts (free)
4. **Monitor logs** regularly for errors
5. **Set up Slack/Email notifications** for deployment status
6. **Use Render's Preview Environments** for testing PRs
7. **Add custom domain** for professional look (free with Render)

---

## 🎊 Congratulations!

**Your backend is now deployed to Render for FREE!** 🎉

- ✅ Zero cost
- ✅ Automatic SSL
- ✅ Auto-deploy on git push
- ✅ Built-in monitoring
- ✅ Easy to use

**API URL**: `https://ai-diet-api.onrender.com`

**Ready to connect your frontend and start testing!** 🚀

---

**Questions?** Check [Render's documentation](https://render.com/docs) or their [community forum](https://community.render.com).
