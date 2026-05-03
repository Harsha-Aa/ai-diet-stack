# Deployment Verification Checklist

## Pre-Deployment Checklist ✅

- ✅ AWS credentials added to Render environment variables
- ✅ TypeScript compilation added to build script
- ✅ Code pushed to GitHub
- ✅ Render auto-deployment triggered

---

## Wait for Deployment

**Expected Time**: 2-3 minutes

**Check Render Dashboard**:
1. Go to https://dashboard.render.com/
2. Click on **ai-diet-api** service
3. Click on **Events** tab
4. Wait for "Deploy live" message

**Watch Logs**:
1. Click on **Logs** tab
2. Look for these messages:
   ```
   ==> Running 'npm start'
   > npm run build && node server.js
   > tsc
   ✅ AWS SDK configured for region: us-east-1
   ✅ AWS credentials: Configured
   Server running on port 3001
   AWS Integration: ENABLED
   ```

---

## Post-Deployment Tests

### Test 1: Health Check ✅
```bash
curl https://ai-diet-api.onrender.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-03T...",
  "environment": "production",
  "aws_integration": "enabled",
  "version": "2.0.0"
}
```

**✅ Pass Criteria**: 
- `aws_integration` is "enabled"
- `environment` is "production" (not "local")
- Status code is 200

---

### Test 2: User Registration ✅
```bash
curl -X POST https://ai-diet-api.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@example.com",
    "password": "Test123!",
    "age": 30,
    "weight_kg": 70,
    "height_cm": 170,
    "diabetes_type": "type2"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "test-...@example.com",
    "subscriptionTier": "free",
    "message": "Registration successful"
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- `userId` is a UUID (not "user-" + timestamp)
- Status code is 201

**❌ Fail Scenarios**:
- Error: "User already exists" → Use different email
- Error: "AWS credentials not configured" → Check Render env vars
- Error: "Table not found" → Check DynamoDB table names

---

### Test 3: User Login ✅
```bash
curl -X POST https://ai-diet-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_EMAIL_FROM_TEST2",
    "password": "Test123!"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "test-...@example.com",
    "accessToken": "eyJraWQiOiJ...",
    "refreshToken": "eyJjdHkiOiJ...",
    "idToken": "eyJraWQiOiJ...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- `accessToken` starts with "eyJ" (JWT format)
- `expiresIn` is 3600 (1 hour)
- Status code is 200

**Save the accessToken for next tests!**

---

### Test 4: Get User Profile ✅
```bash
curl https://ai-diet-api.onrender.com/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "test-...@example.com",
    "diabetesType": "type2",
    "age": 30,
    "weight": 70,
    "height": 170,
    "bmi": 24.2,
    "tier": "free",
    "targetGlucoseMin": 70,
    "targetGlucoseMax": 180,
    "createdAt": "2026-05-03T...",
    "updatedAt": "2026-05-03T..."
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- Profile data matches registration data
- Status code is 200

---

### Test 5: Log Glucose Reading ✅
```bash
curl -X POST https://ai-diet-api.onrender.com/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "reading_value": 120,
    "reading_unit": "mg/dL",
    "meal_context": "fasting",
    "notes": "Morning reading"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "reading": {
      "user_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "timestamp": "2026-05-03T...",
      "reading_value": 120,
      "reading_unit": "mg/dL",
      "classification": "in_range",
      "source": "manual",
      "meal_context": "fasting",
      "notes": "Morning reading",
      "created_at": "2026-05-03T..."
    },
    "target_range": {
      "min": 70,
      "max": 180
    }
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- `classification` is "in_range" (120 is between 70-180)
- Status code is 201

---

### Test 6: Get Glucose Readings ✅
```bash
curl https://ai-diet-api.onrender.com/glucose/readings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "readings": [
      {
        "user_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "timestamp": "2026-05-03T...",
        "reading_value_mgdl": 120,
        "reading_unit": "mg/dL",
        "classification": "in_range",
        "source": "manual",
        "meal_context": "fasting",
        "notes": "Morning reading",
        "created_at": "2026-05-03T..."
      }
    ],
    "count": 1
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- `readings` array contains the reading from Test 5
- `count` matches array length
- Status code is 200

---

### Test 7: Dashboard Analytics ✅
```bash
curl https://ai-diet-api.onrender.com/analytics/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "ea1c": 5.8,
    "time_in_range": {
      "tir_7d": {
        "percentage": 100,
        "hours_in_range": 0.01,
        "hours_above_range": 0,
        "hours_below_range": 0
      },
      "tir_14d": { ... },
      "tir_30d": { ... }
    },
    "average_glucose": 120,
    "glucose_variability": 0,
    "trends": [
      {
        "date": "2026-05-03",
        "average_value": 120,
        "min_value": 120,
        "max_value": 120,
        "reading_count": 1
      }
    ],
    "data_completeness": 3.3,
    "days_of_data": 30,
    "total_readings": 1,
    "insufficient_data": true,
    "message": "Insufficient data for full analytics. Add more glucose readings."
  }
}
```

**✅ Pass Criteria**:
- `success` is true
- `average_glucose` matches your reading (120)
- `total_readings` is 1
- `insufficient_data` is true (need 14+ readings)
- Status code is 200

---

### Test 8: Pattern Analysis ⚠️
```bash
curl -X POST https://ai-diet-api.onrender.com/ai/analyze-patterns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "analysis_period_days": 30
  }'
```

**Expected Response** (with insufficient data):
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "At least 14 glucose readings required for pattern analysis"
  }
}
```

**✅ Pass Criteria**:
- Error message indicates insufficient data
- Status code is 400

**Note**: This is expected with only 1 reading. Add 14+ readings to test pattern analysis.

---

## Verification Summary

| Test | Endpoint | Expected Result | Status |
|------|----------|-----------------|--------|
| 1 | GET /health | AWS integration enabled | ⏳ |
| 2 | POST /auth/register | User created in Cognito + DynamoDB | ⏳ |
| 3 | POST /auth/login | JWT token returned | ⏳ |
| 4 | GET /auth/profile | Profile from DynamoDB | ⏳ |
| 5 | POST /glucose/readings | Reading stored in DynamoDB | ⏳ |
| 6 | GET /glucose/readings | Readings from DynamoDB | ⏳ |
| 7 | GET /analytics/dashboard | Analytics from real data | ⏳ |
| 8 | POST /ai/analyze-patterns | Insufficient data error | ⏳ |

---

## Troubleshooting

### Issue: "AWS credentials not configured"
**Solution**: 
1. Check Render environment variables
2. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set
3. Redeploy service

### Issue: "Token verification failed"
**Solution**:
1. Check COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID
2. Verify region is us-east-1
3. Try registering a new user

### Issue: "Table not found"
**Solution**:
1. Check all DYNAMODB_*_TABLE variables in Render
2. Verify table names match CDK deployment
3. Check AWS Console for table names

### Issue: "Build failed" in Render logs
**Solution**:
1. Check TypeScript compilation errors
2. Verify all dependencies are in package.json
3. Check tsconfig.json is valid

### Issue: Server still shows "local" environment
**Solution**:
1. Add NODE_ENV=production to Render env vars
2. Redeploy service

---

## Success Criteria

✅ **All tests pass**  
✅ **Data persists in DynamoDB** (check AWS Console)  
✅ **Users can register and login**  
✅ **Glucose readings are stored**  
✅ **Dashboard shows real analytics**  
✅ **JWT tokens are verified by Cognito**  

---

## Next Steps After Verification

1. **Test with Frontend**: Update frontend to use production backend
2. **Add More Readings**: Test with 14+ readings for pattern analysis
3. **Implement Phase 3**: Bedrock AI integration for food analysis
4. **Monitor Costs**: Check AWS billing dashboard
5. **Set Up Monitoring**: CloudWatch alarms for errors

---

**Deployment Status**: ⏳ Waiting for Render deployment  
**Estimated Time**: 2-3 minutes  
**Next Action**: Run verification tests after deployment completes
