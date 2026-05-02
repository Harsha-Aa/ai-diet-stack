# Local Development Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Local Development Setup                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐                    ┌──────────────────┐
│                  │                    │                  │
│   React Frontend │◄──────HTTP────────►│  Express Server  │
│   (Port 3000)    │                    │   (Port 3001)    │
│                  │                    │                  │
└──────────────────┘                    └──────────────────┘
        │                                        │
        │                                        │
        ▼                                        ▼
┌──────────────────┐                    ┌──────────────────┐
│  Browser         │                    │  In-Memory Store │
│  - UI Components │                    │  - Users         │
│  - State Mgmt    │                    │  - Profiles      │
│  - API Calls     │                    │  - Glucose Data  │
│                  │                    │  - Food Logs     │
└──────────────────┘                    └──────────────────┘
```

## Request Flow

### 1. User Registration

```
User (Browser)
    │
    │ 1. Fill registration form
    ▼
React Frontend (localhost:3000)
    │
    │ 2. POST /auth/register
    │    { email, password, age, weight, height, diabetes_type }
    ▼
Express Server (localhost:3001)
    │
    │ 3. Validate input
    │ 4. Check if user exists
    │ 5. Calculate BMI
    │ 6. Store in mockUsers Map
    │ 7. Store in mockUserProfiles Map
    ▼
Response
    │
    │ { success: true, data: { userId, email, tier } }
    ▼
React Frontend
    │
    │ 8. Show success message
    │ 9. Redirect to login
    ▼
User sees confirmation
```

### 2. User Login

```
User (Browser)
    │
    │ 1. Enter email & password
    ▼
React Frontend
    │
    │ 2. POST /auth/login
    │    { email, password }
    ▼
Express Server
    │
    │ 3. Validate credentials
    │ 4. Generate mock JWT token (Base64)
    │ 5. Return tokens
    ▼
Response
    │
    │ { access_token, refresh_token, expires_in }
    ▼
React Frontend
    │
    │ 6. Store token in localStorage
    │ 7. Set Authorization header
    │ 8. Redirect to dashboard
    ▼
User sees dashboard
```

### 3. Create Glucose Reading

```
User (Browser)
    │
    │ 1. Enter glucose value
    ▼
React Frontend
    │
    │ 2. POST /glucose/readings
    │    Headers: { Authorization: Bearer <token> }
    │    Body: { reading_value, reading_unit, notes }
    ▼
Express Server
    │
    │ 3. Decode JWT token
    │ 4. Extract userId
    │ 5. Validate glucose value (20-600)
    │ 6. Classify reading (Low/In-Range/High)
    │ 7. Store in mockGlucoseReadings Map
    ▼
Response
    │
    │ { success: true, data: { reading, target_range } }
    ▼
React Frontend
    │
    │ 8. Update UI
    │ 9. Show success notification
    ▼
User sees new reading in list
```

### 4. Analyze Food

```
User (Browser)
    │
    │ 1. Enter food description
    ▼
React Frontend
    │
    │ 2. POST /food/analyze-text
    │    Headers: { Authorization: Bearer <token> }
    │    Body: { food_description }
    ▼
Express Server
    │
    │ 3. Decode JWT token
    │ 4. Extract userId
    │ 5. Generate mock nutrient data
    │ 6. Create food log entry
    │ 7. Store in mockFoodLogs Map
    ▼
Response
    │
    │ { success: true, data: { food_items, total_nutrients } }
    ▼
React Frontend
    │
    │ 8. Display nutrient breakdown
    │ 9. Show confidence score
    ▼
User sees nutrient analysis
```

## Data Storage

### In-Memory Maps

```javascript
// User credentials
mockUsers = Map {
  "user@example.com" => {
    userId: "user-1234567890",
    email: "user@example.com",
    password: "hashed_password",
    age: 35,
    weight_kg: 75,
    height_cm: 175,
    diabetes_type: "type2",
    bmi: 24.5,
    tier: "free",
    createdAt: "2024-01-01T00:00:00.000Z"
  }
}

// User profiles
mockUserProfiles = Map {
  "user-1234567890" => {
    userId: "user-1234567890",
    email: "user@example.com",
    diabetesType: "type2",
    age: 35,
    weight: 75,
    height: 175,
    bmi: 24.5,
    tier: "free",
    targetGlucoseMin: 70,
    targetGlucoseMax: 180,
    createdAt: "2024-01-01T00:00:00.000Z"
  }
}

// Glucose readings
mockGlucoseReadings = Map {
  "user-1234567890-2024-01-01T08:00:00.000Z" => {
    user_id: "user-1234567890",
    timestamp: "2024-01-01T08:00:00.000Z",
    date: "2024-01-01",
    reading_value: 120,
    reading_unit: "mg/dL",
    reading_value_mgdl: 120,
    classification: "In-Range",
    source: "manual",
    notes: "Before breakfast",
    meal_context: "fasting",
    created_at: "2024-01-01T08:00:00.000Z"
  }
}

// Food logs
mockFoodLogs = Map {
  "log-1234567890" => {
    user_id: "user-1234567890",
    log_id: "log-1234567890",
    timestamp: "2024-01-01T12:00:00.000Z",
    food_items: [
      {
        name: "Grilled chicken breast",
        portion_size: "1 serving",
        nutrients: {
          carbs_g: 0,
          protein_g: 30,
          fat_g: 5,
          calories: 165,
          fiber_g: 0
        }
      }
    ],
    total_nutrients: { /* aggregated */ },
    source: "text",
    raw_input: "grilled chicken breast",
    created_at: "2024-01-01T12:00:00.000Z"
  }
}
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Token Simulation                      │
└─────────────────────────────────────────────────────────────┘

1. User logs in
   ↓
2. Server creates token payload:
   {
     userId: "user-1234567890",
     email: "user@example.com",
     diabetesType: "type2",
     tier: "free"
   }
   ↓
3. Server encodes to Base64:
   eyJ1c2VySWQiOiJ1c2VyLTEyMzQ1Njc4OTAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ==
   ↓
4. Client stores in localStorage
   ↓
5. Client includes in requests:
   Authorization: Bearer eyJ1c2VySWQiOiJ1c2VyLTEyMzQ1Njc4OTAi...
   ↓
6. Server decodes Base64:
   Buffer.from(token, 'base64').toString()
   ↓
7. Server parses JSON:
   JSON.parse(decoded)
   ↓
8. Server uses userId for data access
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Comparison: Local vs Production

| Component | Local | Production (AWS) |
|-----------|-------|------------------|
| **Frontend** | React Dev Server (3000) | S3 + CloudFront |
| **Backend** | Express Server (3001) | API Gateway + Lambda |
| **Auth** | Mock JWT (Base64) | AWS Cognito |
| **Database** | In-Memory Maps | DynamoDB |
| **AI** | Mock Responses | Amazon Bedrock |
| **Storage** | Not Available | S3 |
| **Email** | Not Available | SES |
| **Logging** | Console | CloudWatch |
| **Monitoring** | None | CloudWatch + X-Ray |

## Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Cycle                         │
└─────────────────────────────────────────────────────────────┘

1. Start local servers
   npm run dev
   ↓
2. Make code changes
   - Edit Lambda functions in src/
   - Edit React components in frontend/src/
   ↓
3. Test locally
   - Frontend auto-reloads
   - Backend requires restart
   ↓
4. Verify functionality
   - Use browser DevTools
   - Check server logs
   ↓
5. Build for production
   npm run build
   ↓
6. Deploy to AWS
   npm run cdk:deploy
   ↓
7. Test in production
   - Update frontend .env
   - Deploy frontend
```

## Port Configuration

```
┌──────────────────────────────────────────────────────────┐
│                    Port Allocation                        │
└──────────────────────────────────────────────────────────┘

Port 3000: React Frontend
  - Development server
  - Hot module replacement
  - Webpack dev server

Port 3001: Express Backend
  - API endpoints
  - Mock AWS services
  - In-memory data store

Port 3002+: Available for additional services
  - Database (if added)
  - Redis (if added)
  - Other microservices
```

## Security Notes

⚠️ **Local Development Only**

- Mock JWT tokens are NOT secure
- No password hashing
- No rate limiting
- No input sanitization
- CORS allows all origins
- No HTTPS

**Never use this setup in production!**

## Next Steps

1. Read [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for setup
2. Check [QUICK_START_LOCAL.md](QUICK_START_LOCAL.md) for quick start
3. Review [LOCAL_SETUP_SUMMARY.md](LOCAL_SETUP_SUMMARY.md) for overview
