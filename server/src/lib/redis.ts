/**
 * @deprecated This file is deprecated. Use server/src/utils/redis.ts instead.
 * 
 * This file is kept for backward compatibility and will be removed in a future version.
 * All Redis functionality has been moved to the centralized utility at server/src/utils/redis.ts
 */

// Re-export everything from the new centralized Redis utility
export {
  getRedis as getRedisInstance,
  checkRedisHealth,
  shutdownRedis,
  getRedisConfigStatus,
  getBullMQRedisUrl,
  redis
} from '../utils/redis';

