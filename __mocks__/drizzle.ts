import { vi } from 'vitest';

// Mock Drizzle database operations with more comprehensive chaining
export const db = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  then: vi.fn().mockImplementation((fn) => fn([])),
  onConflictDoNothing: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  rightJoin: vi.fn().mockReturnThis(),
  fullJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  having: vi.fn().mockReturnThis(),
  with: vi.fn().mockReturnThis(),
  prepare: vi.fn().mockReturnThis(),
  transaction: vi.fn().mockImplementation(async (fn) => {
    return fn(db);
  }),
  get rowCount() { return 1; }
};

// Mock Neon connection with tagged template support
export const neon = vi.fn().mockImplementation((connectionString) => {
  const sqlFn = vi.fn().mockResolvedValue([]) as any;
  // Add tagged template support
  sqlFn.query = vi.fn().mockResolvedValue([]);
  return sqlFn;
});

// Mock drizzle constructor
export const drizzle = vi.fn().mockReturnValue(db);

// Reset function for use in tests
export const resetDbMocks = () => {
  Object.keys(db).forEach(key => {
    if (typeof db[key as keyof typeof db] === 'function') {
      (db[key as keyof typeof db] as any).mockClear();
    }
  });
}; 