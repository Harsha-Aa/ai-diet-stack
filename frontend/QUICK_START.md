# Quick Start Guide

## Prerequisites
- Node.js installed (v16 or higher)
- npm available in PATH

## Running the Frontend

### Option 1: Using Full Path (if npm not in PATH)
```powershell
# Navigate to frontend directory
cd D:\ai-diet-stack\frontend

# Start the development server
& "C:\Program Files\nodejs\npm.cmd" start
```

### Option 2: After Restarting Terminal (npm in PATH)
```bash
cd frontend
npm start
```

## What to Expect

The app will:
1. Compile (may take 30-60 seconds first time)
2. Open browser at `http://localhost:3000`
3. Show the login page

## Testing the App

### 1. Login
- Email: any email (e.g., `demo@example.com`)
- Password: any password (e.g., `password123`)
- Click "Sign In"

### 2. Explore Features
- **Dashboard**: View glucose charts and stats
- **Glucose Log**: Add new readings
- **Food Analyzer**: Analyze meals
- **Profile**: View usage and subscription info

## Mock Data

The app currently uses **mock data** - no backend required!
- All API calls are simulated
- Data is stored in memory only
- Perfect for frontend development

## Troubleshooting

### "npm is not recognized"
**Solution**: Restart your terminal/IDE to load the updated PATH

Or use full path:
```powershell
& "C:\Program Files\nodejs\npm.cmd" start
```

### Compilation Errors
If you see errors, make sure all dependencies are installed:
```bash
npm install
```

### Port 3000 Already in Use
```bash
# Kill the process on port 3000
npx kill-port 3000
```

## Next Steps

Once the backend is deployed:
1. Update `.env` with API Gateway URL
2. Set `USE_MOCK = false` in service files
3. Test with real API

## Features Working

✅ Authentication (mock)
✅ Dashboard with charts
✅ Glucose logging
✅ Food analyzer
✅ Profile page
✅ Responsive design
✅ Material-UI styling

Enjoy! 🚀
