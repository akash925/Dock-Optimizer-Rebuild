// server/src/lib/redis.ts
import IORedis from 'ioredis';

const url = process.env.REDIS_URL;
if (!url) {
  console.error('[Redis] REDIS_URL environment variable is required');
  process.exit(1);
}

// ▸ retry: back-off (150 ms * attempt) up to 3 tries, then throw
let retryCount = 0;
const redis = new IORedis(url, {
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

export async function getRedisInstance() {
  if (!redis.status || redis.status === 'end') await redis.connect();
  return redis;
}

export async function checkRedisHealth() {
  try {
    const pong = await redis.ping();
    return { ok: pong === 'PONG', message: pong };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function shutdownRedis() {
  try {
    await redis.quit();
  } catch {
    //
  }
}

export { redis }; // quick shortcut

