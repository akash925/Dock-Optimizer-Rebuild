import { mockStorage } from '../__mocks__/storage.js';

/**
 * Clean up test data - resets all mock storage
 */
export async function cleanupTestData() {
  mockStorage.reset();
}

/**
 * Seed test data with common test entities
 */
export async function seedTestData(data: any = {}) {
  const defaultData = {
    tenants: [
      { id: 1, name: 'Test Organization', subdomain: 'test-org', status: 'ACTIVE' }
    ],
    users: [
      { id: 1, username: 'testuser', email: 'test@example.com', role: 'admin', tenantId: 1 }
    ],
    schedules: [],
    fileRecords: [],
    bolDocuments: [],
    companyAssets: []
  };

  const mergedData = { ...defaultData, ...data };
  mockStorage.seed(mergedData);
  return mergedData;
}

/**
 * Create test organization with default data
 */
export async function createTestOrganization(overrides: any = {}) {
  const orgData = {
    name: 'Test Organization',
    subdomain: 'test-org',
    status: 'ACTIVE',
    ...overrides
  };
  
  return await mockStorage.createTenant(orgData);
}

/**
 * Create test user with default data
 */
export async function createTestUser(overrides: any = {}) {
  const userData = {
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    tenantId: 1,
    ...overrides
  };
  
  return await mockStorage.createUser(userData);
}

/**
 * Get mock storage instance for direct manipulation in tests
 */
export function getMockStorage() {
  return mockStorage;
} 