import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Asset, InsertAsset } from '@shared/schema';
import { getStorage } from '../../storage';

const UPLOAD_DIR = path.resolve('./uploads');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface AssetService {
  getAllAssets(): Promise<Asset[]>;
  getAssetsByUser(userId: number): Promise<Asset[]>;
  getAssetById(id: number): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset, fileBuffer: Buffer): Promise<Asset>;
  updateAsset(id: number, asset: Partial<Asset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<boolean>;
}

export class AssetManagerService implements AssetService {
  async getAllAssets(): Promise<Asset[]> {
    const storage = await getStorage();
    return storage.getAssets();
  }

  async getAssetsByUser(userId: number): Promise<Asset[]> {
    const storage = await getStorage();
    return storage.getAssetsByUser(userId);
  }

  async getAssetById(id: number): Promise<Asset | undefined> {
    const storage = await getStorage();
    return storage.getAsset(id);
  }

  async createAsset(asset: InsertAsset, fileBuffer: Buffer): Promise<Asset> {
    // Generate a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${asset.filename}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
    
    // Save the file to disk
    await writeFileAsync(filePath, fileBuffer);
    
    // Update the file URL in the asset data
    const assetWithUrl = {
      ...asset,
      url: `/uploads/${uniqueFilename}`
    };
    
    // Save to database
    const storage = await getStorage();
    return storage.createAsset(assetWithUrl);
  }

  async updateAsset(id: number, asset: Partial<Asset>): Promise<Asset | undefined> {
    const storage = await getStorage();
    return storage.updateAsset(id, asset);
  }

  async deleteAsset(id: number): Promise<boolean> {
    const storage = await getStorage();
    
    // Get the asset first to get the file path
    const asset = await storage.getAsset(id);
    if (!asset) {
      return false;
    }
    
    // Delete the file from disk if it exists
    if (asset.url && asset.url.startsWith('/uploads/')) {
      const filename = asset.url.replace('/uploads/', '');
      const filePath = path.join(UPLOAD_DIR, filename);
      
      try {
        if (fs.existsSync(filePath)) {
          await unlinkAsync(filePath);
        }
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
        // Continue with deleting the database record even if file deletion fails
      }
    }
    
    // Delete the database record
    return storage.deleteAsset(id);
  }
}

export const assetManagerService = new AssetManagerService();