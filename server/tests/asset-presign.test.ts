import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3Client } from '@aws-sdk/client-s3';

// Mock AWS SDK v3 modules
vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn()
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({}))
}));

describe('Asset Presign Happy Path Tests', () => {
  const mockUser = {
    id: 1,
    tenantId: 2,
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin'
  };

  const mockAsset = {
    id: 445,
    name: 'Test Asset',
    tenantId: 2,
    manufacturer: 'Test Manufacturer',
    owner: 'Test Owner',
    category: 'OTHER',
    status: 'ACTIVE'
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock createPresignedPost to return deterministic response
    (createPresignedPost as any).mockResolvedValue({
      url: 'https://test-bucket.s3.amazonaws.com',
      fields: {
        'Content-Type': 'image/jpeg',
        'key': 'photos/test-uuid.jpg',
        'AWSAccessKeyId': 'test-access-key',
        'policy': 'test-policy',
        'signature': 'test-signature'
      }
    });
  });

  it('should generate presigned URL for asset photo upload', async () => {
    // Mock the Express app and middleware
    const app = require('../index'); // Assuming the main Express app is exported from index
    
    // Mock the authentication middleware to provide our test user
    vi.doMock('../../middleware/auth', () => ({
      isAuthenticated: (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      }
    }));

    // Mock the company assets service to return our test asset
    vi.doMock('../modules/companyAssets/service', () => ({
      companyAssetsService: {
        getCompanyAssetById: vi.fn().mockResolvedValue(mockAsset),
        updateCompanyAsset: vi.fn().mockResolvedValue({ ...mockAsset, photoUrl: 'photos/test-uuid.jpg' })
      }
    }));

    const response = await request(app)
      .post('/api/company-assets/445/photo/presign')
      .send({
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024000 // 1MB
      })
      .expect(200);

    // Verify response structure
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('fields');
    expect(response.body).toHaveProperty('key');

    // Verify deterministic URL
    expect(response.body.url).toBe('https://test-bucket.s3.amazonaws.com');
    
    // Verify fields structure
    expect(response.body.fields).toHaveProperty('Content-Type', 'image/jpeg');
    expect(response.body.fields).toHaveProperty('key', 'photos/test-uuid.jpg');
    expect(response.body.fields).toHaveProperty('AWSAccessKeyId', 'test-access-key');

    // Verify createPresignedPost was called with correct parameters
    expect(createPresignedPost).toHaveBeenCalledWith(
      expect.any(Object), // S3Client instance
      expect.objectContaining({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: expect.stringMatching(/^photos\/.+\.jpg$/),
        Expires: 60,
        Conditions: expect.arrayContaining([
          ["content-length-range", 0, 10 * 1024 * 1024],
          ["eq", "$Content-Type", "image/jpeg"]
        ]),
        Fields: {
          'Content-Type': 'image/jpeg'
        }
      })
    );
  });

  it('should reject invalid file types', async () => {
    const app = require('../index');
    
    // Mock middleware and services
    vi.doMock('../../middleware/auth', () => ({
      isAuthenticated: (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      }
    }));

    vi.doMock('../modules/companyAssets/service', () => ({
      companyAssetsService: {
        getCompanyAssetById: vi.fn().mockResolvedValue(mockAsset)
      }
    }));

    const response = await request(app)
      .post('/api/company-assets/445/photo/presign')
      .send({
        fileName: 'test-document.pdf',
        fileType: 'application/pdf',
        fileSize: 1024000
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('File type application/pdf not allowed');
  });

  it('should reject files exceeding size limit', async () => {
    const app = require('../index');
    
    // Mock middleware and services
    vi.doMock('../../middleware/auth', () => ({
      isAuthenticated: (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      }
    }));

    vi.doMock('../modules/companyAssets/service', () => ({
      companyAssetsService: {
        getCompanyAssetById: vi.fn().mockResolvedValue(mockAsset)
      }
    }));

    const response = await request(app)
      .post('/api/company-assets/445/photo/presign')
      .send({
        fileName: 'large-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 15 * 1024 * 1024 // 15MB (exceeds 10MB limit)
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('exceeds maximum allowed size');
  });

  it('should enforce tenant security for asset access', async () => {
    const app = require('../index');
    
    // Mock user from different tenant
    const differentTenantUser = { ...mockUser, tenantId: 999 };
    
    vi.doMock('../../middleware/auth', () => ({
      isAuthenticated: (req: any, res: any, next: any) => {
        req.user = differentTenantUser;
        next();
      }
    }));

    vi.doMock('../modules/companyAssets/service', () => ({
      companyAssetsService: {
        getCompanyAssetById: vi.fn().mockResolvedValue(mockAsset) // Asset belongs to tenant 2
      }
    }));

    const response = await request(app)
      .post('/api/company-assets/445/photo/presign')
      .send({
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024000
      })
      .expect(403);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Forbidden - Asset does not belong to your organization');
  });

  it('should return 404 for non-existent asset', async () => {
    const app = require('../index');
    
    vi.doMock('../../middleware/auth', () => ({
      isAuthenticated: (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      }
    }));

    vi.doMock('../modules/companyAssets/service', () => ({
      companyAssetsService: {
        getCompanyAssetById: vi.fn().mockResolvedValue(null) // Asset not found
      }
    }));

    const response = await request(app)
      .post('/api/company-assets/999/photo/presign')
      .send({
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024000
      })
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Company asset not found');
  });
}); 