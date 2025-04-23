import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { db } from '../../db';
import { assets, type InsertAsset } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Convert fs.unlink to a Promise-based operation
const unlinkAsync = promisify(fs.unlink);

// Base directory for asset storage
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'assets');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Asset Manager Service
 * Handles file operations for the Asset Manager module
 */
export class AssetService {
  /**
   * Get all assets
   */
  async getAllAssets() {
    return await db.select().from(assets).orderBy(assets.createdAt);
  }

  /**
   * Get asset by ID
   */
  async getAssetById(id: number) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  /**
   * Create a new asset record
   */
  async createAsset(assetData: InsertAsset) {
    const [asset] = await db.insert(assets).values(assetData).returning();
    return asset;
  }

  /**
   * Save file to disk
   * @param file The file buffer
   * @param filename The original filename
   * @returns The path where the file was saved
   */
  async saveFile(file: Buffer, filename: string): Promise<string> {
    // Create a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}-${filename}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
    
    // Write the file to disk
    await fs.promises.writeFile(filePath, file);
    
    // Return the path relative to the uploads directory
    return `/uploads/assets/${uniqueFilename}`;
  }

  /**
   * Delete an asset and its associated file
   */
  async deleteAsset(id: number): Promise<boolean> {
    const asset = await this.getAssetById(id);
    if (!asset) {
      return false;
    }

    // Delete the file from disk
    try {
      // Get the absolute path from the URL stored in the database
      const filePath = path.join(process.cwd(), asset.url.replace(/^\//, ''));
      
      // Check if file exists before attempting to delete
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting file for asset ${id}:`, error);
      // Continue with deleting the database record even if file deletion fails
    }

    // Delete the database record
    const result = await db.delete(assets).where(eq(assets.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

// Export a singleton instance
export const assetService = new AssetService();