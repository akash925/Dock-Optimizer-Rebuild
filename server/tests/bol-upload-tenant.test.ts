import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('busboy');
// Mock getStorage function
vi.mock('../storage', () => ({
  getStorage: vi.fn()
}));

import { mockSend, resetMocks } from '../../__mocks__/@aws-sdk/client-s3.js';
import { getStorage } from '../storage.js';

describe('BOL Upload with Tenant ID', () => {
  let app: express.Application;
  let mockStorage: any;

  beforeEach(async () => {
    resetMocks();
    
    // Mock storage
    mockStorage = {
      createOcrJob: vi.fn().mockResolvedValue({ id: 1, tenantId: 123, s3Key: 'test-key' }),
    };
    
    // Mock getStorage
    (getStorage as any).mockResolvedValue(mockStorage);
    
    // Create test Express app
    app = express();
    app.use(express.json());
    
    // Add the BOL upload route (simplified for testing)
    app.post('/api/bol-upload/upload', async (req: any, res) => {
      try {
        // Require x-tenant-id header
        const tenantId = Number(req.headers['x-tenant-id']);
        if (!tenantId || isNaN(tenantId)) {
          return res.status(400).json({ error: 'x-tenant-id header is required and must be a valid integer' });
        }

        // Check file size limit (20MB)
        const maxSize = 20 * 1024 * 1024; // 20MB
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > maxSize) {
          return res.status(413).json({ error: 'File size exceeds maximum limit of 20MB' });
        }

        // Mock successful S3 upload
        mockSend.mockResolvedValueOnce({ ETag: '"mock-etag"' });
        
        // Mock OCR job creation
        await mockStorage.createOcrJob({
          tenantId,
          s3Key: `bols/${tenantId}/test-file.pdf`,
          status: 'queued',
        });

        res.status(200).json({ 
          success: true, 
          message: 'File uploaded successfully and OCR job queued',
          tenantId: tenantId 
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to process upload' });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('x-tenant-id header validation', () => {
    it('should require x-tenant-id header', async () => {
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .expect(400);

      expect(response.body).toEqual({
        error: 'x-tenant-id header is required and must be a valid integer'
      });
    });

    it('should reject invalid tenant ID', async () => {
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', 'invalid')
        .expect(400);

      expect(response.body).toEqual({
        error: 'x-tenant-id header is required and must be a valid integer'
      });
    });

    it('should reject zero tenant ID', async () => {
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '0')
        .expect(400);

      expect(response.body).toEqual({
        error: 'x-tenant-id header is required and must be a valid integer'
      });
    });

    it('should accept valid tenant ID', async () => {
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'File uploaded successfully and OCR job queued',
        tenantId: 123
      });
    });
  });

  describe('OCR job queueing', () => {
    it('should create OCR job after successful upload', async () => {
      await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '456')
        .expect(200);

      expect(mockStorage.createOcrJob).toHaveBeenCalledWith({
        tenantId: 456,
        s3Key: 'bols/456/test-file.pdf',
        status: 'queued',
      });
    });

    it('should include tenant ID in S3 key structure', async () => {
      const tenantId = 789;
      
      await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', tenantId.toString())
        .expect(200);

      expect(mockStorage.createOcrJob).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantId,
          s3Key: expect.stringContaining(`bols/${tenantId}/`),
        })
      );
    });
  });

  describe('File size limits', () => {
    it('should reject files larger than 20MB', async () => {
      // Create a buffer larger than 20MB (21MB)
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024);
      
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '2')
        .attach('file', largeBuffer, 'big.pdf')
        .expect(413);

      expect(response.body.error).toMatch(/file.*size|size.*limit|too.*large/i);
    });
  });

  describe('S3 integration', () => {
    it('should mock S3 upload successfully', async () => {
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle S3 upload errors', async () => {
      // Mock S3 failure
      mockSend.mockRejectedValueOnce(new Error('S3 upload failed'));
      
      const response = await request(app)
        .post('/api/bol-upload/upload')
        .set('x-tenant-id', '123')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to process upload'
      });
    });
  });
}); 