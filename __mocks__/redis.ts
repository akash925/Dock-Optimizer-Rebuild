import { vi } from 'vitest';

// Mock Redis utility for tests
export const getRedis = vi.fn().mockReturnValue(null);
export const checkRedisHealth = vi.fn().mockResolvedValue({ ok: false, message: 'Redis not configured' });
export const shutdownRedis = vi.fn().mockResolvedValue(undefined);
export const getRedisConfigStatus = vi.fn().mockReturnValue({
  source: 'Test Environment',
  message: 'Redis disabled in test environment',
  enabled: false
});

// Legacy compatibility export
export const redis = null;

export const resetRedisMocks = () => {
  vi.clearAllMocks();
  getRedis.mockReturnValue(null);
  checkRedisHealth.mockResolvedValue({ ok: false, message: 'Redis not configured' });
  shutdownRedis.mockResolvedValue(undefined);
  getRedisConfigStatus.mockReturnValue({
    source: 'Test Environment',
    message: 'Redis disabled in test environment',
    enabled: false
  });
};