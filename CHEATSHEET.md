# 🎯 Local Development Cheatsheet

## 🚀 Start/Stop

```bash
# Start everything
npm run dev

# Start backend only
npm run dev:server

# Start frontend only  
npm run dev:frontend

# Stop
Ctrl+C
```

## 🌐 URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health: http://localhost:3001/health

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register user |
| POST | `/auth/login` | No | Login |
| GET | `/auth/profile` | Yes | Get profile |
| POST | `/glucose/readings` | Yes | Add reading |
| GET | `/glucose/readings` | Yes | Get readings |
| POST | `/food/analyze-text` | Yes | Analyze food |
| GET | `/analytics/dashboard` | Yes | Get stats |
| GET | `/health` | No | Health check |

## 🔑 Authentication

```bash
# 1. Register/Login to get token
# 2. Include in requests:
Authorization: Bearer <token>
```

## 📝 Example Requests

### Register
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Pass123!","age":35,"weight_kg":75,"height_cm":175,"diabetes_type":"type2"}'
```

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Pass123!"}'
```

### Add Reading
```bash
curl -X POST http://localhost:3001/glucose/readings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"reading_value":120,"reading_unit":"mg/dL"}'
```

## 🔧 Troubleshooting

### Port in Use
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Reinstall
```bash
rm -rf node_modules local-server/node_modules frontend/node_modules
npm install
cd local-server && npm install && cd ..
cd frontend && npm install && cd ..
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `local-server/server.ts` | Backend server |
| `frontend/src/` | React components |
| `frontend/.env` | Frontend config |
| `src/` | Lambda functions |

## 🎮 Quick Test

1. `npm run dev`
2. Open http://localhost:3000
3. Register → Login
4. Add glucose reading
5. Analyze food
6. View dashboard

## 📚 Documentation

- **START_HERE.md** - Overview
- **QUICK_START_LOCAL.md** - Quick start
- **LOCAL_DEVELOPMENT.md** - Full guide
- **LOCAL_ARCHITECTURE.md** - Architecture

## ⚡ Pro Tips

- Use browser DevTools for debugging
- Check terminal for server logs
- Frontend auto-reloads on changes
- Backend needs restart after changes
- Data is lost on server restart

## 🎯 Development Flow

```
Start → Code → Test → Commit → Repeat
```

---

**Quick Start**: `npm run dev` → http://localhost:3000
