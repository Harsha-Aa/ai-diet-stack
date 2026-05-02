# Local Development Guide

This guide explains how to run the entire application (backend + frontend) locally without deploying to AWS.

## 🎯 Overview

The local development setup includes:
- **Local Express Server** (Port 3001) - Simulates AWS Lambda functions and API Gateway
- **React Frontend** (Port 3000) - Web application UI
- **In-Memory Data Store** - No database required for local testing

## 📋 Prerequisites

- Node.js 18.x or later
- npm (comes with Node.js)

## 🚀 Quick Start

### Option 1: Run Everything Together (Recommended)

```bash
# Install dependencies and start both backend and frontend
npm run dev
```

This will:
1. Install local server dependencies
2. Start the backend server on http://localhost:3001
3. Start the frontend on http://localhost:3000
4. Open your browser automatically

### Option 2: Run Separately

**Terminal 1 - Backend Server:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

## 🔧 Manual Setup

If you prefer to set up step by step:

### 1. Install Backend Server Dependencies

```bash
cd local-server
npm install
cd ..
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Start Backend Server

```bash
cd local-server
npm start
```

Server will start on http://localhost:3001

### 4. Start Frontend (in a new terminal)

```bash
cd frontend
npm start
```

Frontend will start on http://localhost:3000

## 📡 Available API Endpoints

The local server provides these endpoints:

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (requires auth)

### Glucose Tracking
- `POST /glucose/readings` - Create glucose reading (requires auth)
- `GET /glucose/readings` - Get user's glucose readings (requires auth)

### Food Logging
- `POST /food/analyze-text` - Analyze food description (requires auth)

### Analytics
- `GET /analytics/dashboard` - Get dashboard analytics (requires auth)

## 🧪 Testing the Application

### 1. Register a New User

**Endpoint:** `POST http://localhost:3001/auth/register`

**Request Body:**
```json
{
  "email": "demo@example.com",
  "password": "SecurePassword123!",
  "age": 35,
  "weight_kg": 75,
  "height_cm": 175,
  "diabetes_type": "type2"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-1234567890",
    "email": "demo@example.com",
    "subscriptionTier": "free",
    "message": "Registration successful"
  }
}
```

### 2. Login

**Endpoint:** `POST http://localhost:3001/auth/login`

**Request Body:**
```json
{
  "email": "demo@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ1c2VySWQiOiJ1c2VyLTEyMzQ1Njc4OTAiLCJlbWFpbCI6ImRlbW9AZXhhbXBsZS5jb20ifQ==",
    "refresh_token": "refresh-eyJ1c2VySWQiOiJ1c2VyLTEyMzQ1Njc4OTAiLCJlbWFpbCI6ImRlbW9AZXhhbXBsZS5jb20ifQ==",
    "id_token": "eyJ1c2VySWQiOiJ1c2VyLTEyMzQ1Njc4OTAiLCJlbWFpbCI6ImRlbW9AZXhhbXBsZS5jb20ifQ==",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

### 3. Create Glucose Reading

**Endpoint:** `POST http://localhost:3001/glucose/readings`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reading_value": 120,
  "reading_unit": "mg/dL",
  "notes": "Before breakfast",
  "meal_context": "fasting"
}
```

### 4. Analyze Food

**Endpoint:** `POST http://localhost:3001/food/analyze-text`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "food_description": "2 scrambled eggs, 1 slice whole wheat toast, 1 cup orange juice"
}
```

## 🌐 Using the Frontend

1. Open http://localhost:3000 in your browser
2. Click "Register" to create a new account
3. Fill in the registration form:
   - Email: any valid email format
   - Password: at least 12 characters
   - Age, weight, height, diabetes type
4. After registration, login with your credentials
5. Explore the features:
   - **Dashboard**: View glucose statistics and charts
   - **Glucose Log**: Add new glucose readings
   - **Food Analyzer**: Analyze meals and track nutrition
   - **Profile**: View your profile and usage stats

## 🔍 Features Available Locally

### ✅ Working Features
- User registration and login
- Glucose reading creation and retrieval
- Food analysis (mock AI responses)
- Dashboard analytics
- Profile management
- In-memory data persistence (during server runtime)

### ⚠️ Limitations
- **No AWS Services**: Cognito, DynamoDB, Bedrock, S3 are mocked
- **In-Memory Storage**: Data is lost when server restarts
- **Mock AI**: Food analysis returns generic responses (no real Bedrock)
- **No File Uploads**: Image-based food recognition not available
- **No Email**: Email verification is bypassed

## 🛠️ Troubleshooting

### Port Already in Use

**Backend (3001):**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

**Frontend (3000):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### CORS Errors

The local server has CORS enabled for all origins. If you still see CORS errors:
1. Check that the backend server is running
2. Verify the frontend .env file has `REACT_APP_API_URL=http://localhost:3001`
3. Clear browser cache and reload

### Module Not Found

```bash
# Reinstall dependencies
cd local-server && npm install && cd ..
cd frontend && npm install && cd ..
```

### TypeScript Errors

```bash
# Rebuild the project
npm run build
```

## 📝 Environment Variables

### Backend (local-server)
No environment variables required - all AWS services are mocked.

### Frontend (frontend/.env)
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_USE_MOCK=false
```

## 🔄 Data Persistence

The local server uses in-memory storage. Data is lost when the server restarts.

To persist data between restarts, you could:
1. Add a JSON file-based storage
2. Use SQLite for local database
3. Connect to a local DynamoDB instance (requires Docker)

## 🚀 Next Steps

### For Development
1. Make changes to Lambda functions in `src/`
2. Rebuild: `npm run build`
3. Restart local server
4. Test changes in frontend

### For Production
1. Deploy to AWS: `npm run cdk:deploy`
2. Update frontend .env with real API Gateway URL
3. Build frontend: `cd frontend && npm run build`
4. Deploy frontend to S3/CloudFront or hosting service

## 📚 Additional Resources

- [Frontend Quick Start](frontend/QUICK_START.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Development Context](DEVELOPMENT_CONTEXT.md)

## 💡 Tips

1. **Use Browser DevTools**: Monitor network requests and responses
2. **Check Server Logs**: Terminal shows all API requests
3. **Test with Postman**: Import endpoints for API testing
4. **Hot Reload**: Frontend auto-reloads on code changes
5. **Mock Data**: Customize mock responses in `local-server/server.ts`

## 🎉 You're Ready!

Your local development environment is now set up. Start building and testing without AWS deployment!

For questions or issues, check the troubleshooting section or review the code in `local-server/server.ts`.
