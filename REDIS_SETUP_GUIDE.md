# Redis Setup Guide for Dock Optimizer

## Overview

The Dock Optimizer application uses Redis for **optional** job queue processing via BullMQ. The application will work without Redis, but Redis provides these benefits:

- **Reliable notification processing**: Email and WebSocket notifications are queued and processed reliably
- **Better scalability**: Multiple worker processes can handle notifications
- **Failure recovery**: Failed jobs are retried automatically
- **Priority handling**: Urgent notifications get higher priority

## Current Status

**Redis is currently DISABLED** in this deployment. The application falls back to immediate processing of notifications without queuing.

## Secret Management via Doppler

This application uses **Doppler** for secure secret management. All Redis configuration must be done through Doppler secrets - **no hardcoded values or manual environment variables**.

### Doppler Configuration

The application is configured with these Doppler environments:
- **Development**: `dev` config
- **Staging**: `stg` config  
- **Production**: `prd` config

Redis is configured via the `REDIS_URL` secret in Doppler.

## Redis Configuration Options

### Option 1: Cloud Redis (Recommended for Production)

#### Upstash Redis (Free Tier Available)
1. Go to [upstash.com](https://upstash.com)
2. Create a free account
3. Create a new Redis database
4. Copy the connection URL (format: `redis://default:password@hostname:port`)
5. **Add to Doppler secrets** (not environment files):
   ```bash
   # In Doppler dashboard or CLI
   doppler secrets set REDIS_URL="redis://default:password@hostname:port"
   ```

#### Redis Cloud (RedisLabs)
1. Go to [redis.com](https://redis.com)
2. Create a free account
3. Create a new Redis database
4. Copy the connection URL
5. **Add to Doppler secrets**:
   ```bash
   doppler secrets set REDIS_URL="redis://default:password@hostname:port"
   ```

### Option 2: Local Redis (Development Only)

For local development, you can set up Redis and configure it in your Doppler `dev` environment:

#### Using Docker (Recommended)
```bash
# Start Redis container
docker run --name dock-optimizer-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Add to Doppler dev config
doppler secrets set REDIS_URL="redis://localhost:6379" --config dev
```

#### Using Homebrew (macOS)
```bash
# Install and start Redis
brew install redis
brew services start redis

# Add to Doppler dev config
doppler secrets set REDIS_URL="redis://localhost:6379" --config dev
```

## Secret Management Best Practices

### ✅ Correct Approach (Using Doppler)
```bash
# Set Redis URL in appropriate Doppler config
doppler secrets set REDIS_URL="redis://your-redis-url" --config prd

# The application automatically loads from Doppler
# No manual environment variable management needed
```

### ❌ Avoid These Approaches
```bash
# DON'T set environment variables manually
export REDIS_URL="redis://..."  # Bypasses secret management

# DON'T use hardcoded values in code
const redis = new IORedis("redis://hardcoded-url")  # Security risk

# DON'T use .env files for production secrets
REDIS_URL=redis://...  # Not secure for production
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
- Logs: `[Redis] Connected to Redis (host: your-hostname)`

### Without Redis (Current State)
- Notifications are processed immediately
- No queuing or retry logic
- Still functional but less reliable under load
- Simpler deployment (no Redis dependency)
- Logs: `[Redis] Redis disabled – REDIS_URL not configured in Doppler secrets`

## Deployment Considerations

### For Replit Deployment
1. **Configure Doppler**: Ensure Doppler integration is set up in Replit
2. **Add REDIS_URL**: Set in appropriate Doppler config (prd for production)
3. **Deploy**: Application automatically loads Redis URL from Doppler

### For Production Deployment
1. **High Availability**: Use Redis Cluster or Redis Sentinel
2. **Monitoring**: Monitor Redis memory usage and connection counts
3. **Backup**: Configure Redis persistence (RDB/AOF)
4. **Security**: Use Redis AUTH and TLS encryption
5. **Doppler Security**: Rotate Doppler service tokens regularly

## Troubleshooting

### Common Issues

#### "Redis disabled – REDIS_URL not configured in Doppler secrets"
- **Cause**: `REDIS_URL` not set in Doppler
- **Solution**: Set `REDIS_URL` in appropriate Doppler config
- **Check**: Verify Doppler config with `doppler secrets`

#### "Redis connectivity: ERROR"
- **Cause**: Invalid Redis URL or Redis server not accessible
- **Solution**: Verify Redis URL format and server status
- **Check**: Test Redis URL manually with `redis-cli`

#### "Connection timeout"
- **Cause**: Network issues or Redis server overloaded
- **Solution**: Check network connectivity and Redis server resources

### Debug Commands

```bash
# Check Redis health
npm run redis:health

# View Doppler secrets (masked)
doppler secrets

# Test specific Doppler config
doppler run --config dev -- npm run redis:health

# Test Redis connection manually (if Redis CLI available)
redis-cli -u "your-redis-url" ping
```

## Performance Tuning

### Application Configuration
The application automatically configures:
- **Connection pooling**: Prevents connection exhaustion
- **Retry logic**: 3 attempts with exponential backoff
- **Queue limits**: 100 completed jobs, 50 failed jobs retained
- **Worker concurrency**: 5 normal workers, 10 urgent workers
- **Timeouts**: 10s connect, 5s command timeout

## Migration from No-Redis to Redis

1. **Set REDIS_URL in Doppler** for appropriate environment
2. **Restart the application** to reload Doppler secrets
3. **Verify health check** using `npm run redis:health`
4. **Monitor logs** for successful Redis connection

The migration is seamless - the application automatically switches from immediate processing to queued processing when Redis becomes available via Doppler.

## Cost Considerations

### Free Tiers
- **Upstash**: 10k requests/day, 256MB storage
- **Redis Cloud**: 30MB storage, limited connections

### Paid Options
- **Upstash**: $0.20 per 100k requests
- **Redis Cloud**: $0.026/hour for 1GB
- **AWS ElastiCache**: $0.017/hour for cache.t3.micro

## Security Best Practices

1. **Use Doppler**: Never bypass Doppler for secret management
2. **Use TLS**: Enable Redis TLS encryption in production
3. **Rotate secrets**: Regularly rotate Redis passwords
4. **Monitor access**: Enable Redis logs and monitoring
5. **Network isolation**: Use VPC or private networks for cloud Redis

---

**Need help?** Check the application logs or contact the development team. 