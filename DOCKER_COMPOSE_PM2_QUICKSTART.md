# Docker Compose & PM2 Quick Start Guide

This guide provides quick commands for using Docker Compose and PM2 with the AI Diet & Meal Recommendation System.

## Location

All Docker and PM2 configuration files are in the `local-server/` directory:
- `docker-compose.yml` - Docker Compose configuration
- `ecosystem.config.js` - PM2 configuration
- `.env.example` - Environment variables template
- `DOCKER_PM2_SETUP.md` - Detailed setup guide

## Quick Start

### Docker Compose (Local Development)

```bash
cd local-server

# 1. Setup environment variables
cp .env.example .env
# Edit .env with your AWS credentials

# 2. Start services
npm run docker:up

# 3. View logs
npm run docker:logs

# 4. Stop services
npm run docker:down
```

### PM2 (Production)

```bash
cd local-server

# 1. Install dependencies
npm install

# 2. Start with PM2
npm run pm2:start

# 3. View status
npm run pm2:status

# 4. View logs
npm run pm2:logs

# 5. Stop application
npm run pm2:stop
```

## Common Commands

### Docker Compose

| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start all services in background |
| `npm run docker:down` | Stop and remove all services |
| `npm run docker:logs` | Follow API logs |
| `npm run docker:restart` | Restart API service |
| `npm run docker:build` | Build Docker image |

### PM2

| Command | Description |
|---------|-------------|
| `npm run pm2:start` | Start in production mode |
| `npm run pm2:start:dev` | Start in development mode |
| `npm run pm2:stop` | Stop application |
| `npm run pm2:restart` | Restart application |
| `npm run pm2:reload` | Zero-downtime reload |
| `npm run pm2:logs` | View logs |
| `npm run pm2:monit` | Real-time monitoring |
| `npm run pm2:status` | Check status |

## Configuration Details

### Docker Compose Features

- **Hot Reload**: Source code changes automatically reflected
- **Health Checks**: Automatic health monitoring
- **Optional Services**: LocalStack (AWS emulation), Redis (caching)
- **Network Isolation**: Services communicate via Docker network
- **Volume Mounts**: Persistent logs and source code

### PM2 Features

- **Cluster Mode**: Uses all CPU cores
- **Auto-Restart**: Restarts on crashes
- **Memory Limit**: 1GB per instance
- **Graceful Shutdown**: 5-second cleanup timeout
- **Log Management**: Separate error and output logs
- **Zero-Downtime Reload**: Reload without dropping connections

## Environment Variables

Required environment variables (see `local-server/.env.example`):

```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Cognito
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id

# DynamoDB Tables
DYNAMODB_USERS_TABLE=Users
DYNAMODB_GLUCOSE_TABLE=GlucoseReadings
DYNAMODB_FOOD_TABLE=FoodLogs
# ... (see .env.example for complete list)

# S3 Buckets
S3_FOOD_IMAGES_BUCKET=food-images-bucket
S3_REPORTS_BUCKET=reports-bucket
S3_GLUCOSE_FILES_BUCKET=glucose-files-bucket
```

## Health Check

Once running, check the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "memory": { ... }
}
```

## Troubleshooting

### Docker Issues

**Port already in use**:
```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"
```

**Container won't start**:
```bash
docker-compose logs api
docker-compose build --no-cache api
```

### PM2 Issues

**App keeps restarting**:
```bash
pm2 logs ai-diet-api
# Check for errors and fix
```

**Can't find PM2**:
```bash
npm install -g pm2
```

## Next Steps

For detailed documentation, see:
- `local-server/DOCKER_PM2_SETUP.md` - Complete setup guide
- `local-server/README.md` - Server documentation
- `.kiro/specs/ai-diet-meal-recommendation-system/design.md` - Architecture details

## Production Deployment

### Option 1: Docker on EC2/VPS
```bash
docker build -t ai-diet-api .
docker run -d -p 3000:3000 --env-file .env ai-diet-api
```

### Option 2: PM2 on VPS
```bash
npm ci --only=production
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Option 3: Render/Railway
1. Connect Git repository
2. Set environment variables
3. Platform auto-deploys

## Support

For issues or questions:
1. Check `local-server/DOCKER_PM2_SETUP.md` for detailed troubleshooting
2. Review logs: `npm run docker:logs` or `npm run pm2:logs`
3. Check health endpoint: `curl http://localhost:3000/health`
