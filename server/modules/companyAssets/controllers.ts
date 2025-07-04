import { Request, Response } from 'express';
import { companyAssetsService } from './service';
import { insertAssetSchema, insertCompanyAssetSchema, updateCompanyAssetSchema, AssetCategory } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { serializeCompanyAsset, serializeCompanyAssets } from './serializer';
import multer from 'multer';
import { mediaService } from '../../services/MediaService';
import crypto from 'crypto';

/**
 * List all assets or filter by user ID
 * Used by both /api/assets and /api/asset-manager/assets
 */
export const listAssets = async (req: Request, res: Response) => {
  try {
    // If userId query param is present, filter by user
    if (req.query.userId && !isNaN(Number(req.query.userId))) {
      const userId = Number(req.query.userId);
      const assets = await companyAssetsService.getAssetsByUser(userId);
      return res.json(assets);
    }
    
    // Otherwise return all assets
    const assets = await companyAssetsService.list();
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
    
    const asset = await companyAssetsService.getById(id);
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
    const asset = await companyAssetsService.create(assetData, buffer);
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
    const existingAsset = await companyAssetsService.getById(id);
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
    
    const updatedAsset = await companyAssetsService.update(id, updateData);
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
    const existingAsset = await companyAssetsService.getById(id);
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
    const success = await companyAssetsService.remove(id);
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
 * List all company assets with optional filtering
 */
export const listCompanyAssets = async (req: Request, res: Response) => {
  try {
    // Debug user authentication
    console.log('DEBUG: User authentication:', {
      userId: req.user?.id,
      userEmail: req.user?.email,
      tenantId: req.user?.tenantId,
      userExists: !!req.user
    });

    // Get user's tenant ID for filtering
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      console.error('ERROR: User tenant not found for company assets request');
      return res.status(400).json({ error: 'User tenant not found' });
    }

    // Extract filter parameters from query
    const { q, category, status, location, tags } = req.query;
    
    // Build filter object
    const filters: Record<string, any> = {
      tenantId: tenantId // Always filter by tenant
    };
    
    // Add search term if provided
    if (q && typeof q === 'string') {
      filters.q = q;
    }
    
    // Add category filter if provided
    if (category && typeof category === 'string') {
      console.log("Applying category filter:", category);
      filters.category = category;
    }
    
    // Add status filter if provided
    if (status && typeof status === 'string') {
      console.log("Applying status filter:", status);
      filters.status = status;
    }
    
    // Add location filter if provided
    if (location && typeof location === 'string') {
      console.log("Applying location filter:", location);
      filters.location = location;
    }
    
    // Add tags filter if provided (can be comma-separated)
    if (tags && typeof tags === 'string') {
      console.log("Applying tags filter:", tags);
      filters.tags = tags.split(',');
    }
    
    // Log all filters being applied
    console.log("DEBUG: Applied filters for company assets:", JSON.stringify(filters, null, 2));
    
    // Apply filters - always include tenant filtering
    const companyAssets = await companyAssetsService.listCompanyAssets(filters);
    
    console.log(`DEBUG: Company assets result count: ${companyAssets.length}`);
    
    // Serialize assets to ensure CDN URLs are properly formatted
    const serializedAssets = serializeCompanyAssets(companyAssets);
    
    return res.json(serializedAssets);
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
    
    const asset = await companyAssetsService.getCompanyAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(asset);
    
    return res.json(serializedAsset);
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
    const { 
      name, manufacturer, owner, category, description, barcode, 
      tags, status, location, department
    } = req.body;
    
    // Check for required fields - only name is required
    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required field. Asset Name is required.' 
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
    
    // Process tags - ensure they're properly stored as JSON string
    let processedTags = null;
    if (tags) {
      if (typeof tags === 'string') {
        try {
          // If it's already a JSON string, parse it to validate and then stringify again
          const parsedTags = JSON.parse(tags);
          if (Array.isArray(parsedTags)) {
            processedTags = JSON.stringify(parsedTags);
          } else {
            processedTags = JSON.stringify([tags]);
          }
        } catch (e) {
          // If parsing fails, it might be a comma-separated string
          processedTags = JSON.stringify(tags.split(',').map(t => t.trim()));
        }
      } else if (Array.isArray(tags)) {
        processedTags = JSON.stringify(tags);
      } else {
        processedTags = JSON.stringify([String(tags)]);
      }
    }
    
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    // Create company asset data object
    const companyAssetData = {
      name,
      manufacturer: manufacturer ? String(manufacturer) : 'Unknown',  // Default value if not provided
      owner: owner ? String(owner) : 'Unknown', // Default value if not provided
      category: assetCategory || AssetCategory.OTHER, // Default to OTHER if not provided
      description: description || null,
      barcode: barcode || null,
      status: status || 'ACTIVE', // Default status changed to ACTIVE
      location: location || null,
      department: department || null,
      tags: processedTags,
      photoUrl: null, // Will be set by the service if photo is uploaded
      tenantId: (req.user as any).tenantId // User is guaranteed to have tenantId now
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
    const asset = await companyAssetsService.createCompanyAsset(companyAssetData, photoBuffer);
    
    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(asset);
    
    return res.status(201).json(serializedAsset);
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
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    console.log('Update asset request body:', req.body);
    console.log('Update asset file:', req.file ? { 
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'No file uploaded');
    
    // Extract fields from request body - include all potential fields
    const { 
      name, manufacturer, owner, category, description, barcode, serialNumber,
      model, department, location, status, template, assetCondition, notes,
      manufacturerPartNumber, supplierName, poNumber, vendorInformation,
      purchasePrice, currency, purchaseDate, implementedDate, warrantyExpiration, 
      depreciation, assetValue, lastServiceDate, nextServiceDate, 
      maintenanceSchedule, certificationDate, certificationExpiry, tags
    } = req.body;
    
    // Build update object with only the fields that were provided
    const updateData: any = {};
    
    // Basic information
    if (name !== undefined) updateData.name = name;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (owner !== undefined) updateData.owner = owner;
    if (description !== undefined) updateData.description = description;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (model !== undefined) updateData.model = model;
    if (department !== undefined) updateData.department = department;
    if (template !== undefined) updateData.template = template;
    if (assetCondition !== undefined) updateData.assetCondition = assetCondition;
    if (notes !== undefined) updateData.notes = notes;
    if (manufacturerPartNumber !== undefined) updateData.manufacturerPartNumber = manufacturerPartNumber;
    if (supplierName !== undefined) updateData.supplierName = supplierName;
    if (poNumber !== undefined) updateData.poNumber = poNumber;
    if (vendorInformation !== undefined) updateData.vendorInformation = vendorInformation;
    
    // Process tags if provided
    if (tags !== undefined) {
      let processedTags = null;
      if (tags) {
        if (typeof tags === 'string') {
          try {
            // If it's already a JSON string, parse it to validate and then stringify again
            const parsedTags = JSON.parse(tags);
            if (Array.isArray(parsedTags)) {
              processedTags = JSON.stringify(parsedTags);
            } else {
              processedTags = JSON.stringify([tags]);
            }
          } catch (e) {
            // If parsing fails, it might be a comma-separated string
            processedTags = JSON.stringify(tags.split(',').map(t => t.trim()));
          }
        } else if (Array.isArray(tags)) {
          processedTags = JSON.stringify(tags);
        } else {
          processedTags = JSON.stringify([String(tags)]);
        }
      }
      updateData.tags = processedTags;
    }
    
    // Financial information
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
    if (currency !== undefined) updateData.currency = currency;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate;
    if (implementedDate !== undefined) updateData.implementedDate = implementedDate;
    if (warrantyExpiration !== undefined) updateData.warrantyExpiration = warrantyExpiration;
    if (depreciation !== undefined) updateData.depreciation = depreciation;
    if (assetValue !== undefined) updateData.assetValue = assetValue;
    
    // Maintenance information
    if (lastServiceDate !== undefined) updateData.lastServiceDate = lastServiceDate;
    if (nextServiceDate !== undefined) updateData.nextServiceDate = nextServiceDate;
    if (maintenanceSchedule !== undefined) updateData.maintenanceSchedule = maintenanceSchedule;
    if (certificationDate !== undefined) updateData.certificationDate = certificationDate;
    if (certificationExpiry !== undefined) updateData.certificationExpiry = certificationExpiry;
    
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
    
    // Handle location
    if (location !== undefined) {
      updateData.location = location;
    }
    
    // Handle status
    if (status !== undefined) {
      updateData.status = status;
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
    if (photoBuffer) {
      console.log('Found photo buffer with size:', photoBuffer.length);
    }
    
    // Update the company asset
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, updateData, photoBuffer);
    
        if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update company asset' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(updatedAsset);

    return res.json(serializedAsset);
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
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // Delete the company asset
    const success = await companyAssetsService.deleteCompanyAsset(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete company asset' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting company asset:', error);
    return res.status(500).json({ error: 'Failed to delete company asset' });
  }
};

/**
 * Update company asset barcode
 * PATCH /api/asset-manager/company-assets/:id/barcode
 */
export const updateCompanyAssetBarcode = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }
    
    const asset = await companyAssetsService.getCompanyAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Update just the barcode field
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, { barcode });
    
    if (!updatedAsset) {
      return res.status(404).json({ error: 'Asset not found or update failed' });
    }
    
    return res.status(200).json(updatedAsset);
  } catch (error) {
    console.error('Error updating company asset barcode:', error);
    return res.status(500).json({ error: 'Failed to update asset barcode' });
  }
};

/**
 * Update company asset status
 * PATCH /api/asset-manager/company-assets/:id/status
 */
export const updateCompanyAssetStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }
    
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Check if the asset exists
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // Update status
    const updatedAsset = await companyAssetsService.updateCompanyAssetStatus(id, status);
    
    return res.json(updatedAsset);
  } catch (error) {
    console.error('Error updating company asset status:', error);
    return res.status(500).json({ error: 'Failed to update company asset status' });
  }
};

/**
 * Update company asset photo only
 * PUT /api/company-assets/company-assets/:id/photo
 */
export const updateCompanyAssetPhoto = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }
    
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }
    
    const tenantId = (req.user as any).tenantId;
    
    // Check if the asset exists and belongs to the user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }
    
    // Check if photo was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }
    
    console.log('Updating photo for asset:', id, 'tenant:', tenantId);
    
    // Update only the photo
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, {}, req.file.buffer);
    
        if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update asset photo' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(updatedAsset);

    return res.json({ photoUrl: serializedAsset.photoUrl });
  } catch (error) {
    console.error('Error updating company asset photo:', error);
    return res.status(500).json({ error: 'Failed to update asset photo' });
  }
};

export const importCompanyAssets = async (req: Request, res: Response) => {
  try {
    // Validate request body
    if (!req.body.assets || !Array.isArray(req.body.assets)) {
      return res.status(400).json({ error: 'Invalid request format. Expected an array of assets.' });
    }

    const assets = req.body.assets;
    
    // Validate assets
    if (assets.length === 0) {
      return res.status(400).json({ error: 'No assets to import.' });
    }

    // Initialize counters
    let successful = 0;
    let failed = 0;
    let warnings = 0;
    const errors: any[] = [];

    // Process each asset
    for (const assetData of assets) {
      try {
        // Set createdBy if authenticated
        if (req.user) {
          assetData.createdBy = req.user.id;
        }
        
        // Convert category string to enum value if provided
        if (assetData.category) {
          if (!Object.values(AssetCategory).includes(assetData.category as AssetCategory)) {
            assetData.category = AssetCategory.OTHER;
            warnings++;
          }
        } else {
          assetData.category = AssetCategory.OTHER;
          warnings++;
        }
        
        // Parse dates if they are strings
        ['purchaseDate', 'implementationDate', 'warrantyExpiration', 'lastMaintenanceDate', 'nextMaintenanceDate', 'certificationDate', 'certificationExpiry'].forEach(dateField => {
          if (assetData[dateField] && typeof assetData[dateField] === 'string') {
            try {
              const date = new Date(assetData[dateField]);
              // Check if date is valid
              if (!isNaN(date.getTime())) {
                assetData[dateField] = date;
              } else {
                delete assetData[dateField];
                warnings++;
              }
            } catch (e) {
              delete assetData[dateField];
              warnings++;
            }
          }
        });
        
        // Process tags - ensure they're properly stored as JSON string  
        if (assetData.tags) {
          let processedTags = null;
          if (typeof assetData.tags === 'string') {
            try {
              // If it's already a JSON string, parse it to validate
              const parsedTags = JSON.parse(assetData.tags);
              if (Array.isArray(parsedTags)) {
                processedTags = parsedTags;
              } else {
                processedTags = [assetData.tags];
              }
            } catch (e) {
              // If parsing fails, it might be a comma-separated string
              processedTags = assetData.tags.split(',').map((tag: string) => tag.trim());
            }
          } else if (Array.isArray(assetData.tags)) {
            processedTags = assetData.tags;
          } else {
            processedTags = [String(assetData.tags)];
          }
          
          // Store as JSON string
          assetData.tags = JSON.stringify(processedTags);
        }
        
        // Validate required fields - only Asset Name is required
        if (!assetData.name) {
          throw new Error('Asset name is required');
        }
        
        // Ensure user is authenticated and has tenantId
        if (!req.user || !(req.user as any)?.tenantId) {
          throw new Error('User must be authenticated with valid organization');
        }

        // Create the company asset data object
        const companyAssetData = {
          name: assetData.name,
          manufacturer: assetData.manufacturer ? String(assetData.manufacturer) : 'Unknown',  // Default value for required field
          owner: assetData.owner ? String(assetData.owner) : 'Unknown',  // Default value for required field
          department: assetData.department || null,
          category: assetData.category,  // Already defaulted to AssetCategory.OTHER
          description: assetData.description || null,
          barcode: assetData.barcode || null,
          serialNumber: assetData.serialNumber || null,
          photoUrl: assetData.photoUrl || null,
          
          // Financial information
          purchasePrice: assetData.purchasePrice || null,
          currency: assetData.currency || 'USD',
          purchaseDate: assetData.purchaseDate || null,
          warrantyExpiration: assetData.warrantyExpiration || null,
          depreciation: assetData.depreciation || null,
          assetValue: assetData.assetValue || null,
          
          // Location and status
          location: assetData.location || null,
          status: assetData.status || 'ACTIVE',  // Default to ACTIVE
          
          // Template and metadata
          template: assetData.template || null,
          tags: assetData.tags || null,
          model: assetData.model || null,
          assetCondition: assetData.assetCondition || null,
          notes: assetData.notes || null,
          
          // Procurement information
          manufacturerPartNumber: assetData.manufacturerPartNumber || null,
          supplierName: assetData.supplierName || null,
          poNumber: assetData.poNumber || null,
          vendorInformation: assetData.vendorInformation || null,
          
          // Maintenance information
          lastMaintenanceDate: assetData.lastMaintenanceDate || null,
          nextMaintenanceDate: assetData.nextMaintenanceDate || null,
          maintenanceSchedule: assetData.maintenanceSchedule || null,
          maintenanceContact: assetData.maintenanceContact || null,
          maintenanceNotes: assetData.maintenanceNotes || null,
          implementationDate: assetData.implementationDate || null,
          expectedLifetime: assetData.expectedLifetime || null,
          certificationDate: assetData.certificationDate || null,
          certificationExpiry: assetData.certificationExpiry || null,
          
          // System fields
          createdBy: assetData.createdBy || null,
          tenantId: (req.user as any).tenantId, // User is guaranteed to have tenantId from auth check above
        };
        
        // Create the asset (no photo buffer for bulk import)
        await companyAssetsService.createCompanyAsset(companyAssetData);
        successful++;
      } catch (error: any) {
        failed++;
        errors.push({
          asset: assetData.name || `Asset at index ${assets.indexOf(assetData)}`,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Return result
    return res.status(201).json({
      total: assets.length,
      successful,
      failed,
      warnings,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in importCompanyAssets:', error);
    return res.status(500).json({ error: 'Failed to import company assets' });
  }
};

/**
 * Search for company asset by barcode
 */
export const searchCompanyAssetByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.query;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode parameter is required' });
    }
    
    console.log('Searching for asset with barcode:', barcode);
    
    const asset = await companyAssetsService.findCompanyAssetByBarcode(barcode as string);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found with this barcode' });
    }
    
    return res.status(200).json(asset);
  } catch (error) {
    console.error('Error searching for asset by barcode:', error);
    return res.status(500).json({ error: 'Failed to search for asset by barcode' });
  }
};

/**
 * Generate presigned URL for asset photo upload
 * POST /api/company-assets/company-assets/:id/photo/presign
 */
export const generateAssetPhotoPresignedUrl = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }

    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        error: `File type ${fileType} not allowed. Allowed types: ${allowedTypes.join(', ')}` 
      });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (fileSize && fileSize > maxSize) {
      return res.status(400).json({ 
        error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes` 
      });
    }

    // Check if the asset exists and belongs to the user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }

    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }

    // Check feature flag for S3 direct upload
    const useS3DirectUpload = process.env.VITE_USE_S3_DIRECT_UPLOAD === 'true';
    
    if (useS3DirectUpload) {
      // Use AWS SDK v3 createPresignedPost for direct S3 uploads
      const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post');
      const { S3Client } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      // Generate unique S3 key
      const key = `photos/${crypto.randomUUID()}.jpg`;
      
      // Create presigned POST with AWS PHP-style fields
      const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Expires: 60, // 1 minute expiry
        Conditions: [
          ["content-length-range", 0, maxSize],
          ["eq", "$Content-Type", fileType],
        ],
        Fields: {
          'Content-Type': fileType,
        },
      });

      // Persist key on the asset NOW so later GETs work even if user closes tab
      await companyAssetsService.updateCompanyAsset(id, { photoUrl: key });

      return res.json({ url, fields, key });
    } else {
      // Fallback to existing MediaService implementation
      const presignedResponse = await mediaService.generatePresignedUpload(
        fileName,
        fileType,
        {
          tenantId,
          uploadedBy: req.user.id,
          folder: 'assets',
          maxSizeBytes: maxSize,
          allowedMimeTypes: allowedTypes,
        }
      );

      return res.json({
        uploadUrl: presignedResponse.uploadUrl,
        key: presignedResponse.key,
        publicUrl: presignedResponse.publicUrl,
        expiresAt: presignedResponse.expiresAt,
      });
    }

  } catch (error) {
    console.error('Error generating presigned URL for asset photo:', error);
    return res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
};

/**
 * Confirm asset photo upload and update database
 * POST /api/company-assets/company-assets/:id/photo/confirm
 */
export const confirmAssetPhotoUpload = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company asset ID' });
    }

    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    const { key, fileName, fileType } = req.body;

    if (!key || !fileName || !fileType) {
      return res.status(400).json({ error: 'key, fileName, and fileType are required' });
    }

    // Check if the asset exists and belongs to the user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }

    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }

    // Confirm upload and get file record
    const fileRecord = await mediaService.confirmUpload(
      key,
      fileName,
      fileType,
      {
        tenantId,
        uploadedBy: req.user.id,
        folder: 'assets',
      }
    );

    // Update the asset with the new photo URL
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, {
      photoUrl: fileRecord.publicUrl,
    });

    if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update asset with photo URL' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(updatedAsset);

    return res.json({ 
      photoUrl: serializedAsset.photoUrl,
      fileId: fileRecord.id,
    });

  } catch (error) {
    console.error('Error confirming asset photo upload:', error);
    return res.status(500).json({ error: 'Failed to confirm photo upload' });
  }
};

/**
 * Generate presigned URL for general asset file upload  
 * POST /api/company-assets/assets/presign
 */
export const generateAssetFilePresignedUrl = async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    // Validate file size (50MB limit for general assets)
    const maxSize = 50 * 1024 * 1024;
    if (fileSize && fileSize > maxSize) {
      return res.status(400).json({ 
        error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes` 
      });
    }

    // Generate presigned URL
    const presignedResponse = await mediaService.generatePresignedUpload(
      fileName,
      fileType,
      {
        tenantId,
        uploadedBy: req.user.id,
        folder: 'assets',
        maxSizeBytes: maxSize,
      }
    );

    return res.json({
      uploadUrl: presignedResponse.uploadUrl,
      key: presignedResponse.key,
      publicUrl: presignedResponse.publicUrl,
      expiresAt: presignedResponse.expiresAt,
    });

  } catch (error) {
    console.error('Error generating presigned URL for asset file:', error);
    return res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
};

/**
 * Confirm general asset file upload
 * POST /api/company-assets/assets/confirm
 */
export const confirmAssetFileUpload = async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    const { key, fileName, fileType, description, tags } = req.body;

    if (!key || !fileName || !fileType) {
      return res.status(400).json({ error: 'key, fileName, and fileType are required' });
    }

    // Confirm upload and get file record
    const fileRecord = await mediaService.confirmUpload(
      key,
      fileName,
      fileType,
      {
        tenantId,
        uploadedBy: req.user.id,
        folder: 'assets',
      }
    );

    // Create asset record
    const assetData = {
      filename: fileName,
      fileType: fileType,
      fileSize: fileRecord.size,
      description: description || null,
      tags: tags ? JSON.parse(tags) : null,
      url: fileRecord.publicUrl,
      uploadedBy: req.user.id,
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
    const asset = await companyAssetsService.create(assetData, Buffer.from(''));

    return res.status(201).json(asset);

  } catch (error) {
    console.error('Error confirming asset file upload:', error);
    return res.status(500).json({ error: 'Failed to confirm file upload' });
  }
};