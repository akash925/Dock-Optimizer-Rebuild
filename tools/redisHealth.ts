// tools/redisHealth.ts
import { redis } from '../server/src/lib/redis';

(async () => {
  if (!redis) {
    console.log('Redis connectivity: DISABLED (no Redis configuration)');
    process.exit(1);
  }

  try {
    const pong = await redis.ping();
    console.log('Redis connectivity:', pong);
    process.exit(pong === 'PONG' ? 0 : 1);
  } catch (error) {
    console.error('Redis connectivity: ERROR', error);
    process.exit(1);
  }
})(); 