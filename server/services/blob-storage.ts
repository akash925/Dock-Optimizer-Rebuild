/**
 * Blob Storage Service
 * 
 * Centralized service for handling file uploads and storage
 * Supports both local filesystem and cloud storage (S3, etc.)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getStorage } from '../storage';

export interface BlobStorageConfig {
  type: 'filesystem' | 's3' | 'azure' | 'gcp';
  basePath?: string;
  bucket?: string;
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    connectionString?: string;
  };
}

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  tenantId?: number;
  uploadedBy?: number;
  createdAt: Date;
}

export interface UploadOptions {
  tenantId?: number;
  uploadedBy?: number;
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

class BlobStorageService {
  private config: BlobStorageConfig;
  private storage: any;

  constructor(config?: BlobStorageConfig) {
    // Default to filesystem storage for development
    this.config = config || {
      type: 'filesystem',
      basePath: path.join(process.cwd(), 'uploads')
    };
    
    this.initializeStorage();
  }

  private async initializeStorage() {
    this.storage = await getStorage();
    
    // Ensure upload directories exist
    if (this.config.type === 'filesystem') {
      const basePath = this.config.basePath || path.join(process.cwd(), 'uploads');
      const directories = ['images', 'documents', 'bol', 'temp'];
      
      directories.forEach(dir => {
        const fullPath = path.join(basePath, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      });
    }
  }

  /**
   * Upload a file and store metadata
   */
  async uploadFile(
    fileBuffer: Buffer, 
    originalName: string, 
    mimeType: string, 
    options: UploadOptions = {}
  ): Promise<StoredFile> {
    // Validate file size
    if (options.maxSize && fileBuffer.length > options.maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
    }

    // Validate file type
    if (options.allowedTypes && !options.allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Generate unique file ID and path
    const fileId = this.generateFileId();
    const extension = path.extname(originalName);
    const folder = options.folder || 'general';
    const fileName = `${fileId}${extension}`;
    
    let filePath: string;
    let fileUrl: string;

    if (this.config.type === 'filesystem') {
      const basePath = this.config.basePath || path.join(process.cwd(), 'uploads');
      filePath = path.join(basePath, folder, fileName);
      fileUrl = `/api/files/${folder}/${fileName}`;
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file to disk
      fs.writeFileSync(filePath, fileBuffer);
    } else {
      // TODO: Implement cloud storage (S3, Azure, GCP)
      throw new Error('Cloud storage not yet implemented');
    }

    // Create file record
    const fileRecord: StoredFile = {
      id: fileId,
      originalName,
      mimeType,
      size: fileBuffer.length,
      path: filePath,
      url: fileUrl,
      tenantId: options.tenantId,
      uploadedBy: options.uploadedBy,
      createdAt: new Date()
    };

    // Store metadata in database
    await this.storage.createFileRecord(fileRecord);

    return fileRecord;
  }

  /**
   * Upload image from base64 data
   */
  async uploadImageFromBase64(
    base64Data: string,
    originalName: string,
    options: UploadOptions = {}
  ): Promise<StoredFile> {
    // Parse base64 data
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data format');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Set default options for images
    const imageOptions: UploadOptions = {
      folder: 'images',
      maxSize: 5 * 1024 * 1024, // 5MB default
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      ...options
    };

    return this.uploadFile(buffer, originalName, mimeType, imageOptions);
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, tenantId?: number): Promise<StoredFile | null> {
    const fileRecord = await this.storage.getFileRecord(fileId);
    
    if (!fileRecord) {
      return null;
    }

    // Check tenant access
    if (tenantId && fileRecord.tenantId && fileRecord.tenantId !== tenantId) {
      throw new Error('Access denied to file');
    }

    return fileRecord;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, tenantId?: number): Promise<boolean> {
    const fileRecord = await this.getFile(fileId, tenantId);
    
    if (!fileRecord) {
      return false;
    }

    // Delete physical file
    if (this.config.type === 'filesystem' && fs.existsSync(fileRecord.path)) {
      fs.unlinkSync(fileRecord.path);
    }

    // Delete database record
    await this.storage.deleteFileRecord(fileId);

    return true;
  }

  /**
   * Get file stream for serving
   */
  getFileStream(filePath: string): fs.ReadStream {
    if (this.config.type === 'filesystem') {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      return fs.createReadStream(filePath);
    }
    
    throw new Error('File streaming not implemented for this storage type');
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<number> {
    const cutoffDate = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    const tempFiles = await this.storage.getTempFiles(cutoffDate);
    
    let deletedCount = 0;
    for (const file of tempFiles) {
      try {
        await this.deleteFile(file.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete temp file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const blobStorageService = new BlobStorageService();
export default BlobStorageService;