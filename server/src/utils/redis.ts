/**
 * Centralized Redis utility with v4 Promise API support
 * 
 * This module provides a singleton Redis connection with:
 * - Automatic configuration from environment variables
 * - Graceful fallback when Redis is not available
 * - Proper error handling and retry logic
 * - Support for BullMQ with separate connection URLs
 */

import IORedis from 'ioredis';

interface RedisConfigStatus {
  source: string;
  message: string;
  enabled: boolean;
}

let redis: IORedis | null = null;
let initialized = false;

/**
 * Get Redis configuration status
 */
export function getRedisConfigStatus(): RedisConfigStatus {
  const url = process.env.REDIS_URL;
  
  if (!url) {
    return {
      source: 'Environment Variables',
      message: 'Redis disabled – REDIS_URL not configured',
      enabled: false
    };
  }
  
  return {
    source: 'Environment Variables',
    message: 'Redis enabled via REDIS_URL',
    enabled: true
  };
}

/**
 * Initialize Redis connection (singleton pattern)
 */
function initializeRedis(): void {
  if (initialized) return;
  
  const url = process.env.REDIS_URL;
  
  if (!url) {
    console.log('[Redis] Redis disabled – REDIS_URL not configured');
    redis = null;
    initialized = true;
    return;
  }

  try {
    redis = new IORedis(url, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 150, 5000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });

    redis.on('error', (err) => {
      if (String(err.message).includes('WRONGPASS')) {
        console.error('[Redis] ❌ Invalid credentials – check REDIS_URL');
        process.exit(1);
      }
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    console.log('[Redis] Connection configured');
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    redis = null;
  }
  
  initialized = true;
}

/**
 * Get Redis instance (null if not configured)
 */
export function getRedis(): IORedis | null {
  if (!initialized) {
    initializeRedis();
  }
  return redis;
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; message: string }> {
  const redisClient = getRedis();
  
  if (!redisClient) {
    return { ok: false, message: 'Redis not configured' };
  }
  
  try {
    // Ensure connection is established
    if (redisClient.status === 'end' || redisClient.status === 'close') {
      await redisClient.connect();
    }
    
    const pong = await redisClient.ping();
    return { ok: pong === 'PONG', message: pong };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * Gracefully shutdown Redis connection
 */
export async function shutdownRedis(): Promise<void> {
  const redisClient = getRedis();
  
  if (!redisClient) return;
  
  try {
    await redisClient.quit();
    console.log('[Redis] Connection closed gracefully');
  } catch (error) {
    console.error('[Redis] Error during shutdown:', error);
  }
}

/**
 * Get Redis connection URL for BullMQ
 */
export function getBullMQRedisUrl(): string | null {
  return process.env.BULLMQ_REDIS_URL || process.env.REDIS_URL || null;
}

// Legacy export for backward compatibility
export { redis };