import { vi } from 'vitest';
import { cleanupTestData, seedTestData } from './server/test-utils/test-helpers';
// import { createTestDb } from './server/test-utils/db-test-helper';

// Vitest setup file - provides minimal environment variables for testing
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'dummy';
process.env.AWS_SECRET_ACCESS_KEY = 'dummy';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.NODE_ENV = 'test';
process.env.ENFORCE_WEEKEND_RULE = 'true';
process.env.VITE_USE_S3_DIRECT_UPLOAD = 'false';

// Make test helpers available globally
global.cleanupTestData = cleanupTestData;
global.seedTestData = seedTestData;

// Temporarily disable SQLite test database - use simple mocks instead
// globalThis.__TEST_DB__ = createTestDb();

// Enhanced database mock with more Drizzle ORM methods
const createMockQueryBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  onConflict: vi.fn().mockReturnThis(),
  // Make the mock work as both function and object
  [Symbol.toPrimitive]: () => [],
  then: vi.fn().mockResolvedValue([]),
});

// Mock the database module with enhanced implementations
vi.mock('./server/db', () => ({
  db: {
    query: vi.fn().mockImplementation(() => ({ rows: [] })),
    select: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    from: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    insert: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    update: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    delete: vi.fn().mockImplementation(() => createMockQueryBuilder()),
  },
  pool: null,
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  ensureDatabaseConnection: vi.fn().mockResolvedValue(true),
  safeQuery: vi.fn().mockImplementation(async (fn) => fn()),
}));

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