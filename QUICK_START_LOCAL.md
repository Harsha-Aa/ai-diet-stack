# 🚀 Quick Start - Local Development

## One-Command Start

### Windows
```bash
start-local.bat
```

### Linux/Mac
```bash
chmod +x start-local.sh
./start-local.sh
```

### Or use npm
```bash
npm run dev
```

## What Happens

1. ✅ Installs all dependencies
2. 🚀 Starts backend server on http://localhost:3001
3. 🌐 Starts frontend on http://localhost:3000
4. 🎉 Opens browser automatically

## Test the App

1. **Register**: Create account at http://localhost:3000
2. **Login**: Sign in with your credentials
3. **Add Glucose Reading**: Log your blood sugar
4. **Analyze Food**: Enter meal description
5. **View Dashboard**: See your stats and charts

## Stop Servers

Press `Ctrl+C` in the terminal

## Troubleshooting

### Port Already in Use

**Kill process on port 3001 (backend):**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

**Kill process on port 3000 (frontend):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Dependencies Not Installing

```bash
# Clean install
rm -rf node_modules local-server/node_modules frontend/node_modules
npm install
cd local-server && npm install && cd ..
cd frontend && npm install && cd ..
```

## Manual Start (Alternative)

**Terminal 1 - Backend:**
```bash
cd local-server
npm install
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm start
```

## Features Available

✅ User Registration & Login
✅ Glucose Tracking
✅ Food Analysis (Mock AI)
✅ Dashboard Analytics
✅ Profile Management

⚠️ Data is stored in-memory (lost on restart)
⚠️ No real AWS services (all mocked)

## Next Steps

- Read [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for detailed guide
- Check [API endpoints](LOCAL_DEVELOPMENT.md#-available-api-endpoints)
- Learn about [testing](LOCAL_DEVELOPMENT.md#-testing-the-application)

## Need Help?

Check the full guide: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
