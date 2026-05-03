# Backend Fix & Integration Plan

## Current Situation

**Problem**: Backend is using in-memory mock data instead of real AWS services
- ❌ No DynamoDB integration - data lost on server restart
- ❌ No S3 integration - file uploads not persisted
- ❌ No Cognito integration - fake authentication
- ❌ No Bedrock/Rekognition integration - no real AI features
- ❌ Missing GET endpoints for meal recommendations and pattern analysis
- ❌ No proper error handling for AWS service failures

**What's Actually Working**:
- ✅ Express server structure
- ✅ Basic routing and middleware
- ✅ Mock data endpoints (temporary)
- ✅ Frontend UI components

---

## Phase 1: AWS Infrastructure Setup (Priority: CRITICAL)

### Step 1.1: Configure AWS SDK and Credentials
**File**: `local-server/src/config/aws.ts`
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { RekognitionClient } from '@aws-sdk/client-rekognition';

export const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ... similar for other services
```

### Step 1.2: Environment Variables
**File**: `local-server/.env`
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from cdk-outputs.json>
AWS_SECRET_ACCESS_KEY=<from cdk-outputs.json>

# Cognito
COGNITO_USER_POOL_ID=us-east-1_mzKjA4m2a
COGNITO_CLIENT_ID=59kkpi3ujptbngvp8im8sft1mi

# DynamoDB Tables
DYNAMODB_USERS_TABLE=dev-ai-diet-Users
DYNAMODB_GLUCOSE_TABLE=dev-ai-diet-GlucoseReadings
DYNAMODB_FOOD_LOGS_TABLE=dev-ai-diet-FoodLogs
DYNAMODB_USAGE_TRACKING_TABLE=dev-ai-diet-UsageTracking
DYNAMODB_AI_INSIGHTS_TABLE=dev-ai-diet-AIInsights

# S3 Buckets
S3_FOOD_IMAGES_BUCKET=dev-ai-diet-food-images-<account-id>
S3_REPORTS_BUCKET=dev-ai-diet-reports-<account-id>
S3_GLUCOSE_UPLOADS_BUCKET=dev-ai-diet-glucose-uploads-<account-id>

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

---

## Phase 2: Replace Mock Data with Real AWS Services

### Priority 1: Authentication (Cognito)
**Files to Update**:
- `local-server/server.js` → Replace mock user storage with Cognito
- Endpoints: `/auth/register`, `/auth/login`, `/auth/profile`

**Changes**:
1. Use `CognitoIdentityProviderClient.signUp()` for registration
2. Use `CognitoIdentityProviderClient.initiateAuth()` for login
3. Store user profiles in DynamoDB Users table
4. Verify JWT tokens with Cognito

### Priority 2: Glucose Readings (DynamoDB)
**Files to Update**:
- `local-server/server.js` → Replace mockGlucoseReadings Map with DynamoDB
- Endpoints: `/glucose/readings` (POST, GET)

**Changes**:
1. Use `DynamoDBDocumentClient.put()` to store readings
2. Use `DynamoDBDocumentClient.query()` to retrieve readings
3. Implement proper error handling for DynamoDB failures

### Priority 3: Dashboard Analytics (DynamoDB)
**Files to Update**:
- `local-server/server.js` → Query real glucose data from DynamoDB
- Endpoint: `/analytics/dashboard`

**Changes**:
1. Query GlucoseReadings table for user's data
2. Calculate eA1C and TIR from real data
3. Handle cases with no data gracefully

### Priority 4: Food Logging (S3 + Bedrock)
**Files to Update**:
- `local-server/server.js` → Integrate S3 for images, Bedrock for analysis
- Endpoints: `/food/analyze-text`, `/food/upload-image`, `/food/recognize`

**Changes**:
1. Upload food images to S3
2. Call Bedrock for nutrient analysis
3. Store food logs in DynamoDB

### Priority 5: AI Features (Bedrock)
**Files to Update**:
- `local-server/server.js` → Integrate Bedrock for AI features
- Endpoints: `/ai/recommend-meal`, `/ai/analyze-patterns`, `/ai/predict-glucose`

**Changes**:
1. Call Bedrock with proper prompts
2. Parse AI responses
3. Store insights in DynamoDB

---

## Phase 3: Add Missing GET Endpoints

### Missing Endpoint 1: GET /ai/meal-recommendations
**Purpose**: Retrieve previously generated meal recommendations

```javascript
app.get('/ai/meal-recommendations', authMiddleware, async (req, res) => {
  // Query AIInsights table for user's meal recommendations
  // Filter by type: 'meal_recommendation'
  // Return list of recommendations with timestamps
});
```

### Missing Endpoint 2: GET /ai/pattern-analysis
**Purpose**: Retrieve previously generated pattern analyses

```javascript
app.get('/ai/pattern-analysis', authMiddleware, async (req, res) => {
  // Query AIInsights table for user's pattern analyses
  // Filter by type: 'pattern_analysis'
  // Return list of analyses with timestamps
});
```

### Missing Endpoint 3: GET /ai/glucose-predictions
**Purpose**: Retrieve previously generated glucose predictions

```javascript
app.get('/ai/glucose-predictions', authMiddleware, async (req, res) => {
  // Query AIInsights table for user's predictions
  // Filter by type: 'glucose_prediction'
  // Return list of predictions with timestamps
});
```

---

## Phase 4: Testing & Verification

### Test Plan
1. **Unit Tests**: Test each service function independently
2. **Integration Tests**: Test AWS service interactions
3. **End-to-End Tests**: Test complete user flows
4. **Manual Testing**: Verify each endpoint with Postman/curl

### Verification Checklist
- [ ] User can register with Cognito
- [ ] User can login and receive JWT token
- [ ] Glucose readings are stored in DynamoDB
- [ ] Dashboard loads data from DynamoDB
- [ ] Food images are uploaded to S3
- [ ] Bedrock returns meal recommendations
- [ ] Pattern analysis works with real data
- [ ] Usage limits are tracked in DynamoDB
- [ ] All GET endpoints return data
- [ ] Error handling works for AWS failures

---

## Phase 5: Deployment

### Update Render Environment Variables
Add all AWS credentials and resource IDs to Render dashboard

### Deploy to Render
```bash
git add .
git commit -m "Integrate real AWS services"
git push origin main
```

### Monitor Deployment
- Check Render logs for errors
- Test all endpoints after deployment
- Verify data persistence

---

## Estimated Timeline

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| Phase 1: AWS Setup | Configure SDK, env vars | 1-2 hours |
| Phase 2: Replace Mock Data | Integrate all AWS services | 8-12 hours |
| Phase 3: Add GET Endpoints | Create missing endpoints | 2-3 hours |
| Phase 4: Testing | Write and run tests | 4-6 hours |
| Phase 5: Deployment | Deploy and verify | 1-2 hours |
| **Total** | | **16-25 hours** |

---

## Next Steps

1. **Immediate**: Set up AWS credentials in local-server/.env
2. **Priority 1**: Integrate Cognito for authentication
3. **Priority 2**: Integrate DynamoDB for glucose readings
4. **Priority 3**: Integrate Bedrock for AI features
5. **Priority 4**: Add missing GET endpoints
6. **Priority 5**: Test everything thoroughly
7. **Final**: Deploy to Render with AWS credentials

---

## Resources Needed

- AWS credentials from `cdk-outputs.json`
- DynamoDB table names from CDK deployment
- S3 bucket names from CDK deployment
- Cognito User Pool ID and Client ID
- Bedrock model access in us-east-1

