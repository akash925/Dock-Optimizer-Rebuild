import { EventEmitter } from 'events';
import { vi, describe, it, expect } from 'vitest';

// Mock the Neon Pool before importing the DB module so that no real connection is attempted
vi.mock('@neondatabase/serverless', () => {
  class MockPool extends EventEmitter {
    async query() {
      return { rows: [{ ok: true }] };
    }
    async end() {}
  }
  const neonConfig = {};
  return { Pool: MockPool, neonConfig };
});

// Mock drizzle purely as a noop (not used in this test)
vi.mock('drizzle-orm/neon-serverless', () => {
  return { drizzle: () => ({}) };
});

// Import after mocks so that server/db picks them up
import { pool } from '../db';

describe('Database crash resilience', () => {
  it('swallows Neon administrator termination errors (57P01/02/03)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      /* noop */
    }) as any);

    // Emit simulated error (non-null assertion since pool is mocked)
    (pool as any).emit('error', { code: '57P01', message: 'mock admin shutdown' });

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
}); 