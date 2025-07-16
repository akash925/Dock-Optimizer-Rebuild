// server/src/lib/redis.ts
import IORedis from 'ioredis';

interface RedisConfigStatus {
  source: string;
  message: string;
  enabled: boolean;
}

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

const url = process.env.REDIS_URL;
let redis: IORedis | null = null;

if (!url) {
  console.log('[Redis] Redis disabled – REDIS_URL not configured in Doppler secrets');
  // Don't exit - allow application to continue without Redis
} else {
  // ▸ retry: back-off (150 ms * attempt) up to 3 tries, then throw
  let retryCount = 0;
  redis = new IORedis(url, {
    lazyConnect: true,
    retryStrategy: () => {
      retryCount += 1;
      if (retryCount > 3) return null;
      return Math.min(retryCount * 150, 5_000);
    },
    tls: url.startsWith('rediss://') ? {} : undefined,
  });

  redis.on('error', (err) => {
    // AUTH failures → exit immediately instead of spamming
    if (String(err.message).includes('WRONGPASS')) {
      console.error('[Redis] ❌ Invalid credentials – aborting');
      process.exit(1);
    }
    console.error('[Redis] Error:', err.message);
  });
}

export async function getRedisInstance() {
  if (!redis) {
    throw new Error('Redis is not configured');
  }
  if (!redis.status || redis.status === 'end') await redis.connect();
  return redis;
}

export async function checkRedisHealth() {
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
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    //
  }
}

export { redis }; // quick shortcut

