import { vi } from 'vitest';

// Vitest setup file - provides minimal environment variables for testing
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'dummy';
process.env.AWS_SECRET_ACCESS_KEY = 'dummy';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.NODE_ENV = 'test';
process.env.ENFORCE_WEEKEND_RULE = 'true';
process.env.VITE_USE_S3_DIRECT_UPLOAD = 'false';

// Mock Neon database to prevent real connections in tests
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn().mockImplementation(() => {
    const sqlFn = vi.fn().mockResolvedValue([]) as any;
    sqlFn.query = vi.fn().mockResolvedValue([]);
    return sqlFn;
  }),
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    emit: vi.fn(),
  })),
  neonConfig: {},
}));

// Mock Drizzle ORM to prevent real database operations
vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: vi.fn().mockImplementation((fn) => fn([])),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (fn) => fn(this)),
  }),
})); 