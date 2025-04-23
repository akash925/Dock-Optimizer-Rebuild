import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Asset, InsertAsset, CompanyAsset, InsertCompanyAsset, UpdateCompanyAsset } from '@shared/schema';
import { getStorage } from '../../storage';

const UPLOAD_DIR = path.resolve('./uploads');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface AssetService {
  list(): Promise<Asset[]>;
  getById(id: number): Promise<Asset | undefined>;
  getAssetsByUser(userId: number): Promise<Asset[]>;
  create(asset: InsertAsset, fileBuffer: Buffer): Promise<Asset>;
  update(id: number, asset: Partial<Asset>): Promise<Asset | undefined>;
  remove(id: number): Promise<boolean>;
  
  // Company Asset operations
  listCompanyAssets(): Promise<CompanyAsset[]>;
  getCompanyAssetById(id: number): Promise<CompanyAsset | undefined>;
  createCompanyAsset(companyAsset: InsertCompanyAsset, photoBuffer?: Buffer): Promise<CompanyAsset>;
  updateCompanyAsset(id: number, companyAsset: UpdateCompanyAsset, photoBuffer?: Buffer): Promise<CompanyAsset | undefined>;
  deleteCompanyAsset(id: number): Promise<boolean>;
}

export class AssetManagerService implements AssetService {
  /**
   * List all assets
   */
  async list(): Promise<Asset[]> {
    try {
      const storage = await getStorage();
      if (typeof storage.getAssets === 'function') {
        return await storage.getAssets();
      } else {
        console.error('Storage does not implement getAssets method');
        return [];
      }
    } catch (error) {
      console.error('Error in list assets:', error);
      return [];
    }
  }

  /**
   * Get asset by ID
   */
  async getById(id: number): Promise<Asset | undefined> {
    try {
      const storage = await getStorage();
      if (typeof storage.getAsset === 'function') {
        return await storage.getAsset(id);
      } else {
        console.error('Storage does not implement getAsset method');
        return undefined;
      }
    } catch (error) {
      console.error(`Error getting asset with ID ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Get assets by user ID
   */
  async getAssetsByUser(userId: number): Promise<Asset[]> {
    try {
      const storage = await getStorage();
      if (typeof storage.getAssetsByUser === 'function') {
        return await storage.getAssetsByUser(userId);
      } else {
        console.error('Storage does not implement getAssetsByUser method');
        return [];
      }
    } catch (error) {
      console.error(`Error getting assets for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create a new asset
   */
  async create(asset: InsertAsset, fileBuffer: Buffer): Promise<Asset> {
    try {
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
      if (typeof storage.createAsset === 'function') {
        return await storage.createAsset(assetWithUrl);
      } else {
        console.error('Storage does not implement createAsset method');
        throw new Error('Unable to create asset: storage method not available');
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      throw error;
    }
  }

  /**
   * Update an existing asset
   */
  async update(id: number, asset: Partial<Asset>): Promise<Asset | undefined> {
    try {
      const storage = await getStorage();
      if (typeof storage.updateAsset === 'function') {
        return await storage.updateAsset(id, asset);
      } else {
        console.error('Storage does not implement updateAsset method');
        return undefined;
      }
    } catch (error) {
      console.error(`Error updating asset with ID ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Delete an asset
   */
  async remove(id: number): Promise<boolean> {
    try {
      const storage = await getStorage();
      
      // Get the asset first to get the file path
      const asset = await this.getById(id);
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
      if (typeof storage.deleteAsset === 'function') {
        return await storage.deleteAsset(id);
      } else {
        console.error('Storage does not implement deleteAsset method');
        return false;
      }
    } catch (error) {
      console.error(`Error deleting asset with ID ${id}:`, error);
      return false;
    }
  }

  // Backward compatibility methods
  async getAllAssets(): Promise<Asset[]> {
    return this.list();
  }

  async getAssetById(id: number): Promise<Asset | undefined> {
    return this.getById(id);
  }

  async createAsset(asset: InsertAsset, fileBuffer: Buffer): Promise<Asset> {
    return this.create(asset, fileBuffer);
  }

  async updateAsset(id: number, asset: Partial<Asset>): Promise<Asset | undefined> {
    return this.update(id, asset);
  }

  async deleteAsset(id: number): Promise<boolean> {
    return this.remove(id);
  }
}

export const assetManagerService = new AssetManagerService();