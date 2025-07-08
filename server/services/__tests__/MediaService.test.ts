import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

// Set environment variables before importing MediaService
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

import { mediaService } from '../MediaService';
import MediaService from '../MediaService';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('../storage');

const mockS3Client = {
  send: vi.fn(),
};

const mockGetSignedUrl = getSignedUrl as any;
const MockS3Client = S3Client as any;

// Mock storage
const mockStorage = {
  createFileRecord: vi.fn(),
  getFileRecord: vi.fn(),
  deleteFileRecord: vi.fn(),
};

vi.mock('../storage', () => ({
  getStorage: vi.fn().mockResolvedValue(mockStorage),
}));

describe('MediaService', () => {
  beforeAll(() => {
    // Set required environment variables
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    MockS3Client.mockImplementation(() => mockS3Client as any);
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  describe('constructor', () => {
    it('should initialize successfully with valid environment variables', () => {
      expect(() => new MediaService()).not.toThrow();
    });

    it('should throw error if AWS_S3_BUCKET is missing', () => {
      const originalBucket = process.env.AWS_S3_BUCKET;
      delete process.env.AWS_S3_BUCKET;

      expect(() => new MediaService()).toThrow('AWS_S3_BUCKET environment variable is required');

      process.env.AWS_S3_BUCKET = originalBucket;
    });

    it('should throw error if AWS credentials are missing', () => {
      const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_ACCESS_KEY_ID;

      expect(() => new MediaService()).toThrow('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required');

      process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    });
  });

  describe('generatePresignedUpload', () => {
    it('should generate presigned URL successfully', async () => {
      const mockSignedUrl = 'https://test-bucket.s3.amazonaws.com/signed-url';
      mockGetSignedUrl.mockResolvedValue(mockSignedUrl);

      const options = {
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
        maxSizeBytes: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg'],
      };

      const result = await mediaService.generatePresignedUpload(
        'test-image.jpg',
        'image/jpeg',
        options
      );

      expect(result).toMatchObject({
        uploadUrl: mockSignedUrl,
        key: expect.stringMatching(/^tenants\/1\/assets\/\d+-[a-f0-9]+\.jpg$/),
        publicUrl: expect.stringContaining('test-bucket'),
        expiresAt: expect.any(Date),
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(PutObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should reject files that exceed size limit', async () => {
      const options = {
        tenantId: 1,
        uploadedBy: 1,
        maxSizeBytes: 1024, // 1KB limit
      };

      await expect(
        mediaService.generatePresignedUpload('large-file.jpg', 'image/jpeg', options)
      ).rejects.toThrow('File size cannot exceed 100MB');
    });

    it('should reject disallowed MIME types', async () => {
      const options = {
        tenantId: 1,
        uploadedBy: 1,
        allowedMimeTypes: ['image/jpeg'],
      };

      await expect(
        mediaService.generatePresignedUpload('document.pdf', 'application/pdf', options)
      ).rejects.toThrow('File type application/pdf is not allowed');
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload and create file record', async () => {
      const mockHeadResult = {
        ContentLength: 1024,
      };
      mockS3Client.send.mockResolvedValue(mockHeadResult);
      mockStorage.createFileRecord.mockResolvedValue({});

      const options = {
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
      };

      const result = await mediaService.confirmUpload(
        'tenants/1/assets/test-key.jpg',
        'test-image.jpg',
        'image/jpeg',
        options
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        key: 'tenants/1/assets/test-key.jpg',
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        publicUrl: expect.stringContaining('test-bucket'),
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
        createdAt: expect.any(Date),
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(mockStorage.createFileRecord).toHaveBeenCalledWith({
        id: expect.any(String),
        filename: 'test-image.jpg',
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: 'tenants/1/assets/test-key.jpg',
        uploadedBy: 1,
        uploadedAt: expect.any(Date),
      });
    });

    it('should handle S3 head object errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('File not found'));

      const options = {
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
      };

      await expect(
        mediaService.confirmUpload(
          'nonexistent-key',
          'test-image.jpg',
          'image/jpeg',
          options
        )
      ).rejects.toThrow('Failed to confirm file upload');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3 successfully', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await mediaService.deleteFile('test-key', 1);

      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should handle S3 delete errors gracefully', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Delete failed'));

      const result = await mediaService.deleteFile('test-key', 1);

      expect(result).toBe(false);
    });
  });

  describe('getPublicUrl', () => {
    it('should return CloudFront URL when configured', () => {
      process.env.AWS_CLOUDFRONT_DOMAIN = 'https://d123456789.cloudfront.net';
      const service = new MediaService();

      const url = service.getPublicUrl('test-key.jpg');

      expect(url).toBe('https://d123456789.cloudfront.net/test-key.jpg');

      delete process.env.AWS_CLOUDFRONT_DOMAIN;
    });

    it('should return S3 URL when CloudFront is not configured', () => {
      const url = mediaService.getPublicUrl('test-key.jpg');

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test-key.jpg');
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid configuration', async () => {
      // Mock ListObjectsV2Command
      const MockListObjectsV2Command = vi.fn();
      vi.doMock('@aws-sdk/client-s3', () => ({
        ...vi.importActual('@aws-sdk/client-s3'),
        ListObjectsV2Command: MockListObjectsV2Command,
      }));

      mockS3Client.send.mockResolvedValue({});

      const isValid = await mediaService.validateConfiguration();

      expect(isValid).toBe(true);
    });

    it('should return false for invalid configuration', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Access denied'));

      const isValid = await mediaService.validateConfiguration();

      expect(isValid).toBe(false);
    });
  });

  describe('migrateLocalFile', () => {
    it('should migrate local file to S3 successfully', async () => {
      const testBuffer = Buffer.from('test file content');
      mockS3Client.send.mockResolvedValue({});
      mockStorage.createFileRecord.mockResolvedValue({});

      const options = {
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
      };

      const result = await mediaService.migrateLocalFile(
        '/local/path/test.jpg',
        testBuffer,
        'test-image.jpg',
        'image/jpeg',
        options
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        key: expect.stringMatching(/^tenants\/1\/assets\/\d+-[a-f0-9]+\.jpg$/),
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: testBuffer.length,
        publicUrl: expect.stringContaining('test-bucket'),
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
        createdAt: expect.any(Date),
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(mockStorage.createFileRecord).toHaveBeenCalled();
    });
  });
}); 