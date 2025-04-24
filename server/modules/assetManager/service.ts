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
  updateCompanyAssetStatus(id: number, status: string): Promise<CompanyAsset | undefined>;
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

  /**
   * List all company assets with search and filtering
   */
  async listCompanyAssets(filters?: Record<string, any>): Promise<CompanyAsset[]> {
    try {
      const storage = await getStorage();
      if (typeof storage.getCompanyAssets === 'function') {
        // If filters provided, use the filtered method
        if (filters && Object.keys(filters).length > 0) {
          if (typeof storage.getFilteredCompanyAssets === 'function') {
            return await storage.getFilteredCompanyAssets(filters);
          } else {
            console.warn('Storage does not implement getFilteredCompanyAssets method, fallback to client-side filtering');
            // Fallback: Get all and filter in memory
            const assets = await storage.getCompanyAssets();
            return this.filterCompanyAssets(assets, filters);
          }
        }
        // No filters, get all
        return await storage.getCompanyAssets();
      } else {
        console.error('Storage does not implement getCompanyAssets method');
        return [];
      }
    } catch (error) {
      console.error('Error in listCompanyAssets:', error);
      return [];
    }
  }
  
  /**
   * Filter company assets in memory when database filtering is not available
   * This is a fallback method for in-memory filtering
   */
  private filterCompanyAssets(assets: CompanyAsset[], filters: Record<string, any>): CompanyAsset[] {
    return assets.filter(asset => {
      // Search text filtering (check name, description, manufacturer, model, notes)
      if (filters.q) {
        const searchTerm = filters.q.toLowerCase();
        const searchFields = [
          asset.name, 
          asset.description, 
          asset.manufacturer, 
          asset.model, 
          asset.notes,
          asset.department,
          asset.owner,
          asset.barcode,
          asset.serialNumber
        ].filter(Boolean).map(field => field?.toLowerCase());
        
        if (!searchFields.some(field => field?.includes(searchTerm))) {
          return false;
        }
      }
      
      // Category filtering
      if (filters.category && asset.category !== filters.category) {
        return false;
      }
      
      // Status filtering
      if (filters.status && asset.status !== filters.status) {
        return false;
      }
      
      // Location filtering
      if (filters.location && asset.location !== filters.location) {
        return false;
      }
      
      // Tags filtering
      if (filters.tags && asset.tags) {
        // Split tags by comma
        const tagList = filters.tags.split(',');
        if (tagList.length > 0) {
          try {
            // Parse asset tags from JSON
            const assetTags = typeof asset.tags === 'string' 
              ? JSON.parse(asset.tags) 
              : (Array.isArray(asset.tags) ? asset.tags : []);
            
            // Check if any of the filter tags exist in asset tags
            const hasMatchingTag = tagList.some(tag => 
              assetTags.includes(tag)
            );
            
            if (!hasMatchingTag) {
              return false;
            }
          } catch (error) {
            console.warn(`Error parsing tags for asset ${asset.id}:`, error);
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * Get company asset by ID
   */
  async getCompanyAssetById(id: number): Promise<CompanyAsset | undefined> {
    try {
      const storage = await getStorage();
      if (typeof storage.getCompanyAsset === 'function') {
        return await storage.getCompanyAsset(id);
      } else {
        console.error('Storage does not implement getCompanyAsset method');
        return undefined;
      }
    } catch (error) {
      console.error(`Error getting company asset with ID ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Create a new company asset
   */
  async createCompanyAsset(companyAsset: InsertCompanyAsset, photoBuffer?: Buffer): Promise<CompanyAsset> {
    try {
      let photoUrl = null;

      // Handle photo upload if provided
      if (photoBuffer) {
        // Create assets directory if it doesn't exist
        const assetsDir = path.join(UPLOAD_DIR, 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }
        
        // Generate a unique filename for the photo
        const uniqueFilename = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
        const filePath = path.join(assetsDir, uniqueFilename);
        
        // Save the photo to disk
        await writeFileAsync(filePath, photoBuffer);
        
        // Update the photo URL
        photoUrl = `/uploads/assets/${uniqueFilename}`;
      }
      
      // Add photoUrl to company asset data
      const assetWithPhoto = {
        ...companyAsset,
        photoUrl
      };
      
      // Save to database
      const storage = await getStorage();
      if (typeof storage.createCompanyAsset === 'function') {
        return await storage.createCompanyAsset(assetWithPhoto);
      } else {
        console.error('Storage does not implement createCompanyAsset method');
        throw new Error('Unable to create company asset: storage method not available');
      }
    } catch (error) {
      console.error('Error creating company asset:', error);
      throw error;
    }
  }

  /**
   * Update an existing company asset
   */
  async updateCompanyAsset(id: number, companyAsset: UpdateCompanyAsset, photoBuffer?: Buffer): Promise<CompanyAsset | undefined> {
    try {
      const storage = await getStorage();
      
      // Get the existing asset to handle photo updates
      const existingAsset = await this.getCompanyAssetById(id);
      if (!existingAsset) {
        return undefined;
      }

      let updateData: UpdateCompanyAsset = { ...companyAsset };
      
      // Handle photo update if provided
      if (photoBuffer) {
        // Delete old photo if one exists
        if (existingAsset.photoUrl && existingAsset.photoUrl.startsWith('/uploads/')) {
          const oldFilename = existingAsset.photoUrl.replace('/uploads/', '');
          const oldFilePath = path.join(UPLOAD_DIR, oldFilename);
          
          try {
            if (fs.existsSync(oldFilePath)) {
              await unlinkAsync(oldFilePath);
            }
          } catch (error) {
            console.error(`Error deleting old photo ${oldFilePath}:`, error);
            // Continue with the update even if old photo deletion fails
          }
        }

        // Create assets directory if it doesn't exist
        const assetsDir = path.join(UPLOAD_DIR, 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }
        
        // Generate a unique filename for the new photo
        const uniqueFilename = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
        const filePath = path.join(assetsDir, uniqueFilename);
        
        // Save the new photo to disk
        await writeFileAsync(filePath, photoBuffer);
        
        // Add the new photo URL to the update data
        updateData.photoUrl = `/uploads/assets/${uniqueFilename}`;
      }
      
      // Update the database record
      if (typeof storage.updateCompanyAsset === 'function') {
        return await storage.updateCompanyAsset(id, updateData);
      } else {
        console.error('Storage does not implement updateCompanyAsset method');
        return undefined;
      }
    } catch (error) {
      console.error(`Error updating company asset with ID ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Update company asset status only
   */
  async updateCompanyAssetStatus(id: number, status: string): Promise<CompanyAsset | undefined> {
    try {
      const storage = await getStorage();
      
      // Get the existing asset to validate it exists
      const existingAsset = await this.getCompanyAssetById(id);
      if (!existingAsset) {
        return undefined;
      }
      
      // Update only the status field
      const updateData = { status } as UpdateCompanyAsset;
      
      // Use the updateCompanyAsset method to update just the status
      if (typeof storage.updateCompanyAsset === 'function') {
        return await storage.updateCompanyAsset(id, updateData);
      } else {
        console.error('Storage does not implement updateCompanyAsset method');
        return undefined;
      }
    } catch (error) {
      console.error(`Error updating status for company asset with ID ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Delete a company asset
   */
  async deleteCompanyAsset(id: number): Promise<boolean> {
    try {
      const storage = await getStorage();
      
      // Get the asset first to get the photo URL
      const asset = await this.getCompanyAssetById(id);
      if (!asset) {
        return false;
      }
      
      // Delete the photo file from disk if it exists
      if (asset.photoUrl && asset.photoUrl.startsWith('/uploads/')) {
        const filename = asset.photoUrl.replace('/uploads/', '');
        const filePath = path.join(UPLOAD_DIR, filename);
        
        try {
          if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
            console.log(`Successfully deleted asset photo file: ${filePath}`);
          } else {
            console.warn(`Asset photo file not found: ${filePath}`);
          }
        } catch (error) {
          console.error(`Error deleting photo file ${filePath}:`, error);
          // Continue with deleting the database record even if file deletion fails
        }
      }
      
      // Delete the database record
      if (typeof storage.deleteCompanyAsset === 'function') {
        return await storage.deleteCompanyAsset(id);
      } else {
        console.error('Storage does not implement deleteCompanyAsset method');
        return false;
      }
    } catch (error) {
      console.error(`Error deleting company asset with ID ${id}:`, error);
      return false;
    }
  }
}

export const assetManagerService = new AssetManagerService();