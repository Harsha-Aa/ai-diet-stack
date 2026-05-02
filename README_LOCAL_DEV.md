# 🚀 Local Development - Quick Reference

## TL;DR - Get Started in 30 Seconds

```bash
npm run dev
```

That's it! Backend runs on http://localhost:3001, frontend on http://localhost:3000

## What You Get

✅ **Full-stack local development** - No AWS deployment needed
✅ **Hot reload** - Frontend auto-updates on code changes
✅ **Mock AWS services** - Cognito, DynamoDB, Bedrock all simulated
✅ **In-memory data** - No database setup required
✅ **All API endpoints** - Complete backend functionality

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend |
| `npm run dev:server` | Start backend only (port 3001) |
| `npm run dev:frontend` | Start frontend only (port 3000) |
| `start-local.bat` | Windows startup script |
| `./start-local.sh` | Linux/Mac startup script |

## File Structure

```
.
├── local-server/              # Local Express server
│   ├── server.ts             # Main server file
│   ├── package.json          # Server dependencies
│   └── README.md             # Server documentation
│
├── frontend/                  # React frontend
│   ├── src/                  # React components
│   ├── .env                  # Frontend config (API URL)
│   └── package.json          # Frontend dependencies
│
├── src/                       # Lambda functions (backend logic)
│   ├── auth/                 # Authentication
│   ├── glucose/              # Glucose tracking
│   ├── food/                 # Food logging
│   └── analytics/            # Dashboard analytics
│
├── LOCAL_DEVELOPMENT.md       # Complete setup guide
├── QUICK_START_LOCAL.md       # Quick reference
├── LOCAL_SETUP_SUMMARY.md     # What was created
├── LOCAL_ARCHITECTURE.md      # System architecture
└── README_LOCAL_DEV.md        # This file
```

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Sign in
- `GET /auth/profile` - Get profile

### Glucose Tracking
- `POST /glucose/readings` - Add reading
- `GET /glucose/readings` - Get readings

### Food Logging
- `POST /food/analyze-text` - Analyze food

### Analytics
- `GET /analytics/dashboard` - Get stats

### Health
- `GET /health` - Server status

## Example Usage

### 1. Register User

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!",
    "age": 35,
    "weight_kg": 75,
    "height_cm": 175,
    "diabetes_type": "type2"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Add Glucose Reading

```bash
curl -X POST http://localhost:3001/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "reading_value": 120,
    "reading_unit": "mg/dL",
    "notes": "Before breakfast"
  }'
```

## Frontend Usage

1. Open http://localhost:3000
2. Click "Register" → Fill form → Submit
3. Login with your credentials
4. Explore:
   - Dashboard: View glucose stats
   - Glucose Log: Add readings
   - Food Analyzer: Log meals
   - Profile: View account info

## Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Dependencies Not Installing

```bash
rm -rf node_modules local-server/node_modules frontend/node_modules
npm install
cd local-server && npm install && cd ..
cd frontend && npm install && cd ..
```

### Server Won't Start

1. Check Node.js is installed: `node --version`
2. Check npm is installed: `npm --version`
3. Reinstall dependencies: `npm install`
4. Try manual start: `cd local-server && npm start`

## Features vs Production

| Feature | Local | Production |
|---------|-------|------------|
| Authentication | Mock JWT | AWS Cognito |
| Database | In-Memory | DynamoDB |
| AI Analysis | Mock | Bedrock |
| File Storage | N/A | S3 |
| Email | N/A | SES |
| Data Persistence | Session only | Permanent |

## Documentation

- 📖 [Complete Setup Guide](LOCAL_DEVELOPMENT.md)
- 🚀 [Quick Start](QUICK_START_LOCAL.md)
- 📋 [Setup Summary](LOCAL_SETUP_SUMMARY.md)
- 🏗️ [Architecture](LOCAL_ARCHITECTURE.md)
- 🔧 [Server README](local-server/README.md)

## Development Tips

1. **Use Browser DevTools** - Monitor network requests
2. **Check Server Logs** - Terminal shows all API calls
3. **Test with Postman** - Import endpoints for testing
4. **Hot Reload** - Frontend updates automatically
5. **Mock Data** - Customize responses in `local-server/server.ts`

## Next Steps

### For Development
1. Make changes to Lambda functions in `src/`
2. Update local server if needed
3. Test in frontend
4. Commit changes

### For Production
1. Build: `npm run build`
2. Test: `npm test`
3. Deploy: `npm run cdk:deploy`
4. Update frontend .env with real API URL
5. Build frontend: `cd frontend && npm run build`
6. Deploy frontend to hosting

## Support

- Check [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for detailed guide
- Review [troubleshooting section](LOCAL_DEVELOPMENT.md#-troubleshooting)
- Check server logs for errors
- Verify environment configuration

## License

MIT

---

**Happy Coding! 🎉**

Start developing: `npm run dev`
