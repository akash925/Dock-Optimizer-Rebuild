import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { getStorage, IStorage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: Date;
}

export interface UploadFileOptions {
  tenantId: number;
  uploadedBy: number;
  folder?: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface MediaFileRecord {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  publicUrl: string;
  tenantId: number;
  uploadedBy: number;
  folder: string;
  createdAt: Date;
}

export interface MediaUploadOptions {
  tenantId: number;
  uploadedBy: number;
  folder?: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface MediaUploadResult {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  publicUrl: string;
  tenantId: number;
  uploadedBy: number;
  folder?: string;
  uploadUrl: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface MediaConfirmResult {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  publicUrl: string;
  tenantId: number;
  uploadedBy: number;
  folder?: string;
  createdAt: Date;
}

class MediaService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private cloudFrontDomain?: string;
  private initialized = false;
  private configurationValid = false;

  constructor() {
    // Load environment variables but don't validate in constructor
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    this.cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;

    // Check if configuration is valid
    this.configurationValid = !!(this.bucket && this.accessKeyId && this.secretAccessKey);
    
    if (!this.configurationValid) {
      console.warn('[MediaService] S3 configuration not found - S3 features will be disabled');
    }
  }

  private initialize() {
    if (this.initialized) {
      return;
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.configurationValid) {
      throw new Error('S3 configuration is not valid. Please check AWS environment variables.');
    }
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Check if S3 is configured and available
   */
  isConfigured(): boolean {
    return this.configurationValid;
  }

  /**
   * Generate a presigned URL for uploading a file directly to S3
   */
  async generatePresignedUpload(
    fileName: string,
    mimeType: string,
    options: MediaUploadOptions
  ): Promise<MediaUploadResult> {
    this.ensureInitialized();
    
    const {
      tenantId,
      uploadedBy,
      folder = 'uploads',
      maxSizeBytes = 100 * 1024 * 1024, // 100MB default
      allowedMimeTypes
    } = options;

    // Validate file size (we can't get exact size for presigned upload, so this is a max limit check)
    if (maxSizeBytes && maxSizeBytes > 100 * 1024 * 1024) {
      throw new Error('File size cannot exceed 100MB');
    }

    // Validate MIME type
    if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Generate unique key
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    const fileExtension = fileName.split('.').pop();
    const key = `tenants/${tenantId}/${folder}/${timestamp}-${uuid}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client!, command, {
      expiresIn: 3600, // 1 hour
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const publicUrl = this.getPublicUrl(key);

    return {
      id: uuidv4(),
      key,
      originalName: fileName,
      mimeType,
      size: 0, // Will be updated on confirmation
      publicUrl,
      tenantId,
      uploadedBy,
      folder,
      uploadUrl,
      expiresAt,
      createdAt: new Date(),
    };
  }

  /**
   * Confirm that a file was successfully uploaded and store metadata
   */
  async confirmUpload(
    key: string,
    originalName: string,
    mimeType: string,
    options: MediaUploadOptions
  ): Promise<MediaConfirmResult> {
    this.ensureInitialized();
    
    const { tenantId, uploadedBy, folder } = options;

    try {
      // Verify the file exists and get its size
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const headResult = await this.s3Client!.send(headCommand);
      const size = headResult.ContentLength || 0;

      // Create file record in storage
      const storage = await getStorage();
      const fileRecord = {
        id: uuidv4(),
        filename: originalName,
        originalName,
        mimeType,
        size,
        path: key,
        uploadedBy,
        uploadedAt: new Date(),
      };

      await storage.createFileRecord(fileRecord);

      const publicUrl = this.getPublicUrl(key);

      return {
        id: fileRecord.id,
        key,
        originalName,
        mimeType,
        size,
        publicUrl,
        tenantId,
        uploadedBy,
        folder,
        createdAt: fileRecord.uploadedAt,
      };
    } catch (error) {
      console.error('Failed to confirm upload:', error);
      throw new Error('Failed to confirm file upload');
    }
  }

  /**
   * Delete a file from S3 and database
   */
  async deleteFile(key: string, tenantId: number): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client!.send(command);

      // Also delete from storage
      // Note: For now we just delete from S3, storage cleanup can be added later
      console.log(`Deleted S3 object with key: ${key}`);

      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Generate a presigned URL for downloading/viewing a file
   */
  async generatePresignedDownload(key: string, expiresIn: number = 3600): Promise<string> {
    this.ensureInitialized();
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client!, command, { expiresIn });
  }

  /**
   * Get public URL for a file (uses CloudFront if configured)
   */
  getPublicUrl(key: string): string {
    if (this.cloudFrontDomain) {
      return `${this.cloudFrontDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate unique file key for S3
   */
  private generateFileKey(originalFileName: string, options: UploadFileOptions): string {
    const folder = options.folder || 'general';
    const tenantId = options.tenantId;
    const timestamp = Date.now();
    const randomSuffix = randomBytes(8).toString('hex');
    const extension = extname(originalFileName);
    
    return `tenants/${tenantId}/${folder}/${timestamp}-${randomSuffix}${extension}`;
  }

  /**
   * Generate unique file ID for database
   */
  private generateFileId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Validate S3 configuration
   */
  async validateConfiguration(): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.s3Client!.send(command);
      return true;
    } catch (error) {
      console.error('AWS S3 configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Migrate a local file to S3
   */
  async migrateLocalFile(
    localPath: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    options: MediaUploadOptions
  ): Promise<MediaConfirmResult> {
    this.ensureInitialized();
    
    const { tenantId, uploadedBy, folder = 'migrated' } = options;

    // Generate unique key
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    const fileExtension = originalName.split('.').pop();
    const key = `tenants/${tenantId}/${folder}/${timestamp}-${uuid}.${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await this.s3Client!.send(command);

      // Create file record
      const storage = await getStorage();
      const fileRecord = {
        id: uuidv4(),
        filename: originalName,
        originalName,
        mimeType,
        size: fileBuffer.length,
        path: key,
        uploadedBy,
        uploadedAt: new Date(),
      };

      await storage.createFileRecord(fileRecord);

      const publicUrl = this.getPublicUrl(key);

      return {
        id: fileRecord.id,
        key,
        originalName,
        mimeType,
        size: fileBuffer.length,
        publicUrl,
        tenantId,
        uploadedBy,
        folder,
        createdAt: fileRecord.uploadedAt,
      };
    } catch (error) {
      console.error('Failed to migrate file:', error);
      throw new Error(`Failed to migrate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create and export a singleton instance
export const mediaService = new MediaService();
export default MediaService; 