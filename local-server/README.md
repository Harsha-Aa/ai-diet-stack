# Local Development Server

This Express server simulates AWS Lambda functions and API Gateway for local development.

## Features

- ✅ Mock AWS Cognito authentication
- ✅ In-memory data storage (no database required)
- ✅ All API endpoints from the production app
- ✅ CORS enabled for frontend development
- ✅ Request/response logging
- ✅ JWT token simulation

## Quick Start

```bash
npm install
npm start
```

Server runs on http://localhost:3001

## Available Endpoints

### Health Check
- `GET /health` - Server status

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (requires auth)

### Glucose Tracking
- `POST /glucose/readings` - Create glucose reading (requires auth)
- `GET /glucose/readings` - Get user's readings (requires auth)

### Food Logging
- `POST /food/analyze-text` - Analyze food description (requires auth)

### Analytics
- `GET /analytics/dashboard` - Get dashboard data (requires auth)

## Authentication

The server uses a simple Base64-encoded JWT simulation:

1. **Register** or **Login** to get a token
2. Include token in requests: `Authorization: Bearer <token>`
3. Token contains: `{ userId, email, diabetesType, tier }`

## Data Storage

All data is stored in-memory using JavaScript Maps:
- `mockUsers` - User credentials
- `mockUserProfiles` - User profiles
- `mockGlucoseReadings` - Glucose readings
- `mockFoodLogs` - Food logs

**Note**: Data is lost when server restarts.

## Environment Variables

No environment variables required. All AWS services are mocked.

## Development

### Add New Endpoint

```typescript
app.post('/your-endpoint', async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error message' }
    });
  }
});
```

### Add Authentication

```typescript
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Missing auth token' }
  });
}

const token = authHeader.substring(7);
const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
// Use decoded.userId, decoded.email, etc.
```

## Testing

### Using curl

```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","age":30,"weight_kg":70,"height_cm":170,"diabetes_type":"type2"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create reading (replace TOKEN)
curl -X POST http://localhost:3001/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"reading_value":120,"reading_unit":"mg/dL"}'
```

### Using Postman

1. Import endpoints from documentation
2. Set base URL: `http://localhost:3001`
3. Add Authorization header with Bearer token

## Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Module Not Found

```bash
npm install
```

### TypeScript Errors

```bash
npm install -g ts-node
```

## Production vs Local

| Feature | Local Server | Production (AWS) |
|---------|-------------|------------------|
| Authentication | Mock JWT | AWS Cognito |
| Database | In-memory | DynamoDB |
| AI Analysis | Mock responses | Amazon Bedrock |
| File Storage | Not available | S3 |
| Email | Not available | SES |

## Next Steps

- See [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) for full guide
- Check [API documentation](../LOCAL_DEVELOPMENT.md#-available-api-endpoints)
- Review [troubleshooting](../LOCAL_DEVELOPMENT.md#-troubleshooting)
