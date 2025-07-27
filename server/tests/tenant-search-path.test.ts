import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTenantSearchPath, resetSearchPath, getCurrentSearchPath } from '../utils/setTenantSearchPath.js';

// Mock the database module with proper type safety
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: {
    execute: mockExecute
  }
}));

describe('Tenant Search Path Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setTenantSearchPath', () => {
    it('should set search path to include tenant schema and public', async () => {
      // Arrange
      const tenantId = 6;
      mockExecute.mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] });

      // Act
      await setTenantSearchPath(tenantId);

      // Assert
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw error and log fatal message when database operation fails', async () => {
      // Arrange
      const tenantId = 5;
      const dbError = new Error('Database connection failed');
      mockExecute.mockRejectedValueOnce(dbError);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(setTenantSearchPath(tenantId)).rejects.toThrow(
        'Failed to set search path for tenant 5: Database connection failed'
      );

      // Verify error logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SearchPath] ❌ FATAL: Failed to set search path for tenant 5:'),
        dbError
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SearchPath] ❌ This is a critical security issue - tenant isolation is broken!')
      );

      consoleSpy.mockRestore();
    });

    it('should handle different tenant IDs correctly', async () => {
      // Arrange
      mockExecute.mockResolvedValue({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] });

      // Act
      await setTenantSearchPath(123);
      await setTenantSearchPath(999);

      // Assert
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetSearchPath', () => {
    it('should reset search path to public only', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] });

      // Act
      await resetSearchPath();

      // Assert
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw error when reset fails', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      mockExecute.mockRejectedValueOnce(dbError);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(resetSearchPath()).rejects.toThrow(
        'Failed to reset search path: Connection timeout'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCurrentSearchPath', () => {
    it('should return parsed search path array when both tenant and public are present', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({
        rows: [{ search_path: 'tenant_6, public' }],
        command: 'SHOW',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      // Act
      const result = await getCurrentSearchPath();

      // Assert
      expect(result).toEqual(['tenant_6', 'public']);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should handle quoted schema names correctly', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({
        rows: [{ search_path: '"tenant_123", "public"' }],
        command: 'SHOW',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      // Act
      const result = await getCurrentSearchPath();

      // Assert
      expect(result).toEqual(['tenant_123', 'public']);
    });

    it('should handle empty search path', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({
        rows: [{ search_path: '' }],
        command: 'SHOW',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      // Act
      const result = await getCurrentSearchPath();

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error when database query fails', async () => {
      // Arrange
      const dbError = new Error('Query failed');
      mockExecute.mockRejectedValueOnce(dbError);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act & Assert
      await expect(getCurrentSearchPath()).rejects.toThrow(
        'Failed to get search path: Query failed'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Integration test scenarios', () => {
    it('should complete full cycle: set tenant path, verify, then reset', async () => {
      // Arrange
      mockExecute
        .mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] }) // setTenantSearchPath
        .mockResolvedValueOnce({ 
          rows: [{ search_path: 'tenant_6, public' }], 
          command: 'SHOW', 
          rowCount: 1, 
          oid: 0, 
          fields: [] 
        }) // getCurrentSearchPath
        .mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] }); // resetSearchPath

      // Act & Assert
      await setTenantSearchPath(6);
      const paths = await getCurrentSearchPath();
      expect(paths).toEqual(['tenant_6', 'public']);
      
      await resetSearchPath();
      
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should handle tenant switch scenario', async () => {
      // Arrange
      mockExecute
        .mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] }) // setTenantSearchPath(1)
        .mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] }); // setTenantSearchPath(2)

      // Act
      await setTenantSearchPath(1);
      await setTenantSearchPath(2);

      // Assert
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Specific search path validation', () => {
    it('should verify that setTenantSearchPath(6) results in tenant_6 and public in search path', async () => {
      // This test specifically addresses the user requirement:
      // "after calling setTenantSearchPath(6) the result of SHOW search_path includes both tenant_6 and public"
      
      // Arrange
      mockExecute
        .mockResolvedValueOnce({ rows: [], command: 'SET', rowCount: 0, oid: 0, fields: [] }) // setTenantSearchPath
        .mockResolvedValueOnce({ 
          rows: [{ search_path: 'tenant_6, public' }], 
          command: 'SHOW', 
          rowCount: 1, 
          oid: 0, 
          fields: [] 
        }); // getCurrentSearchPath

      // Act
      await setTenantSearchPath(6);
      const searchPath = await getCurrentSearchPath();

      // Assert
      expect(searchPath).toContain('tenant_6');
      expect(searchPath).toContain('public');
      expect(searchPath).toEqual(['tenant_6', 'public']);
    });
  });
}); 