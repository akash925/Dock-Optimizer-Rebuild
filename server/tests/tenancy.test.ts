import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IStorage } from '../storage';
import { getStorage } from '../storage';
import { MockStorage } from './__mocks__/storage';

// Mock the storage module
vi.mock('../storage', async () => {
  const actual = await vi.importActual('../storage');
  return {
    ...actual,
    getStorage: vi.fn().mockResolvedValue(new MockStorage()),
  };
});

describe('Tenant Isolation Tests', () => {
  let storage: IStorage;
  let tenantAId: number;
  let tenantBId: number;
  let userAId: number;
  let userBId: number;

  beforeEach(async () => {
    storage = await getStorage();
    
    // Create test tenants
    const tenantA = await storage.createTenant({
      name: 'Tenant A',
      subdomain: 'tenant-a-test',
      contactEmail: 'admin@tenant-a.test'
    });
    tenantAId = tenantA.id;

    const tenantB = await storage.createTenant({
      name: 'Tenant B', 
      subdomain: 'tenant-b-test',
      contactEmail: 'admin@tenant-b.test'
    });
    tenantBId = tenantB.id;

    // Create test users
    const userA = await storage.createUser({
      username: 'user-a',
      email: 'user-a@tenant-a.test',
      password: 'password',
      firstName: 'User',
      lastName: 'A',
      tenantId: tenantAId
    });
    userAId = userA.id;

    const userB = await storage.createUser({
      username: 'user-b',
      email: 'user-b@tenant-b.test', 
      password: 'password',
      firstName: 'User',
      lastName: 'B',
      tenantId: tenantBId
    });
    userBId = userB.id;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await storage.deleteTenant(tenantAId);
      await storage.deleteTenant(tenantBId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schedule Tenant Isolation', () => {
    it('should only return schedules for the specified tenant', async () => {
      // Create a schedule for tenant A
      const facilityA = await storage.createFacility({
        name: 'Facility A',
        address1: '123 Test St',
        city: 'Test City', 
        state: 'TS',
        pincode: '12345',
        tenantId: tenantAId
      });

      const dockA = await storage.createDock({
        name: 'Dock A1',
        facilityId: facilityA.id,
        isActive: true,
        type: 'inbound'
      });

      const scheduleA = await storage.createSchedule({
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        status: 'scheduled',
        dockId: dockA.id,
        truckNumber: 'TRUCK-A-001',
        createdBy: userAId
      });

      // Create a schedule for tenant B
      const facilityB = await storage.createFacility({
        name: 'Facility B',
        address1: '456 Test Ave',
        city: 'Test City',
        state: 'TS', 
        pincode: '12345',
        tenantId: tenantBId
      });

      const dockB = await storage.createDock({
        name: 'Dock B1',
        facilityId: facilityB.id,
        isActive: true,
        type: 'inbound'
      });

      const scheduleB = await storage.createSchedule({
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        status: 'scheduled',
        dockId: dockB.id,
        truckNumber: 'TRUCK-B-001',
        createdBy: userBId
      });

      // Test: Tenant A should only see their schedules
      const tenantASchedules = await storage.getSchedules(tenantAId);
      expect(tenantASchedules).toHaveLength(1);
      expect(tenantASchedules[0].id).toBe(scheduleA.id);
      expect(tenantASchedules[0].truckNumber).toBe('TRUCK-A-001');

      // Test: Tenant B should only see their schedules
      const tenantBSchedules = await storage.getSchedules(tenantBId);
      expect(tenantBSchedules).toHaveLength(1);
      expect(tenantBSchedules[0].id).toBe(scheduleB.id);
      expect(tenantBSchedules[0].truckNumber).toBe('TRUCK-B-001');

      // Test: No tenant ID should return all schedules (admin access)
      const allSchedules = await storage.getSchedules();
      expect(allSchedules.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Asset Tenant Isolation', () => {
    it('should only return assets for the specified tenant', async () => {
      // Create assets for both tenants
      const assetA = await storage.createCompanyAsset({
        name: 'Asset A',
        manufacturer: 'Manufacturer A',
        owner: 'Owner A',
        category: 'OFFICE_EQUIPMENT',
        tenantId: tenantAId
      });

      const assetB = await storage.createCompanyAsset({
        name: 'Asset B', 
        manufacturer: 'Manufacturer B',
        owner: 'Owner B',
        category: 'OFFICE_EQUIPMENT',
        tenantId: tenantBId
      });

      // Test: Get assets with tenant filtering
      const tenantAAssets = await storage.getCompanyAssets({ tenantId: tenantAId });
      const tenantBAssets = await storage.getCompanyAssets({ tenantId: tenantBId });

      // Verify tenant isolation
      expect(tenantAAssets).toHaveLength(1);
      expect(tenantAAssets[0].name).toBe('Asset A');
      expect(tenantAAssets[0].tenantId).toBe(tenantAId);

      expect(tenantBAssets).toHaveLength(1);
      expect(tenantBAssets[0].name).toBe('Asset B');
      expect(tenantBAssets[0].tenantId).toBe(tenantBId);

      // Ensure no cross-tenant data leakage
      expect(tenantAAssets.some(asset => asset.tenantId === tenantBId)).toBe(false);
      expect(tenantBAssets.some(asset => asset.tenantId === tenantAId)).toBe(false);
    });
  });
}); 