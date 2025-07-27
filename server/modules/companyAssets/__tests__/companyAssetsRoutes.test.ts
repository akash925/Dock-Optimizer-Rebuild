import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initializeCompanyAssetsModule } from '../index.js';

// Mock the storage
vi.mock('../../../storage', () => ({
  getStorage: vi.fn().mockResolvedValue({
    getCompanyAssetById: vi.fn(),
    updateCompanyAsset: vi.fn(),
    listCompanyAssets: vi.fn(),
    createCompanyAsset: vi.fn(),
    deleteCompanyAsset: vi.fn(),
  })
}));

// Mock the service
vi.mock('../service', () => ({
  companyAssetsService: {
    getCompanyAssetById: vi.fn(),
    updateCompanyAsset: vi.fn(),
    listCompanyAssets: vi.fn(),
    createCompanyAsset: vi.fn(),
    deleteCompanyAsset: vi.fn(),
  }
}));

describe('Company Assets Routes Integration', () => {
  let app: express.Express;
  let mockStorage: any;
  let mockService: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = { 
        id: 1, 
        tenantId: 1,
        role: 'admin'
      };
      req.isAuthenticated = () => true;
      next();
    });

    // Initialize the company assets module
    initializeCompanyAssetsModule(app);

    // Get mock instances
    const { getStorage } = await import('../../../storage');
    mockStorage = await getStorage();

    const { companyAssetsService } = await import('../service');
    mockService = companyAssetsService;
  });

  describe('New Company Assets Routes (/api/company-assets)', () => {
    it('should handle PUT /api/company-assets/:id and return 200', async () => {
      const assetId = 123;
      const updateData = {
        name: 'Updated Asset Name',
        description: 'Updated description',
        status: 'ACTIVE'
      };

      const mockAsset = {
        id: assetId,
        tenantId: 1,
        name: 'Test Asset',
        description: 'Test description',
        status: 'ACTIVE'
      };

      const updatedAsset = {
        ...mockAsset,
        ...updateData
      };

      // Mock the service methods
      mockService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockService.updateCompanyAsset.mockResolvedValue(updatedAsset);

      const response = await request(app)
        .put(`/api/company-assets/${assetId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        id: assetId,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status
      }));

      expect(mockService.getCompanyAssetById).toHaveBeenCalledWith(assetId);
      expect(mockService.updateCompanyAsset).toHaveBeenCalledWith(assetId, expect.objectContaining(updateData));
    });

    it('should handle GET /api/company-assets and return 200', async () => {
      const mockAssets = [
        { id: 1, name: 'Asset 1', tenantId: 1 },
        { id: 2, name: 'Asset 2', tenantId: 1 }
      ];

      mockService.listCompanyAssets.mockResolvedValue(mockAssets);

      const response = await request(app)
        .get('/api/company-assets')
        .expect(200);

      expect(response.body).toEqual(mockAssets);
      expect(mockService.listCompanyAssets).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 1 })
      );
    });

    it('should handle POST /api/company-assets and return 201', async () => {
      const newAssetData = {
        name: 'New Asset',
        manufacturer: 'Test Manufacturer',
        owner: 'Test Owner',
        category: 'EQUIPMENT'
      };

      const createdAsset = {
        id: 1,
        ...newAssetData,
        tenantId: 1
      };

      mockService.createCompanyAsset.mockResolvedValue(createdAsset);

      const response = await request(app)
        .post('/api/company-assets')
        .send(newAssetData)
        .expect(201);

      expect(response.body).toEqual(expect.objectContaining(createdAsset));
      expect(mockService.createCompanyAsset).toHaveBeenCalled();
    });

    it('should handle DELETE /api/company-assets/:id and return 200', async () => {
      const assetId = 123;
      const mockAsset = {
        id: assetId,
        tenantId: 1,
        name: 'Test Asset'
      };

      mockService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockService.deleteCompanyAsset.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/company-assets/${assetId}`)
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        message: expect.any(String)
      }));

      expect(mockService.getCompanyAssetById).toHaveBeenCalledWith(assetId);
      expect(mockService.deleteCompanyAsset).toHaveBeenCalledWith(assetId);
    });
  });

  describe('Legacy Routes (/api/assets) - Should Return 404', () => {
    it('should return 404 for PUT /api/assets/:id', async () => {
      const response = await request(app)
        .put('/api/assets/123')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body).toEqual(expect.objectContaining({
        error: expect.any(String)
      }));
    });

    it('should return 404 for GET /api/assets', async () => {
      await request(app)
        .get('/api/assets')
        .expect(404);
    });

    it('should return 404 for POST /api/assets', async () => {
      await request(app)
        .post('/api/assets')
        .send({ name: 'Test Asset' })
        .expect(404);
    });

    it('should return 404 for DELETE /api/assets/:id', async () => {
      await request(app)
        .delete('/api/assets/123')
        .expect(404);
    });

    it('should return 404 for GET /api/assets/:id', async () => {
      await request(app)
        .get('/api/assets/123')
        .expect(404);
    });
  });

  describe('Route Conflict Resolution', () => {
    it('should not have route conflicts - PUT operations should be handled only by /api/company-assets', async () => {
      const assetId = 123;
      
      // The new route should work
      const mockAsset = {
        id: assetId,
        tenantId: 1,
        name: 'Test Asset'
      };

      mockService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockService.updateCompanyAsset.mockResolvedValue({ ...mockAsset, name: 'Updated' });

      const validResponse = await request(app)
        .put(`/api/company-assets/${assetId}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(validResponse.body).toEqual(expect.objectContaining({
        name: 'Updated'
      }));

      // The legacy route should not work
      await request(app)
        .put(`/api/assets/${assetId}`)
        .send({ name: 'Should Fail' })
        .expect(404);
    });
  });
}); 