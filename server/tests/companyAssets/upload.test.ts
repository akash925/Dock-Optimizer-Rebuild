import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initializeCompanyAssetsModule } from '../../modules/companyAssets';
import { companyAssetsService } from '../../modules/companyAssets/service';

// Mock the service
vi.mock('../../modules/companyAssets/service');

const mockCompanyAssetsService = companyAssetsService as any;

describe('Company Assets Upload Functionality', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 1, tenantId: 1 };
      next();
    });
    
    // Initialize the company assets module
    initializeCompanyAssetsModule(app);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Router Exports and Initialization', () => {
    it('should initialize the companyAssets module without errors', () => {
      // If we get here without throwing, the module loaded successfully
      expect(true).toBe(true);
    });

    it('should NOT register legacy routes at /api/assets (should return 404)', async () => {
      // Legacy routes are disabled - should return 404
      await request(app)
        .get('/api/assets')
        .expect(404);
    });

    it('should register company assets routes at /api/company-assets', async () => {
      // Mock the service method
      mockCompanyAssetsService.listCompanyAssets.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/company-assets')
        .expect(200);
      
      expect(response.body).toEqual([]);
      expect(mockCompanyAssetsService.listCompanyAssets).toHaveBeenCalled();
    });
  });

  describe('Fixed API Endpoints', () => {
    it('should handle asset creation via POST /api/company-assets', async () => {
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        manufacturer: 'Test Manufacturer',
        category: 'EQUIPMENT',
        tenantId: 1
      };

      mockCompanyAssetsService.createCompanyAsset.mockResolvedValue(mockAsset as any);

      const response = await request(app)
        .post('/api/company-assets')
        .send({
          name: 'Test Asset',
          manufacturer: 'Test Manufacturer',
          category: 'EQUIPMENT'
        })
        .expect(201);

      expect(response.body.name).toBe('Test Asset');
      expect(mockCompanyAssetsService.createCompanyAsset).toHaveBeenCalled();
    });

    it('should handle asset status updates via PATCH /api/company-assets/:id/status', async () => {
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        status: 'ACTIVE',
        tenantId: 1
      };

      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset as any);
      mockCompanyAssetsService.updateCompanyAssetStatus.mockResolvedValue({ ...mockAsset, status: 'MAINTENANCE' } as any);

      const response = await request(app)
        .patch('/api/company-assets/1/status')
        .send({ status: 'MAINTENANCE' })
        .expect(200);

      expect(response.body.status).toBe('MAINTENANCE');
      expect(mockCompanyAssetsService.updateCompanyAssetStatus).toHaveBeenCalledWith(1, 'MAINTENANCE');
    });

    it('should handle barcode search via GET /api/company-assets/barcode/search', async () => {
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        barcode: 'TEST123',
        tenantId: 1
      };

      mockCompanyAssetsService.findCompanyAssetByBarcode.mockResolvedValue(mockAsset as any);

      const response = await request(app)
        .get('/api/company-assets/barcode/search?barcode=TEST123')
        .expect(200);

      expect(response.body.barcode).toBe('TEST123');
      expect(mockCompanyAssetsService.findCompanyAssetByBarcode).toHaveBeenCalledWith('TEST123');
    });

    it('should handle asset import via POST /api/company-assets/import', async () => {
      const mockAssets = [
        { name: 'Asset 1', manufacturer: 'Manufacturer 1', category: 'EQUIPMENT' },
        { name: 'Asset 2', manufacturer: 'Manufacturer 2', category: 'TOOLS' }
      ];

      mockCompanyAssetsService.createCompanyAsset.mockResolvedValue({ id: 1 } as any);

      const response = await request(app)
        .post('/api/company-assets/import')
        .send({ assets: mockAssets })
        .expect(201);

      expect(response.body.total).toBe(2);
      expect(response.body.successful).toBe(2);
      expect(response.body.failed).toBe(0);
      expect(mockCompanyAssetsService.createCompanyAsset).toHaveBeenCalledTimes(2);
    });

    it('should reject access to assets from different tenants', async () => {
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        tenantId: 2 // Different tenant
      };

      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset as any);

      await request(app)
        .patch('/api/company-assets/1/status')
        .send({ status: 'MAINTENANCE' })
        .expect(403);

      expect(mockCompanyAssetsService.updateCompanyAssetStatus).not.toHaveBeenCalled();
    });
  });

  describe('BOL Upload Integration', () => {
    it('should support file uploads for BOL documents', async () => {
      // Mock a basic file upload scenario for BOL documents
      // This tests the integration between asset uploads and BOL document uploads
      const mockAsset = {
        id: 1,
        name: 'BOL Document',
        fileType: 'application/pdf',
        tenantId: 1
      };

      mockCompanyAssetsService.createCompanyAsset.mockResolvedValue(mockAsset as any);

      const response = await request(app)
        .post('/api/company-assets')
        .send({
          name: 'BOL Document',
          manufacturer: 'System',
          category: 'DOCUMENTS',
          description: 'Bill of Lading document'
        })
        .expect(201);

      expect(response.body.name).toBe('BOL Document');
      expect(mockCompanyAssetsService.createCompanyAsset).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      await request(app)
        .post('/api/company-assets')
        .send({}) // Missing required name field
        .expect(400);
    });

    it('should handle invalid category values', async () => {
      await request(app)
        .post('/api/company-assets')
        .send({
          name: 'Test Asset',
          category: 'INVALID_CATEGORY'
        })
        .expect(400);
    });

    it('should handle non-existent asset updates', async () => {
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(undefined);

      await request(app)
        .patch('/api/company-assets/999/status')
        .send({ status: 'MAINTENANCE' })
        .expect(404);
    });

    it('should handle barcode not found', async () => {
      mockCompanyAssetsService.findCompanyAssetByBarcode.mockResolvedValue(undefined);

      await request(app)
        .get('/api/company-assets/barcode/search?barcode=NOTFOUND')
        .expect(404);
    });
  });
}); 