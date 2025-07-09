import IORedis from 'ioredis';

// Redis connection instance
let redis: IORedis | null = null;

// Initialize Redis connection with proper logging and error handling
export function initializeRedis(): IORedis | null {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('[Redis] Redis disabled – REDIS_URL not set');
    return null;
  }

  try {
    let redisInstance: IORedis;
    
    if (process.env.REDIS_URL) {
      redisInstance = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    } else {
      redisInstance = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    }

    redisInstance.on('connect', () => {
      const redisHost = process.env.REDIS_URL ? 'cloud' : `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
      console.info(`[Redis] Connected to Redis (host: ${redisHost})`);
    });

    redisInstance.on('error', (error) => {
      console.error('[Redis] Connection error:', error.message);
    });

    redisInstance.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    redisInstance.on('reconnecting', () => {
      console.info('[Redis] Reconnecting...');
    });

    return redisInstance;
  } catch (error) {
    console.error('[Redis] Failed to initialize Redis:', error);
    return null;
  }
}

// Get Redis instance (initialize if not already done)
export function getRedisInstance(): IORedis | null {
  if (!redis) {
    redis = initializeRedis();
  }
  return redis;
}

// Export the Redis instance for direct access
export { redis };

// Initialize Redis connection on module load
redis = initializeRedis();

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  const redisInstance = getRedisInstance();
  if (!redisInstance) {
    return false;
  }

  try {
    const pong = await redisInstance.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function shutdownRedis(): Promise<void> {
  if (redis) {
    console.info('[Redis] Shutting down Redis connection');
    await redis.quit();
    redis = null;
  }
} 