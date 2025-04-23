import { Request, Response } from 'express';
import { assetManagerService } from './service';
import { insertAssetSchema, insertCompanyAssetSchema, updateCompanyAssetSchema, AssetCategory } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

/**
 * List all assets or filter by user ID
 * Used by both /api/assets and /api/asset-manager/assets
 */
export const listAssets = async (req: Request, res: Response) => {
  try {
    // If userId query param is present, filter by user
    if (req.query.userId && !isNaN(Number(req.query.userId))) {
      const userId = Number(req.query.userId);
      const assets = await assetManagerService.getAssetsByUser(userId);
      return res.json(assets);
    }
    
    // Otherwise return all assets
    const assets = await assetManagerService.list();
    return res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ error: 'Failed to fetch assets' });
  }
};

/**
 * Get asset by ID
 * Used by /api/assets/:id
 */
export const getAssetById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    const asset = await assetManagerService.getById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    return res.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return res.status(500).json({ error: 'Failed to fetch asset' });
  }
};

/**
 * Upload a new asset
 * Used by both /api/assets and /api/asset-manager/assets
 */
export const uploadAsset = async (req: Request, res: Response) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Extract file info from multer
    const { originalname, mimetype, size, buffer } = req.file;
    
    // Create asset data object
    const assetData = {
      filename: originalname,
      fileType: mimetype,
      fileSize: size,
      description: req.body.description || null,
      tags: req.body.tags ? JSON.parse(req.body.tags) : null,
      url: '', // Will be set by the service
      uploadedBy: req.user?.id || 0, // Default to 0 if no user (shouldn't happen with auth middleware)
    };
    
    // Validate the asset data
    try {
      insertAssetSchema.parse(assetData);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const readableError = fromZodError(validationError);
        return res.status(400).json({ error: readableError.message });
      }
      return res.status(400).json({ error: 'Invalid asset data' });
    }
    
    // Create the asset
    const asset = await assetManagerService.create(assetData, buffer);
    return res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
};

/**
 * Update an existing asset
 * Used by /api/assets/:id
 */
export const updateAsset = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    // Get the current asset to check ownership
    const existingAsset = await assetManagerService.getById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Check if the user owns this asset or is an admin
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (existingAsset.uploadedBy !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to update this asset' });
    }
    
    // Update the asset
    const updateData: Partial<typeof existingAsset> = {};
    
    if (req.body.description !== undefined) {
      updateData.description = req.body.description;
    }
    
    if (req.body.tags !== undefined) {
      updateData.tags = JSON.parse(req.body.tags);
    }
    
    // Update last accessed timestamp if viewing the file
    if (req.body.accessed === 'true') {
      updateData.lastAccessedAt = new Date();
    }
    
    const updatedAsset = await assetManagerService.update(id, updateData);
    return res.json(updatedAsset);
  } catch (error) {
    console.error('Error updating asset:', error);
    return res.status(500).json({ error: 'Failed to update asset' });
  }
};

/**
 * Delete an asset
 * Used by both /api/assets/:id and /api/asset-manager/assets/:id
 */
export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }
    
    // Get the current asset to check ownership
    const existingAsset = await assetManagerService.getById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Check if the user owns this asset or is an admin
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (existingAsset.uploadedBy !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this asset' });
    }
    
    // Delete the asset
    const success = await assetManagerService.remove(id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete asset' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting asset:', error);
    return res.status(500).json({ error: 'Failed to delete asset' });
  }
};

// For backwards compatibility
export const getAssets = listAssets;
export const createAsset = uploadAsset;

/**
 * Company Asset operations
 */

/**
 * List all company assets
 */
export const listCompanyAssets = async (req: Request, res: Response) => {
  try {
    const companyAssets = await assetManagerService.listCompanyAssets();
    return res.json(companyAssets);
  } catch (error) {
    console.error('Error fetching company assets:', error);
    return res.status(500).json({ error: 'Failed to fetch company assets' });
  }
};

/**
 * Get company asset by ID
 */
export const getCompanyAssetById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }
    
    const asset = await assetManagerService.getCompanyAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    return res.json(asset);
  } catch (error) {
    console.error('Error fetching company asset:', error);
    return res.status(500).json({ error: 'Failed to fetch company asset' });
  }
};

/**
 * Create a new company asset
 */
export const createCompanyAsset = async (req: Request, res: Response) => {
  try {
    // Extract the data from the request body
    const { name, manufacturer, owner, category, description, barcode } = req.body;
    
    // Check for required fields
    if (!name || !manufacturer || !owner || !category) {
      return res.status(400).json({ 
        error: 'Missing required fields. Name, manufacturer, owner, and category are required.' 
      });
    }
    
    // Convert category string to enum value
    let assetCategory: AssetCategory;
    if (Object.values(AssetCategory).includes(category as AssetCategory)) {
      assetCategory = category as AssetCategory;
    } else {
      return res.status(400).json({ 
        error: `Invalid category. Must be one of: ${Object.values(AssetCategory).join(', ')}` 
      });
    }
    
    // Create company asset data object
    const companyAssetData = {
      name,
      manufacturer,
      owner,
      category: assetCategory,
      description: description || null,
      barcode: barcode || null,
      photoUrl: null // Will be set by the service if photo is uploaded
    };
    
    // Validate the company asset data
    try {
      insertCompanyAssetSchema.parse(companyAssetData);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const readableError = fromZodError(validationError);
        return res.status(400).json({ error: readableError.message });
      }
      return res.status(400).json({ error: 'Invalid company asset data' });
    }
    
    // Check if a photo was uploaded
    const photoBuffer = req.file ? req.file.buffer : undefined;
    
    // Create the company asset
    const asset = await assetManagerService.createCompanyAsset(companyAssetData, photoBuffer);
    return res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating company asset:', error);
    return res.status(500).json({ error: 'Failed to create company asset' });
  }
};

/**
 * Update an existing company asset
 */
export const updateCompanyAsset = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }
    
    // Get the current asset to check if it exists
    const existingAsset = await assetManagerService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // Extract fields from request body
    const { name, manufacturer, owner, category, description, barcode } = req.body;
    
    // Build update object with only the fields that were provided
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (owner !== undefined) updateData.owner = owner;
    if (description !== undefined) updateData.description = description;
    if (barcode !== undefined) updateData.barcode = barcode;
    
    // Convert category string to enum value if provided
    if (category !== undefined) {
      if (Object.values(AssetCategory).includes(category as AssetCategory)) {
        updateData.category = category as AssetCategory;
      } else {
        return res.status(400).json({ 
          error: `Invalid category. Must be one of: ${Object.values(AssetCategory).join(', ')}` 
        });
      }
    }
    
    // Validate the update data
    try {
      updateCompanyAssetSchema.parse(updateData);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const readableError = fromZodError(validationError);
        return res.status(400).json({ error: readableError.message });
      }
      return res.status(400).json({ error: 'Invalid company asset data' });
    }
    
    // Check if a new photo was uploaded
    const photoBuffer = req.file ? req.file.buffer : undefined;
    
    // Update the company asset
    const updatedAsset = await assetManagerService.updateCompanyAsset(id, updateData, photoBuffer);
    
    if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update company asset' });
    }
    
    return res.json(updatedAsset);
  } catch (error) {
    console.error('Error updating company asset:', error);
    return res.status(500).json({ error: 'Failed to update company asset' });
  }
};

/**
 * Delete a company asset
 */
export const deleteCompanyAsset = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }
    
    // Check if the asset exists
    const existingAsset = await assetManagerService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // Delete the company asset
    const success = await assetManagerService.deleteCompanyAsset(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete company asset' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting company asset:', error);
    return res.status(500).json({ error: 'Failed to delete company asset' });
  }
};