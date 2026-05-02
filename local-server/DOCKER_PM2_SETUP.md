# Docker and PM2 Setup Guide

This guide explains how to use Docker Compose for local development and PM2 for production process management.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed (for PM2 local development)
- AWS credentials configured (or LocalStack for local testing)

## Docker Compose Setup

### Configuration Files

- **docker-compose.yml**: Defines services for local development
- **.env.example**: Template for environment variables

### Getting Started

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS credentials and configuration
   ```

2. **Build and start services**:
   ```bash
   npm run docker:up
   # Or manually: docker-compose up -d
   ```

3. **View logs**:
   ```bash
   npm run docker:logs
   # Or manually: docker-compose logs -f api
   ```

4. **Stop services**:
   ```bash
   npm run docker:down
   # Or manually: docker-compose down
   ```

### Services Included

#### API Service (Required)
- Express.js server running on port 3000
- Hot reload enabled via volume mounts
- Health check endpoint: http://localhost:3000/health
- Automatic restart on failure

#### LocalStack (Optional)
Uncomment in docker-compose.yml to enable local AWS service emulation:
- DynamoDB, S3, Cognito, SNS, SES
- No AWS credentials required
- Endpoint: http://localhost:4566

#### Redis (Optional)
Uncomment in docker-compose.yml to enable caching:
- Redis 7 Alpine
- Port: 6379
- Persistent data storage

### Volume Mounts

- `./src:/app/src` - Source code hot reload
- `./logs:/app/logs` - Log file persistence
- `/app/node_modules` - Prevent node_modules overwrite

### Health Checks

The API service includes health checks:
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3
- Start period: 40 seconds

## PM2 Process Management

### Configuration File

- **ecosystem.config.js**: PM2 configuration for production deployment

### Features

1. **Cluster Mode**: Uses all available CPU cores
2. **Auto-Restart**: Automatically restarts on crashes
3. **Memory Limit**: Restarts if memory exceeds 1GB
4. **Graceful Shutdown**: 5-second timeout for cleanup
5. **Log Management**: Separate error and output logs
6. **Environment Support**: Development, staging, production

### PM2 Commands

#### Start Application

```bash
# Production mode
npm run pm2:start

# Development mode (with watch)
npm run pm2:start:dev

# Staging mode
npm run pm2:start:staging
```

#### Manage Application

```bash
# Stop application
npm run pm2:stop

# Restart application (kills and starts)
npm run pm2:restart

# Reload application (zero-downtime reload)
npm run pm2:reload

# Delete application from PM2
npm run pm2:delete
```

#### Monitor Application

```bash
# View logs
npm run pm2:logs

# Real-time monitoring
npm run pm2:monit

# Check status
npm run pm2:status
```

### PM2 Configuration Details

#### Cluster Mode
```javascript
instances: 'max', // Use all CPU cores
exec_mode: 'cluster'
```

#### Memory Management
```javascript
max_memory_restart: '1G', // Restart if exceeds 1GB
node_args: '--max-old-space-size=1024' // Limit heap to 1GB
```

#### Graceful Shutdown
```javascript
kill_timeout: 5000, // Wait 5s for graceful shutdown
wait_ready: true, // Wait for app ready signal
listen_timeout: 10000 // Wait 10s for app to listen
```

#### Log Management
```javascript
error_file: './logs/error.log',
out_file: './logs/out.log',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
merge_logs: true
```

### Environment Variables

PM2 supports multiple environments:

```bash
# Production (default)
pm2 start ecosystem.config.js

# Development
pm2 start ecosystem.config.js --env development

# Staging
pm2 start ecosystem.config.js --env staging
```

## Production Deployment

### Option 1: Docker with PM2

The Dockerfile includes PM2 for production:

```bash
# Build image
npm run docker:build

# Run container
docker run -d -p 3000:3000 --env-file .env ai-diet-api
```

### Option 2: Direct PM2 Deployment

For deployment to VPS or EC2:

```bash
# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Option 3: Render/Railway

For platform-as-a-service deployment:

1. Push code to Git repository
2. Connect repository to Render/Railway
3. Set environment variables in platform dashboard
4. Platform will automatically build and deploy

## Monitoring and Logs

### Docker Logs

```bash
# Follow logs
docker-compose logs -f api

# View last 100 lines
docker-compose logs --tail=100 api

# View logs for specific service
docker-compose logs redis
```

### PM2 Logs

```bash
# Follow all logs
pm2 logs

# Follow specific app logs
pm2 logs ai-diet-api

# View last 100 lines
pm2 logs --lines 100

# Clear logs
pm2 flush
```

### Log Files

Logs are stored in `./logs/` directory:
- `error.log` - Error logs
- `out.log` - Standard output logs

## Troubleshooting

### Docker Issues

**Container won't start**:
```bash
# Check logs
docker-compose logs api

# Rebuild image
docker-compose build --no-cache api
docker-compose up -d
```

**Port already in use**:
```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

**Volume permission issues**:
```bash
# Fix permissions
sudo chown -R $USER:$USER ./logs
```

### PM2 Issues

**App keeps restarting**:
```bash
# Check logs
pm2 logs ai-diet-api

# Check status
pm2 status

# Increase memory limit in ecosystem.config.js
max_memory_restart: '2G'
```

**Graceful shutdown not working**:
```bash
# Increase kill timeout in ecosystem.config.js
kill_timeout: 10000
```

**Logs not appearing**:
```bash
# Create logs directory
mkdir -p logs

# Check PM2 log path
pm2 show ai-diet-api
```

## Best Practices

### Development
- Use Docker Compose for consistent environment
- Enable hot reload with volume mounts
- Use LocalStack to avoid AWS costs
- Enable Redis for caching tests

### Production
- Use PM2 cluster mode for multi-core utilization
- Set appropriate memory limits
- Configure graceful shutdown
- Monitor logs and metrics
- Use environment-specific configurations
- Enable health checks

### Security
- Never commit .env files
- Use secrets management for production
- Limit container resources
- Run containers as non-root user
- Keep dependencies updated

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
