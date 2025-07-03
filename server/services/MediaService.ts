import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { getStorage } from '../storage';

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

class MediaService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private cdnBase?: string;

  constructor() {
    // Validate required environment variables
    const bucket = process.env.AWS_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET environment variable is required');
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required');
    }

    this.bucket = bucket;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.cdnBase = process.env.AWS_CLOUDFRONT_DOMAIN;

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generate a presigned URL for uploading a file directly to S3
   */
  async generatePresignedUpload(
    originalFileName: string,
    mimeType: string,
    options: UploadFileOptions
  ): Promise<PresignedUploadResponse> {
    // Validate file size if specified
    if (options.maxSizeBytes && options.maxSizeBytes > 100 * 1024 * 1024) {
      throw new Error('File size cannot exceed 100MB');
    }

    // Validate MIME type if specified
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Generate unique key
    const key = this.generateFileKey(originalFileName, options);

    // Create presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: {
        originalName: originalFileName,
        tenantId: options.tenantId.toString(),
        uploadedBy: options.uploadedBy.toString(),
        folder: options.folder || 'general',
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    const publicUrl = this.getPublicUrl(key);
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return {
      uploadUrl,
      key,
      publicUrl,
      expiresAt,
    };
  }

  /**
   * Confirm that a file was successfully uploaded and store metadata
   */
  async confirmUpload(
    key: string,
    originalFileName: string,
    mimeType: string,
    options: UploadFileOptions
  ): Promise<MediaFileRecord> {
    try {
      // Verify the file exists in S3
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const headResult = await this.s3Client.send(headCommand);
      const fileSize = headResult.ContentLength || 0;

      // Create database record
      const fileRecord: MediaFileRecord = {
        id: this.generateFileId(),
        key,
        originalName: originalFileName,
        mimeType,
        size: fileSize,
        publicUrl: this.getPublicUrl(key),
        tenantId: options.tenantId,
        uploadedBy: options.uploadedBy,
        folder: options.folder || 'general',
        createdAt: new Date(),
      };

      // Store in database
      const storage = await getStorage();
      await storage.createFileRecord({
        id: fileRecord.id,
        filename: fileRecord.originalName,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        path: fileRecord.key, // Store S3 key as path
        uploadedBy: fileRecord.uploadedBy,
        uploadedAt: fileRecord.createdAt,
      });

      return fileRecord;
    } catch (error) {
      console.error('Error confirming upload:', error);
      throw new Error('Failed to confirm file upload');
    }
  }

  /**
   * Delete a file from S3 and database
   */
  async deleteFile(key: string, tenantId?: number): Promise<boolean> {
    try {
      // Delete from S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(deleteCommand);

      // Delete from database
      const storage = await getStorage();
      // Note: We'll need to find the file record by path since there's no direct method
      // For now, we'll skip database deletion and just delete from S3
      // TODO: Add method to find file record by S3 key/path
      console.log(`Deleted S3 object with key: ${key}`);

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Generate a presigned URL for downloading/viewing a file
   */
  async generatePresignedDownload(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get public URL for a file (uses CloudFront if configured)
   */
  getPublicUrl(key: string): string {
    if (this.cdnBase) {
      return `${this.cdnBase}/${key}`;
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
    try {
      // Try to list objects in the bucket (with limit 1)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Migrate a local file to S3
   */
  async migrateLocalFile(
    localPath: string,
    buffer: Buffer,
    originalFileName: string,
    mimeType: string,
    options: UploadFileOptions
  ): Promise<MediaFileRecord> {
    const key = this.generateFileKey(originalFileName, options);

    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalName: originalFileName,
        tenantId: options.tenantId.toString(),
        uploadedBy: options.uploadedBy.toString(),
        folder: options.folder || 'general',
        migratedFrom: localPath,
      },
    });

    await this.s3Client.send(putCommand);

    // Create file record
    const fileRecord: MediaFileRecord = {
      id: this.generateFileId(),
      key,
      originalName: originalFileName,
      mimeType,
      size: buffer.length,
      publicUrl: this.getPublicUrl(key),
      tenantId: options.tenantId,
      uploadedBy: options.uploadedBy,
      folder: options.folder || 'general',
      createdAt: new Date(),
    };

    // Store in database
    const storage = await getStorage();
    await storage.createFileRecord({
      id: fileRecord.id,
      filename: fileRecord.originalName,
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      size: fileRecord.size,
      path: fileRecord.key,
      uploadedBy: fileRecord.uploadedBy,
      uploadedAt: fileRecord.createdAt,
    });

    return fileRecord;
  }
}

// Export singleton instance
export const mediaService = new MediaService();
export default MediaService; 