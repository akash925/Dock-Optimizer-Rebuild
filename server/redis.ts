/**
 * Single source of truth Redis client for the application
 * 
 * This module re-exports the Redis client from the utils directory
 * and provides a clean interface for other modules to import Redis.
 * 
 * Usage:
 *   import { redis } from 'server/redis.ts';
 *   
 * The Redis client is configured with:
 * - Credentials from process.env.REDIS_URL (rediss://...)
 * - Max 3 retries with exponential backoff
 * - TLS support for Redis Cloud
 * - Graceful error handling
 * - Process exit on startup failure or auth issues
 */

export { 
  redis,
  getRedis,
  checkRedisHealth,
  shutdownRedis,
  getRedisConfigStatus 
} from './src/utils/redis'; 