# Deployment Architecture Overview

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         React Frontend (localhost:3000)                     │   │
│  │  • Material-UI Components                                   │   │
│  │  • Meal Recommendations                                     │   │
│  │  • Pattern Analysis                                         │   │
│  │  • Glucose Logging                                          │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RENDER.COM (FREE TIER)                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         Express.js Backend (Docker Container)               │   │
│  │                                                             │   │
│  │  Endpoints:                                                 │   │
│  │  • POST /auth/register                                      │   │
│  │  • POST /auth/login                                         │   │
│  │  • GET  /auth/profile                                       │   │
│  │  • POST /glucose/readings                                   │   │
│  │  • GET  /glucose/readings                                   │   │
│  │  • POST /food/analyze-text                                  │   │
│  │  • GET  /analytics/dashboard                                │   │
│  │  • POST /ai/recommend-meal                                  │   │
│  │  • POST /ai/analyze-patterns                                │   │
│  │  • GET  /health                                             │   │
│  │                                                             │   │
│  │  Environment Variables:                                     │   │
│  │  • AWS_REGION=us-east-1                                     │   │
│  │  • AWS_ACCESS_KEY_ID=xxx                                    │   │
│  │  • AWS_SECRET_ACCESS_KEY=xxx                                │   │
│  │  • COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a                │   │
│  │  • COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi            │   │
│  │  • DYNAMODB_*_TABLE=dev-ai-diet-*                          │   │
│  │  • S3_*_BUCKET=dev-ai-diet-*                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Features:                                                           │
│  • ✅ FREE hosting ($0/month)                                       │
│  • ✅ Automatic SSL (HTTPS)                                         │
│  • ✅ Auto-deploy on git push                                       │
│  • ⚠️  Cold starts after 15 min inactivity (~30s)                  │
│  • 512MB RAM, Shared CPU                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ AWS SDK API Calls (HTTPS)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS us-east-1 REGION                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  COGNITO (Authentication)                                   │   │
│  │  • User Pool: us-east-1_mzKjA4m2a                          │   │
│  │  • Client ID: 59kkpi3ujptbngvp8im8sft1mi                   │   │
│  │  • JWT token generation                                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  DYNAMODB (Database - 10 Tables)                            │   │
│  │  • dev-ai-diet-users                                        │   │
│  │  • dev-ai-diet-user-profiles                                │   │
│  │  • dev-ai-diet-glucose-readings                             │   │
│  │  • dev-ai-diet-food-logs                                    │   │
│  │  • dev-ai-diet-usage-tracking                               │   │
│  │  • dev-ai-diet-activity-logs                                │   │
│  │  • dev-ai-diet-ai-insights                                  │   │
│  │  • dev-ai-diet-predictions                                  │   │
│  │  • dev-ai-diet-provider-access                              │   │
│  │  • dev-ai-diet-audit-logs                                   │   │
│  │  Billing: Pay-per-request (free tier: 25 GB, 25 WCU/RCU)  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  S3 (Storage - 3 Buckets)                                   │   │
│  │  • dev-ai-diet-food-images                                  │   │
│  │  • dev-ai-diet-reports                                      │   │
│  │  • dev-ai-diet-glucose-uploads                              │   │
│  │  Billing: Standard storage (free tier: 5 GB)               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  SECRETS MANAGER (7 Secrets)                                │   │
│  │  • JWT Secret                                               │   │
│  │  • Encryption Key                                           │   │
│  │  • Database Credentials                                     │   │
│  │  • Stripe API Key                                           │   │
│  │  • Dexcom API Credentials                                   │   │
│  │  • Libre API Credentials                                    │   │
│  │  Billing: $0.40/secret/month (~$2.80/month)                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  KMS (Encryption)                                           │   │
│  │  • Key ID: ef65634c-7b5f-48dc-98c4-6405fbd85bff           │   │
│  │  • Encrypts all data at rest                               │   │
│  │  Billing: $1/key/month                                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  BEDROCK AI (Claude 3 Sonnet)                               │   │
│  │  • Model: anthropic.claude-3-sonnet-20240229-v1:0          │   │
│  │  • Used for: Meal recommendations, Pattern analysis         │   │
│  │  • Only available in us-east-1 (reason for region choice)  │   │
│  │  Billing: Pay-per-use                                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  API GATEWAY (Optional - Not Used by Render)                │   │
│  │  • Endpoint: https://u4d3l1pdk1.execute-api.us-east-1...   │   │
│  │  • 7 Lambda functions deployed                              │   │
│  │  • Can be used as alternative to Render                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Total AWS Cost: ~$4-5/month                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow Example

### User Registration Flow:

```
1. User fills registration form in React frontend
   ↓
2. Frontend sends POST /auth/register to Render
   {
     "email": "user@example.com",
     "password": "SecurePass123!",
     "age": 30,
     "weight_kg": 70,
     "height_cm": 170,
     "diabetes_type": "type2"
   }
   ↓
3. Render Express.js server receives request
   ↓
4. Server validates input
   ↓
5. Server creates user in mock storage (in-memory)
   ↓
6. Server returns success response
   {
     "success": true,
     "data": {
       "userId": "user-1234567890",
       "email": "user@example.com",
       "subscriptionTier": "free"
     }
   }
   ↓
7. Frontend displays success message
```

### Glucose Reading Flow:

```
1. User logs glucose reading in React frontend
   ↓
2. Frontend sends POST /glucose/readings to Render
   Authorization: Bearer <token>
   {
     "reading_value": 120,
     "reading_unit": "mg/dL",
     "timestamp": "2026-05-02T10:30:00Z",
     "meal_context": "after_meal"
   }
   ↓
3. Render Express.js server receives request
   ↓
4. Server validates JWT token
   ↓
5. Server stores reading in mock storage
   ↓
6. Server returns success with classification
   {
     "success": true,
     "data": {
       "reading": {
         "reading_value": 120,
         "classification": "In-Range",
         "timestamp": "2026-05-02T10:30:00Z"
       },
       "target_range": { "min": 70, "max": 180 }
     }
   }
   ↓
7. Frontend displays reading with color-coded badge
```

### Meal Recommendation Flow:

```
1. User requests meal recommendations
   ↓
2. Frontend sends POST /ai/recommend-meal to Render
   Authorization: Bearer <token>
   {
     "current_glucose": 150,
     "time_of_day": "lunch",
     "dietary_preferences": ["vegetarian"]
   }
   ↓
3. Render Express.js server receives request
   ↓
4. Server validates JWT token
   ↓
5. Server gets user profile from mock storage
   ↓
6. Server generates meal recommendations based on:
   • Current glucose level (150 mg/dL - slightly high)
   • Time of day (lunch)
   • Dietary preferences (vegetarian)
   • User's target range (70-180 mg/dL)
   ↓
7. Server returns 3 prioritized meal recommendations
   {
     "success": true,
     "data": {
       "recommendations": [
         {
           "meal_name": "Quinoa Bowl with Vegetables",
           "nutrients": { "carbs_g": 42, "protein_g": 16, ... },
           "estimated_glucose_impact": { "peak_increase": 50 }
         },
         ...
       ],
       "glucose_status": "high"
     }
   }
   ↓
8. Frontend displays meal cards with nutrition info
```

---

## 🌐 Data Flow Diagram

```
┌──────────┐     HTTPS      ┌──────────┐    AWS SDK     ┌──────────┐
│          │  ────────────> │          │  ────────────> │          │
│  React   │                │  Render  │                │   AWS    │
│ Frontend │                │ Express  │                │ us-east-1│
│          │  <──────────── │  Server  │  <──────────── │          │
└──────────┘     JSON       └──────────┘     JSON       └──────────┘
                Response                     Response

User Actions:
• Register/Login
• Log glucose
• Analyze food
• Get recommendations
• View patterns
• View dashboard
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: HTTPS/TLS                                         │
│  • All traffic encrypted in transit                         │
│  • Automatic SSL certificates (Render + AWS)               │
│                                                              │
│  Layer 2: JWT Authentication                                │
│  • Cognito-issued JWT tokens                                │
│  • Token validation on every request                        │
│  • 1-hour token expiration                                  │
│                                                              │
│  Layer 3: AWS IAM                                           │
│  • Least privilege access                                   │
│  • kiro-agent IAM user with specific permissions           │
│  • No root account credentials used                         │
│                                                              │
│  Layer 4: Encryption at Rest                                │
│  • KMS encryption for all DynamoDB tables                   │
│  • KMS encryption for all S3 buckets                        │
│  • Secrets Manager for sensitive data                       │
│                                                              │
│  Layer 5: Environment Variables                             │
│  • No secrets in code                                       │
│  • All credentials in Render environment variables         │
│  • Separate dev/staging/prod environments                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 Cost Breakdown

### Monthly Costs:

| Service | Cost | Notes |
|---------|------|-------|
| **Render Free Tier** | $0 | With cold starts |
| **AWS Cognito** | $0 | Free tier: 50,000 MAUs |
| **AWS DynamoDB** | $0-1 | Pay-per-request, likely free tier |
| **AWS S3** | $0-1 | Standard storage, likely free tier |
| **AWS Secrets Manager** | $2.80 | 7 secrets × $0.40/month |
| **AWS KMS** | $1.00 | 1 key × $1/month |
| **AWS Bedrock** | $0-5 | Pay-per-use (minimal for dev) |
| **AWS API Gateway** | $0 | Not used (Render instead) |
| **AWS Lambda** | $0 | Not used (Render instead) |
| **TOTAL** | **~$4-10/month** | Mostly Secrets Manager + KMS |

### If You Upgrade Render:

| Plan | Cost | Benefits |
|------|------|----------|
| **Free** | $0 | Cold starts after 15 min |
| **Starter** | $7 | No cold starts, 512MB RAM |
| **Standard** | $25 | No cold starts, 2GB RAM |

---

## 🚀 Deployment Options Comparison

### Option 1: Render + AWS (Current Choice) ⭐

**Pros:**
- ✅ FREE hosting (Render free tier)
- ✅ Easy deployment (no DevOps needed)
- ✅ Auto-deploy on git push
- ✅ Automatic SSL
- ✅ Built-in monitoring

**Cons:**
- ⚠️ Cold starts after 15 min inactivity
- ⚠️ 512MB RAM limit
- ⚠️ Shared CPU

**Best for:** Development, testing, demos, low-traffic apps

---

### Option 2: AWS Lambda + API Gateway (Already Deployed)

**Pros:**
- ✅ Serverless (auto-scaling)
- ✅ Pay only for requests
- ✅ No cold starts (with provisioned concurrency)
- ✅ Already deployed!

**Cons:**
- ❌ More complex setup
- ❌ Higher cost for high traffic
- ❌ 15-minute timeout limit

**Best for:** Production, high-traffic, variable workloads

---

### Option 3: AWS EC2 (Not Deployed)

**Pros:**
- ✅ Full control
- ✅ No cold starts
- ✅ Predictable pricing

**Cons:**
- ❌ Requires DevOps knowledge
- ❌ Manual scaling
- ❌ Higher cost (~$15-30/month)

**Best for:** Large-scale production, custom requirements

---

## 📊 Performance Metrics

### Expected Latency:

| Route | Cold Start | Warm |
|-------|-----------|------|
| Render → AWS us-east-1 | ~30s (first request) | ~100-200ms |
| Frontend → Render | - | ~50-100ms |
| **Total (Cold)** | **~30s** | - |
| **Total (Warm)** | - | **~150-300ms** |

### Throughput:

- **Render Free Tier**: ~100 requests/second (shared CPU)
- **AWS DynamoDB**: 25 WCU/RCU (free tier), then unlimited
- **AWS S3**: Unlimited

---

## 🎯 Recommended Setup

### For Development (Current):
```
React Frontend (localhost:3000)
    ↓
Render Express.js (FREE)
    ↓
AWS us-east-1 Resources
```

### For Production (Future):
```
React Frontend (Vercel/Netlify)
    ↓
Render Express.js (Starter $7/month)
    ↓
AWS us-east-1 Resources
    ↓
CloudFront CDN (optional)
```

---

## ✅ Deployment Checklist

- [ ] AWS resources deployed in us-east-1
- [ ] AWS credentials obtained (Access Key + Secret)
- [ ] Render account created
- [ ] Repository connected to Render
- [ ] Service configured (Docker, Free tier, `local-server` root)
- [ ] Environment variables added (AWS, Cognito, DynamoDB, S3)
- [ ] Service deployed successfully
- [ ] Health endpoint tested
- [ ] API endpoints tested
- [ ] Frontend configured with Render URL
- [ ] End-to-end flow tested
- [ ] (Optional) UptimeRobot configured

---

**Ready to deploy? Follow the step-by-step guide in `RENDER_DEPLOYMENT_STEP_BY_STEP.md`!** 🚀
