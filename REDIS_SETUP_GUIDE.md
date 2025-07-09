# Redis Setup Guide for Dock Optimizer

## Overview

The Dock Optimizer application uses Redis for **optional** job queue processing via BullMQ. The application will work without Redis, but Redis provides these benefits:

- **Reliable notification processing**: Email and WebSocket notifications are queued and processed reliably
- **Better scalability**: Multiple worker processes can handle notifications
- **Failure recovery**: Failed jobs are retried automatically
- **Priority handling**: Urgent notifications get higher priority

## Current Status

**Redis is currently DISABLED** in this deployment. The application falls back to immediate processing of notifications without queuing.

## Redis Configuration Options

### Option 1: Cloud Redis (Recommended for Production)

#### Upstash Redis (Free Tier Available)
1. Go to [upstash.com](https://upstash.com)
2. Create a free account
3. Create a new Redis database
4. Copy the connection URL
5. Add to your environment variables:
   ```bash
   REDIS_URL=redis://default:password@hostname:port
   ```

#### Redis Cloud (RedisLabs)
1. Go to [redis.com](https://redis.com)
2. Create a free account
3. Create a new Redis database
4. Copy the connection details
5. Add to your environment variables:
   ```bash
   REDIS_URL=redis://default:password@hostname:port
   ```

### Option 2: Local Redis (Development)

#### Using Docker (Recommended)
```bash
# Start Redis container
docker run --name dock-optimizer-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

#### Using Homebrew (macOS)
```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

#### Using APT (Ubuntu/Debian)
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379
```

## Environment Variables

Add these to your `.env` file or deployment environment:

### Cloud Redis (using URL)
```bash
REDIS_URL=redis://default:password@hostname:port
```

### Local Redis (using host/port)
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_if_any
```

## Health Check

Test your Redis connection:

```bash
npm run redis:health
```

Expected outputs:
- **Redis working**: `Redis connectivity: PONG`
- **Redis disabled**: `Redis connectivity: DISABLED (no Redis configuration)`
- **Redis error**: `Redis connectivity: ERROR [error details]`

## Application Behavior

### With Redis Enabled
- Notifications are queued and processed by background workers
- Better reliability and scalability
- Failed notifications are retried automatically
- Urgent notifications get priority processing

### Without Redis (Current State)
- Notifications are processed immediately
- No queuing or retry logic
- Still functional but less reliable under load
- Simpler deployment (no Redis dependency)

## Deployment Considerations

### For Replit Deployment
1. **Replit Teams**: Use Replit's built-in Redis service
2. **Replit Core**: Use a cloud Redis service (Upstash recommended)
3. **Environment Setup**: Add Redis URL to Replit Secrets

### For Production Deployment
1. **High Availability**: Use Redis Cluster or Redis Sentinel
2. **Monitoring**: Monitor Redis memory usage and connection counts
3. **Backup**: Configure Redis persistence (RDB/AOF)
4. **Security**: Use Redis AUTH and TLS encryption

## Troubleshooting

### Common Issues

#### "Redis connectivity: DISABLED"
- **Cause**: No Redis environment variables set
- **Solution**: Set `REDIS_URL` or `REDIS_HOST` environment variables

#### "Redis connectivity: ERROR"
- **Cause**: Redis server not running or connection refused
- **Solution**: Check Redis server status and connection details

#### "Connection timeout"
- **Cause**: Network issues or Redis server overloaded
- **Solution**: Check network connectivity and Redis server resources

### Debug Commands

```bash
# Check Redis health
npm run redis:health

# Test Redis connection manually
redis-cli ping

# Check Redis server status
redis-cli info server
```

## Performance Tuning

### Redis Configuration
```redis
# /etc/redis/redis.conf (for local Redis)
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Application Configuration
The application automatically configures:
- **Connection pooling**: Prevents connection exhaustion
- **Retry logic**: 3 attempts with exponential backoff
- **Queue limits**: 100 completed jobs, 50 failed jobs retained
- **Worker concurrency**: 5 normal workers, 10 urgent workers

## Migration from No-Redis to Redis

1. **Set environment variables** as described above
2. **Restart the application** to initialize Redis connections
3. **Verify health check** using `npm run redis:health`
4. **Monitor logs** for successful queue initialization

The migration is seamless - the application will automatically switch from immediate processing to queued processing when Redis becomes available.

## Cost Considerations

### Free Tiers
- **Upstash**: 10k requests/day, 256MB storage
- **Redis Cloud**: 30MB storage, limited connections
- **Local Redis**: No cost, but requires server management

### Paid Options
- **Upstash**: $0.20 per 100k requests
- **Redis Cloud**: $0.026/hour for 1GB
- **AWS ElastiCache**: $0.017/hour for cache.t3.micro

## Security Best Practices

1. **Use TLS**: Enable Redis TLS encryption in production
2. **Set AUTH**: Use Redis AUTH password protection
3. **Network isolation**: Use VPC or private networks
4. **Regular updates**: Keep Redis server updated
5. **Monitor access**: Enable Redis logs and monitoring

---

**Need help?** Check the application logs or contact the development team. 