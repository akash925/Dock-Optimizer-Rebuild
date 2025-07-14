import { describe, it, expect, vi, Mock } from 'vitest';
import MediaService from '../MediaService';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorage, IStorage } from '../../storage';

vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('../../storage');

describe('MediaService', () => {
  const setup = async () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

    const mockS3Client = { send: vi.fn() };
    (S3Client as any).mockImplementation(() => mockS3Client);

    const mockStorage = {
      createFileRecord: vi.fn(),
    } as any;
    (getStorage as Mock).mockResolvedValue(mockStorage);
    
    const mediaService = new MediaService(mockStorage);
    return { mediaService, mockStorage, mockS3Client };
  };

  describe('constructor', () => {
    it('should initialize successfully with valid environment variables', async () => {
      const { mediaService } = await setup();
      expect(mediaService.isConfigured()).toBe(true);
    });

    it('should be marked as not configured if AWS_S3_BUCKET is missing', async () => {
      delete process.env.AWS_S3_BUCKET;
      const { mediaService } = await setup();
      expect(mediaService.isConfigured()).toBe(false);
    });

    it('should be marked as not configured if AWS credentials are missing', async () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      const { mediaService } = await setup();
      expect(mediaService.isConfigured()).toBe(false);
    });
  });

  describe('generatePresignedUpload', () => {
    it('should generate presigned URL successfully', async () => {
      const { mediaService, mockS3Client } = await setup();
      const mockSignedUrl = 'https://test-bucket.s3.amazonaws.com/signed-url';
      (getSignedUrl as any).mockResolvedValue(mockSignedUrl);

      const options = {
        tenantId: 1,
        uploadedBy: 1,
        folder: 'assets',
      };

      const result = await mediaService.generatePresignedUpload(
        'test-image.jpg',
        'image/jpeg',
        options
      );

      expect(result).toMatchObject({
        uploadUrl: mockSignedUrl,
        key: expect.stringMatching(/^tenants\/1\/assets\/\d+-[a-f0-9]+\.jpg$/),
      });
    });
  });
  
  describe('confirmUpload', () => {
    it('should confirm upload and create file record', async () => {
      const { mediaService, mockStorage, mockS3Client } = await setup();
      const mockHeadResult = { ContentLength: 1024 };
      mockS3Client.send.mockResolvedValue(mockHeadResult);

      const options = { tenantId: 1, uploadedBy: 1, folder: 'assets' };

      const result = await mediaService.confirmUpload(
        'tenants/1/assets/test-key.jpg',
        'test-image.jpg',
        'image/jpeg',
        options
      );

      expect(result).toMatchObject({
        key: 'tenants/1/assets/test-key.jpg',
        originalName: 'test-image.jpg',
        size: 1024,
      });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(mockStorage.createFileRecord).toHaveBeenCalledWith(expect.objectContaining({
        path: 'tenants/1/assets/test-key.jpg'
      }));
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3 successfully', async () => {
      const { mediaService, mockS3Client } = await setup();
      mockS3Client.send.mockResolvedValue({});
      const result = await mediaService.deleteFile('test-key', 1);
      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });
  
  describe('validateConfiguration', () => {
    it('should return true for valid configuration', async () => {
      const { mediaService, mockS3Client } = await setup();
      mockS3Client.send.mockResolvedValue({});
      const isValid = await mediaService.validateConfiguration();
      expect(isValid).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
    });

    it('should return false for invalid configuration', async () => {
      const { mediaService, mockS3Client } = await setup();
      mockS3Client.send.mockRejectedValue(new Error('Access denied'));
      const isValid = await mediaService.validateConfiguration();
      expect(isValid).toBe(false);
    });
  });
}); 