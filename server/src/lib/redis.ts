import IORedis from 'ioredis';

// Redis connection instance
let redis: IORedis | null = null;

// Initialize Redis connection with proper logging and error handling
export function initializeRedis(): IORedis | null {
  // Only use REDIS_URL from Doppler - no fallbacks to avoid hardcoded values
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] Redis disabled – REDIS_URL not configured in Doppler secrets');
    return null;
  }

  try {
    // Use only REDIS_URL from Doppler (no individual host/port/password support)
    const redisInstance = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
      // Add connection timeout to prevent hanging
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    redisInstance.on('connect', () => {
      // Extract hostname from URL for logging (without exposing credentials)
      const url = new URL(process.env.REDIS_URL!);
      const host = url.hostname;
      console.info(`[Redis] Connected to Redis (host: ${host})`);
    });

    redisInstance.on('error', (error) => {
      console.error('[Redis] Connection error:', error.message);
      // Log helpful message about secret management
      if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
        console.error('[Redis] Verify REDIS_URL is correctly configured in Doppler secrets');
      }
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
    console.error('[Redis] Ensure REDIS_URL is properly configured in Doppler secrets');
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

// Utility to check Redis configuration status
export function getRedisConfigStatus(): {
  configured: boolean;
  source: string;
  message: string;
} {
  if (process.env.REDIS_URL) {
    return {
      configured: true,
      source: 'Doppler',
      message: 'Redis configured via Doppler REDIS_URL'
    };
  }
  
  return {
    configured: false,
    source: 'None',
    message: 'Redis not configured - REDIS_URL missing from Doppler secrets'
  };
} 