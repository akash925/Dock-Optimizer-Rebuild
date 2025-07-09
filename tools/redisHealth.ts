// tools/redisHealth.ts
import { redis, getRedisConfigStatus } from '../server/src/lib/redis';

(async () => {
  // Check configuration status
  const configStatus = getRedisConfigStatus();
  
  console.log('=== Redis Configuration Status ===');
  console.log(`Source: ${configStatus.source}`);
  console.log(`Message: ${configStatus.message}`);
  console.log('');

  if (!redis) {
    console.log('Redis connectivity: DISABLED');
    console.log('');
    console.log('To enable Redis:');
    console.log('1. Set up a Redis instance (Upstash, Redis Cloud, etc.)');
    console.log('2. Add REDIS_URL to your Doppler secrets:');
    console.log('   doppler secrets set REDIS_URL="redis://your-redis-url"');
    console.log('3. Restart the application');
    process.exit(1);
  }

  try {
    console.log('Testing Redis connection...');
    const pong = await redis.ping();
    
    if (pong === 'PONG') {
      // Extract hostname from URL for display (without exposing credentials)
      const redisUrl = process.env.REDIS_URL!;
      const url = new URL(redisUrl);
      const host = url.hostname;
      const port = url.port || (url.protocol === 'rediss:' ? '6380' : '6379');
      
      console.log('✅ Redis connectivity: SUCCESS');
      console.log(`Connected to: ${host}:${port}`);
      console.log('Redis is properly configured via Doppler secrets');
      process.exit(0);
    } else {
      console.log('❌ Redis connectivity: UNEXPECTED_RESPONSE');
      console.log(`Received: ${pong} (expected: PONG)`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Redis connectivity: ERROR');
    console.error(error);
    console.log('');
    console.log('Troubleshooting steps:');
    console.log('1. Verify REDIS_URL is correct in Doppler secrets');
    console.log('2. Check Redis server status');
    console.log('3. Verify network connectivity to Redis host');
    process.exit(1);
  }
})(); 