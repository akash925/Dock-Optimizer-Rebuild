// Simple Redis health check script
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

console.log('=== Redis Health Check ===');
console.log('REDIS_URL configured:', !!REDIS_URL);

if (!REDIS_URL) {
    console.log('❌ REDIS_URL not found in environment');
    process.exit(1);
}

// Extract connection info without exposing credentials
const url = new URL(REDIS_URL);
console.log('Host:', url.hostname);
console.log('Port:', url.port);
console.log('Protocol:', url.protocol);

const redis = new IORedis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryStrategy: (times) => {
        console.log(`Retry attempt ${times}`);
        return times > 3 ? null : Math.min(times * 50, 1000);
    }
});

redis.on('error', (err) => {
    console.log('❌ Redis error:', err.message);
    if (err.message.includes('WRONGPASS')) {
        console.log('❌ Invalid Redis credentials');
    }
});

redis.on('connect', () => {
    console.log('✅ Redis connected');
});

// Test the connection
console.log('Testing Redis connection...');
redis.ping()
    .then(result => {
        console.log('✅ Redis PING successful:', result);
        redis.quit();
        process.exit(0);
    })
    .catch(err => {
        console.log('❌ Redis PING failed:', err.message);
        redis.quit();
        process.exit(1);
    });