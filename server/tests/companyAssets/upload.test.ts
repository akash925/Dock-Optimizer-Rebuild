import request from 'supertest';
import express from 'express';
import { initializeCompanyAssetsModule } from '../../modules/companyAssets/index';
import { companyAssetsService } from '../../modules/companyAssets/service';

// Mock dependencies
jest.mock('../../modules/companyAssets/service');
jest.mock('../../middleware/auth', () => ({
  isAuthenticated: (req: any, res: any, next: any) => {
    req.user = { 
      id: 1, 
      tenantId: 1, 
      role: 'admin' 
    };
    next();
  }
}));

const mockCompanyAssetsService = companyAssetsService as jest.Mocked<typeof companyAssetsService>;

describe('Company Assets Upload Functionality', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Initialize the company assets module
    initializeCompanyAssetsModule(app);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Router Exports and Initialization', () => {
    it('should initialize the companyAssets module without errors', () => {
      // If we get here without throwing, the module loaded successfully
      expect(true).toBe(true);
    });

    it('should register legacy routes at /api/assets', async () => {
      // Mock the service method
      mockCompanyAssetsService.list.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/assets')
        .expect(200);
      
      expect(response.body).toEqual([]);
      expect(mockCompanyAssetsService.list).toHaveBeenCalled();
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

  describe('Company Asset CRUD Operations', () => {
    const mockAsset = {
      id: 1,
      name: 'Test Asset',
      manufacturer: 'Test Manufacturer',
      owner: 'Test Owner',
      category: 'EQUIPMENT',
      description: 'Test Description',
      barcode: '12345',
      status: 'ACTIVE',
      location: 'Test Location',
      department: 'Test Department',
      tags: '["tag1", "tag2"]',
      photoUrl: null,
      tenantId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should create a new company asset', async () => {
      mockCompanyAssetsService.createCompanyAsset.mockResolvedValue(mockAsset);
      
      const assetData = {
        name: 'Test Asset',
        manufacturer: 'Test Manufacturer',
        owner: 'Test Owner',
        category: 'EQUIPMENT',
        description: 'Test Description',
        barcode: '12345',
        status: 'ACTIVE',
        location: 'Test Location',
        department: 'Test Department',
        tags: '["tag1", "tag2"]'
      };

      const response = await request(app)
        .post('/api/company-assets')
        .send(assetData)
        .expect(201);

      expect(response.body).toEqual(expect.objectContaining({
        id: mockAsset.id,
        name: mockAsset.name,
        manufacturer: mockAsset.manufacturer
      }));
      expect(mockCompanyAssetsService.createCompanyAsset).toHaveBeenCalledWith(
        expect.objectContaining(assetData)
      );
    });

    it('should get a company asset by ID', async () => {
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset);
      
      const response = await request(app)
        .get('/api/company-assets/1')
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        id: mockAsset.id,
        name: mockAsset.name
      }));
      expect(mockCompanyAssetsService.getCompanyAssetById).toHaveBeenCalledWith(1);
    });

    it('should update a company asset', async () => {
      const updatedAsset = { ...mockAsset, name: 'Updated Asset' };
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockCompanyAssetsService.updateCompanyAsset.mockResolvedValue(updatedAsset);
      
      const updateData = { name: 'Updated Asset' };

      const response = await request(app)
        .put('/api/company-assets/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        id: mockAsset.id,
        name: 'Updated Asset'
      }));
      expect(mockCompanyAssetsService.updateCompanyAsset).toHaveBeenCalledWith(
        1,
        expect.objectContaining(updateData)
      );
    });

    it('should delete a company asset', async () => {
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockCompanyAssetsService.deleteCompanyAsset.mockResolvedValue(true);
      
      await request(app)
        .delete('/api/company-assets/1')
        .expect(204);

      expect(mockCompanyAssetsService.deleteCompanyAsset).toHaveBeenCalledWith(1);
    });
  });

  describe('Photo Upload Functionality', () => {
    it('should provide presigned URL for photo upload', async () => {
      const mockPresignedData = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: { 
          key: 'assets/123/photo.jpg',
          'Content-Type': 'image/jpeg'
        }
      };

      // Mock the controller response
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        tenantId: 1,
        photoUrl: null
      };
      
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset);

      const response = await request(app)
        .post('/api/company-assets/1/photo/presign')
        .send({ contentType: 'image/jpeg' })
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('fields');
    });

    it('should update photo key after successful upload', async () => {
      const mockAsset = {
        id: 1,
        name: 'Test Asset',
        tenantId: 1,
        photoUrl: null
      };

      const updatedAsset = {
        ...mockAsset,
        photoUrl: 'assets/123/photo.jpg'
      };
      
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(mockAsset);
      mockCompanyAssetsService.updateCompanyAsset.mockResolvedValue(updatedAsset);

      const response = await request(app)
        .put('/api/company-assets/1/photo')
        .send({ key: 'assets/123/photo.jpg' })
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        id: mockAsset.id,
        photoUrl: 'assets/123/photo.jpg'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle missing asset name during creation', async () => {
      const response = await request(app)
        .post('/api/company-assets')
        .send({
          manufacturer: 'Test Manufacturer',
          category: 'EQUIPMENT'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Asset Name is required');
    });

    it('should handle invalid category during creation', async () => {
      const response = await request(app)
        .post('/api/company-assets')
        .send({
          name: 'Test Asset',
          category: 'INVALID_CATEGORY'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid category');
    });

    it('should handle asset not found', async () => {
      mockCompanyAssetsService.getCompanyAssetById.mockResolvedValue(undefined);
      
      const response = await request(app)
        .get('/api/company-assets/999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });
}); 