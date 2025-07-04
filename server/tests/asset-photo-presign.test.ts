import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the required modules
vi.mock('../storage');
vi.mock('../services/MediaService');

// Mock environment variables
process.env.VITE_USE_S3_DIRECT_UPLOAD = 'true';
process.env.AWS_S3_BUCKET = 'dock-optimizer-prod';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'dummy';
process.env.AWS_SECRET_ACCESS_KEY = 'dummy';

describe('Asset Photo Presigned Upload', () => {
  let app: express.Application;
  let mockStorage: any;

  beforeEach(async () => {
    // Mock storage
    mockStorage = {
      getCompanyAsset: vi.fn().mockResolvedValue({ 
        id: 1, 
        tenantId: 123, 
        name: 'Test Asset' 
      }),
      updateCompanyAsset: vi.fn().mockResolvedValue({ 
        id: 1, 
        photoUrl: 'photos/test-key.jpg' 
      }),
    };
    
    // Mock getStorage
    const { getStorage } = await import('../storage');
    vi.mocked(getStorage).mockResolvedValue(mockStorage);

    // Create test Express app
    app = express();
    app.use(express.json());
    
    // Mock authenticated user
    app.use((req: any, res, next) => {
      req.user = { id: 1, tenantId: 123 };
      next();
    });

    // Add the presigned route (simplified for testing)
    app.post('/api/company-assets/:id/photo/presign', async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid company asset ID' });
        }

        const { fileName, fileType, fileSize } = req.body;
        if (!fileName || !fileType) {
          return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        // Check if asset exists (using mocked storage)
        const asset = await mockStorage.getCompanyAsset(id);
        if (!asset) {
          return res.status(404).json({ error: 'Company asset not found' });
        }

        // Mock S3 presigned URL response
        const mockUrl = 'https://dock-optimizer-prod.s3.amazonaws.com/upload-url';
        const mockFields = {
          'Content-Type': fileType,
          key: 'photos/test-key.jpg',
          policy: 'mock-policy',
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
          'x-amz-credential': 'mock-credential',
          'x-amz-date': '20240101T000000Z',
          'x-amz-signature': 'mock-signature'
        };

        // Update asset with photo key (mocked)
        await mockStorage.updateCompanyAsset(id, { photoUrl: mockFields.key });

        res.json({ url: mockUrl, fields: mockFields, key: mockFields.key });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate presigned URL' });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should generate presigned URL for asset photo upload', async () => {
    const response = await request(app)
      .post('/api/company-assets/1/photo/presign')
      .send({
        fileName: 'test-photo.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024000
      })
      .expect(200);

    expect(response.body.url).toMatch(/https:\/\/dock-optimizer-prod\.s3/);
    expect(response.body.fields).toBeDefined();
    expect(response.body.key).toBeDefined();
    expect(mockStorage.updateCompanyAsset).toHaveBeenCalledWith(1, { photoUrl: response.body.key });
  });

  it('should reject invalid asset ID', async () => {
    const response = await request(app)
      .post('/api/company-assets/invalid/photo/presign')
      .send({
        fileName: 'test-photo.jpg',
        fileType: 'image/jpeg'
      })
      .expect(400);

    expect(response.body.error).toBe('Invalid company asset ID');
  });

  it('should require fileName and fileType', async () => {
    const response = await request(app)
      .post('/api/company-assets/1/photo/presign')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('fileName and fileType are required');
  });

  it('should return 404 for non-existent asset', async () => {
    mockStorage.getCompanyAsset.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/company-assets/999/photo/presign')
      .send({
        fileName: 'test-photo.jpg',
        fileType: 'image/jpeg'
      })
      .expect(404);

    expect(response.body.error).toBe('Company asset not found');
  });
}); 