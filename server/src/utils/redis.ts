// server/src/utils/redis.ts
import IORedis from 'ioredis';

interface RedisConfigStatus {
  source: string;
  message: string;
  enabled: boolean;
}

let redisInstance: IORedis | null = null;

export function getRedisConfigStatus(): RedisConfigStatus {
  const url = process.env.REDIS_URL;
  
  if (!url) {
    return {
      source: 'Environment Variables',
      message: 'Redis disabled – REDIS_URL not configured in Doppler secrets',
      enabled: false
    };
  }
  
  return {
    source: 'Doppler Secrets',
    message: 'Redis enabled via REDIS_URL from Doppler',
    enabled: true
  };
}

export function getRedis(): IORedis | null {
  if (redisInstance) {
    return redisInstance;
  }

  const url = process.env.REDIS_URL;
  
  if (!url) {
    console.log('[Redis] Redis disabled – REDIS_URL not configured');
    return null;
  }

  try {
    redisInstance = new IORedis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 150, 5000);
      },
      tls: url.startsWith('rediss://') ? {} : undefined,
    });

    redisInstance.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      if (String(err.message).includes('WRONGPASS')) {
        console.error('[Redis] ❌ Invalid credentials – aborting');
        process.exit(1);
      }
    });

    redisInstance.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    return redisInstance;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    return null;
  }
}

export async function checkRedisHealth() {
  const redis = getRedis();
  if (!redis) {
    return { ok: false, message: 'Redis not configured' };
  }
  
  try {
    const pong = await redis.ping();
    return { ok: pong === 'PONG', message: pong };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function shutdownRedis() {
  if (!redisInstance) return;
  try {
    await redisInstance.quit();
    redisInstance = null;
  } catch (error) {
    console.error('[Redis] Error during shutdown:', error);
  }
}

// Legacy compatibility export
export const redis = getRedis();