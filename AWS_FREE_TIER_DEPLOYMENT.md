# 🎉 Deploy for FREE with AWS Free Tier!

## Save $300-500 in Your First Year

AWS Free Tier provides **12 months of FREE hosting** for your Express.js API server, making it the most cost-effective option for startups and MVPs.

---

## 💰 Cost Breakdown

### First 12 Months (with AWS Free Tier)

| Service | Free Tier Benefit | Cost |
|---------|------------------|------|
| **EC2 (t2.micro)** | 750 hours/month | **$0** ✅ |
| **DynamoDB** | 25GB storage + 25 RCU/WCU | **$0** ✅ |
| **S3** | 5GB storage + 20K GET + 2K PUT | **$0** ✅ |
| **Cognito** | 50,000 MAU | **$0** ✅ (always free) |
| **Data Transfer** | 100GB outbound/month | **$0** ✅ |
| **Bedrock (AI)** | Pay per use | **$10-15** ⚠️ |
| **Total** | | **$10-15/month** |

**Savings**: $300-500 compared to paid hosting platforms!

### After Free Tier Expires (Month 13+)

| Service | Cost |
|---------|------|
| EC2 (t3.small) | $15/month |
| DynamoDB | $5-10/month |
| S3 | $2-5/month |
| Cognito | $0 (always free) |
| Bedrock | $10-50/month |
| Load Balancer | $16/month (optional) |
| **Total** | **$48-96/month** |

---

## 🎯 What's Included in AWS Free Tier?

### EC2 (Compute)
- **750 hours/month** of t2.micro instance
- **1 vCPU, 1GB RAM**
- Runs 24/7 for entire month (744 hours)
- Linux or Windows
- **Valid for 12 months**

### DynamoDB (Database)
- **25GB storage**
- **25 provisioned Write Capacity Units (WCU)**
- **25 provisioned Read Capacity Units (RCU)**
- Enough for thousands of users
- **Valid for 12 months**

### S3 (Storage)
- **5GB standard storage**
- **20,000 GET requests**
- **2,000 PUT requests**
- Perfect for food images and reports
- **Valid for 12 months**

### Cognito (Authentication)
- **50,000 monthly active users (MAU)**
- Unlimited sign-ups
- **Always FREE** (not just 12 months!)

### Data Transfer
- **100GB outbound per month**
- Inbound data transfer is always free
- **Valid for 12 months**

---

## ⚠️ Important Limitations

### t2.micro Specifications
- **1 vCPU, 1GB RAM**
- **Burstable performance** (CPU credits)
- Good for: MVP, testing, low-moderate traffic
- May struggle with: High traffic, heavy AI workloads, many concurrent users

### When to Upgrade from t2.micro

Upgrade to t3.small ($15/month) if you experience:
- ❌ Slow response times (>3 seconds)
- ❌ High CPU usage (>80% sustained)
- ❌ Memory issues (OOM errors)
- ❌ More than 100 concurrent users
- ❌ Frequent AI requests (>1000/day)

### Not Included in Free Tier
- ⚠️ **Bedrock (AI)**: Pay per use (~$10-50/month depending on usage)
- ⚠️ **Application Load Balancer**: ~$16/month (optional, for high availability)
- ⚠️ **Elastic IP** (if stopped): $0.005/hour when instance is stopped
- ⚠️ **Data transfer >100GB**: $0.09/GB

---

## 🚀 Quick Start: Deploy to AWS Free Tier

### Prerequisites
- AWS account (new accounts get 12 months free tier)
- AWS CLI installed (optional)
- SSH key pair

### Step 1: Launch EC2 Instance

1. Go to **AWS Console** → **EC2** → **Launch Instance**

2. Configure:
   ```
   Name: ai-diet-api-server
   AMI: Amazon Linux 2023 (Free tier eligible)
   Instance Type: t2.micro (Free tier eligible) ✅
   Key Pair: Create or select existing
   ```

3. Security Group:
   ```
   - SSH (22): Your IP
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
   - Custom TCP (3000): 0.0.0.0/0 (temporary)
   ```

4. Storage: **8GB gp3** (Free tier: up to 30GB)

5. Click **Launch Instance**

### Step 2: Connect to Instance

```bash
# Get instance public IP from AWS Console
ssh -i your-key.pem ec2-user@<instance-public-ip>
```

### Step 3: Install Docker

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -a -G docker ec2-user

# Log out and back in for group changes
exit
ssh -i your-key.pem ec2-user@<instance-public-ip>
```

### Step 4: Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### Step 5: Clone Repository

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo/local-server
```

### Step 6: Configure Environment

```bash
# Create .env file
nano .env
```

Add your AWS credentials and configuration:
```env
NODE_ENV=production
PORT=3000
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id
DYNAMODB_USERS_TABLE=Users
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings
DYNAMODB_FOOD_TABLE=FoodLogs
DYNAMODB_USAGE_TABLE=UsageTracking
DYNAMODB_ACTIVITY_TABLE=ActivityLogs
DYNAMODB_AI_INSIGHTS_TABLE=AIInsights
S3_FOOD_IMAGES_BUCKET=your_bucket_name
S3_REPORTS_BUCKET=your_bucket_name
S3_GLUCOSE_FILES_BUCKET=your_bucket_name
```

### Step 7: Deploy with Docker

```bash
# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:3000/health
```

### Step 8: Set Up Nginx (Optional but Recommended)

```bash
# Install Nginx
sudo yum install -y nginx

# Create config
sudo nano /etc/nginx/conf.d/api.conf
```

Add configuration:
```nginx
upstream api_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Start Nginx:
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 9: Test Deployment

```bash
# Get instance public IP
curl http://<instance-public-ip>/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":123.45}
```

---

## 📊 Performance Expectations (t2.micro)

### What t2.micro Can Handle

✅ **Good for**:
- MVP and testing
- 10-50 concurrent users
- 100-500 requests/hour
- Small to medium datasets
- Development and staging environments

⚠️ **May struggle with**:
- 100+ concurrent users
- 1000+ requests/hour
- Heavy AI workloads (many Bedrock calls)
- Large file uploads
- Complex analytics queries

### Optimization Tips for t2.micro

1. **Enable PM2 Clustering**: Use all available CPU cores
2. **Implement Caching**: Reduce database queries
3. **Optimize Images**: Compress before upload
4. **Rate Limiting**: Prevent abuse
5. **Monitor CPU Credits**: Watch for credit exhaustion

---

## 🔍 Monitoring Your Free Tier Usage

### Check Free Tier Usage

1. Go to **AWS Console** → **Billing** → **Free Tier**
2. View usage for each service
3. Set up alerts when approaching limits

### Set Up Billing Alerts

1. Go to **CloudWatch** → **Alarms** → **Billing**
2. Create alarm for estimated charges
3. Set threshold: $20 (to catch unexpected charges)
4. Add email notification

### Monitor EC2 Instance

```bash
# Check CPU and memory
docker stats

# Check PM2 status
docker exec ai-diet-api pm2 status

# Check disk space
df -h

# Check logs
docker-compose logs --tail=100
```

---

## 💡 Cost Optimization Tips

### Stay Within Free Tier

1. **Use t2.micro only**: Don't upgrade unless necessary
2. **Monitor usage**: Check billing dashboard weekly
3. **Stop when not needed**: Stop instance during development breaks
4. **Use on-demand DynamoDB**: Avoid provisioned capacity
5. **Optimize Bedrock calls**: Cache AI responses when possible

### Reduce Bedrock Costs

- **Cache responses**: Store common AI responses
- **Batch requests**: Combine multiple requests
- **Use cheaper models**: Claude Haiku instead of Sonnet when possible
- **Implement rate limiting**: Prevent abuse
- **Monitor usage**: Track AI request counts

### After Free Tier Expires

**Option 1**: Upgrade to t3.small on AWS ($48-96/month)
**Option 2**: Migrate to Render.com ($24-90/month)
**Option 3**: Migrate to Railway.app ($27-80/month)

---

## 🎯 Recommended Strategy

### Months 1-12 (Free Tier)
1. Deploy to AWS EC2 t2.micro (**$0-15/month**)
2. Use free tier for all AWS services
3. Only pay for Bedrock usage
4. Save $300-500 compared to paid platforms
5. Learn AWS ecosystem

### Month 12 (Before Expiry)
1. Evaluate traffic and usage
2. Decide: Stay on AWS or migrate?
3. If staying: Upgrade to t3.small
4. If migrating: Move to Render/Railway

### Months 13+ (After Free Tier)
**If staying on AWS**:
- Upgrade to t3.small ($15/month)
- Continue with DynamoDB, S3, Cognito
- Total: $48-96/month

**If migrating**:
- Move to Render.com ($24-90/month)
- Or Railway.app ($27-80/month)
- Keep AWS services (DynamoDB, S3, Cognito)

---

## 🚨 Common Pitfalls to Avoid

### 1. Exceeding Free Tier Limits
- ❌ Running multiple instances (only 1 t2.micro is free)
- ❌ Using t3.small instead of t2.micro
- ❌ Exceeding 750 hours/month (stop when not needed)
- ❌ Exceeding 100GB data transfer

### 2. Unexpected Charges
- ❌ Elastic IP when instance is stopped ($0.005/hour)
- ❌ EBS snapshots (not included in free tier)
- ❌ Application Load Balancer ($16/month)
- ❌ Data transfer >100GB

### 3. Performance Issues
- ❌ Not monitoring CPU credits
- ❌ Running too many services on t2.micro
- ❌ Not implementing caching
- ❌ Not optimizing database queries

---

## 📈 Scaling Path

### Phase 1: MVP (Months 1-3)
- **Instance**: t2.micro (free)
- **Users**: 10-50
- **Cost**: $10-15/month

### Phase 2: Growth (Months 4-12)
- **Instance**: t2.micro (free)
- **Users**: 50-100
- **Cost**: $10-20/month
- **Optimization**: Caching, rate limiting

### Phase 3: Scale (Month 13+)
- **Instance**: t3.small or t3.medium
- **Users**: 100-1000
- **Cost**: $48-96/month
- **Features**: Load balancer, auto-scaling

---

## 🎉 Summary

### Why AWS Free Tier is Best for Startups

✅ **$0 hosting** for first 12 months
✅ **Save $300-500** compared to paid platforms
✅ **Learn AWS ecosystem** for future scaling
✅ **Production-ready** infrastructure
✅ **Easy to upgrade** when needed

### Total Cost Comparison (First Year)

| Platform | Year 1 Cost | Savings vs AWS |
|----------|-------------|----------------|
| **AWS EC2 (Free Tier)** | **$120-180** | **$0** (baseline) |
| Render.com | $84-480 | -$36 to +$300 |
| Railway.app | $120-360 | $0 to +$180 |

**Winner**: AWS EC2 Free Tier saves you $300-500 in your first year!

---

## 📚 Next Steps

1. ✅ Create AWS account (if you don't have one)
2. ✅ Follow deployment guide above
3. ✅ Set up billing alerts
4. ✅ Monitor free tier usage
5. ✅ Deploy and test your API
6. ✅ Save money and build your MVP!

For detailed instructions, see:
- **`local-server/DEPLOYMENT_GUIDE.md`** - Complete deployment guide
- **`DEPLOYMENT_READY.md`** - Quick start guide

---

**Start building for FREE today!** 🚀
