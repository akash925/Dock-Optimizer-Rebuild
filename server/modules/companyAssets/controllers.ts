import { Request, Response } from 'express';
import multer from 'multer';

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}
import { companyAssetsService } from './service';
import { insertAssetSchema, insertCompanyAssetSchema, updateCompanyAssetSchema, AssetCategory } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { serializeCompanyAsset, serializeCompanyAssets } from './serializer';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';

/**
 * List all assets or filter by user ID
 * LEGACY: Previously used by /api/assets (now disabled)
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
 * LEGACY: Previously used by /api/assets/:id (now disabled)
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
 * LEGACY: Previously used by /api/assets (now disabled)
 */
export const uploadAsset = async (req: RequestWithFile, res: Response) => {
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
 * LEGACY: Previously used by /api/assets/:id (now disabled)
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
 * LEGACY: Previously used by /api/assets/:id (now disabled)
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
    
    // Create the company asset (no photo upload in this endpoint)
    const asset = await companyAssetsService.createCompanyAsset(companyAssetData);
    
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
    
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    
    // Get the current asset to check if it exists and belongs to user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }
    
    // Extract fields from request body
    const { 
      name, manufacturer, owner, category, description, barcode, 
      status, location, department, tags
    } = req.body;
    
    // Build update object with only the fields that were provided
    const updateData: any = {};
    
    // Basic information
    if (name !== undefined) updateData.name = name;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (owner !== undefined) updateData.owner = owner;
    if (description !== undefined) updateData.description = description;
    if (barcode !== undefined) updateData.barcode = barcode;
    if (status !== undefined) updateData.status = status;
    if (location !== undefined) updateData.location = location;
    if (department !== undefined) updateData.department = department;
    
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
    
    // Update the asset
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, updateData);
    
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
    
    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    
    // Get the current asset to check if it exists and belongs to user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }
    
    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }
    
    // Delete the asset
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
 * Generate presigned URL for asset photo upload
 * POST /api/company-assets/:id/photo/presign
 */
export const getPresignAssetPhoto = async (req: Request, res: Response) => {
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

    // Check for required environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.warn('AWS environment variables not configured, falling back to local storage');
      // Return a mock presigned URL structure for local upload
      return res.json({
        url: `/api/company-assets/${id}/photo/local`,
        fields: {
          'Content-Type': fileType,
          method: 'POST'
        },
        key: `local-${id}-${Date.now()}`,
        local: true
      });
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Generate file extension from MIME type
    const fileExtension = fileType === 'image/jpeg' ? '.jpg' : 
                         fileType === 'image/png' ? '.png' : 
                         fileType === 'image/webp' ? '.webp' : '.jpg';

    // Generate unique S3 key with proper extension
    const key = `photos/${tenantId}/${id}-${crypto.randomUUID()}${fileExtension}`;
    
    // Create presigned POST with AWS fields - 15 minute expiry
    const { url, fields } = await createPresignedPost(s3Client, {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Expires: 900, // 15 minutes expiry as per UP-2 requirements
      Conditions: [
        ["content-length-range", 0, maxSize],
        ["eq", "$Content-Type", fileType],
        ["starts-with", "$key", `photos/${tenantId}/`], // Ensure tenant isolation
      ],
      Fields: {
        'Content-Type': fileType,
      },
    });

    console.log(`[Asset Photo] Generated presigned URL for asset ${id}, key: ${key}`);
    console.log(`[Asset Photo] Presigned URL: ${url}`);
    console.log(`[Asset Photo] Presigned fields:`, JSON.stringify(fields, null, 2));

    // DON'T update the asset with the key yet - wait for successful upload
    // This prevents orphaned keys in the database

    return res.json({ url, fields, key });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

/**
 * Update asset photo key after successful S3 upload
 * PUT /api/company-assets/:id/photo
 */
export const updatePhotoKey = async (req: Request, res: Response) => {
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
    const { key, photoUrl } = req.body;

    // Accept either key or photoUrl, resolve to S3 key
    const resolvedKey = 
      key ??
      (photoUrl ? photoUrl.replace(/^https?:\/\/[^/]+\//, '') : null);

    if (!resolvedKey) {
      return res.status(400).json({ error: 'S3 key is required' });
    }

    // Validate the key format and tenant isolation
    if (!resolvedKey.startsWith(`photos/${tenantId}/`)) {
      return res.status(400).json({ error: 'Invalid S3 key format or tenant mismatch' });
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

    console.log(`[Asset Photo] Updating photo key for asset ${id}: ${resolvedKey}`);

    // Update the asset with the S3 key
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, { photoUrl: resolvedKey });

    if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update asset photo' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(updatedAsset);

    console.log(`[Asset Photo] Successfully updated photo for asset ${id}`);

    return res.json({ 
      success: true,
      photoUrl: serializedAsset.photoUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Error updating photo key:', error);
    return res.status(500).json({ error: 'Failed to update photo' });
  }
};

/**
 * Upload compressed image to database
 * PUT /api/company-assets/:id/compressed-photo
 */
export const uploadCompressedPhoto = async (req: Request, res: Response) => {
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
    const { compressedImage, imageMetadata } = req.body;

    if (!compressedImage) {
      return res.status(400).json({ error: 'Compressed image data is required' });
    }

    // Validate base64 format
    if (!compressedImage.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL' });
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

    console.log(`[Compressed Photo] Uploading compressed image for asset ${id}`);
    console.log(`[Compressed Photo] Image metadata:`, imageMetadata);

    // Update the asset with compressed image data
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, { 
      compressedImage,
      imageMetadata: imageMetadata || {},
      // Set photoUrl to indicate this asset has a compressed image
      photoUrl: `/api/company-assets/${id}/image`
    });

    if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to update asset with compressed image' });
    }

    console.log(`[Compressed Photo] Successfully uploaded compressed image for asset ${id}`);

    return res.json({ 
      success: true,
      photoUrl: `/api/company-assets/${id}/image`,
      message: 'Compressed image uploaded successfully',
      compressionRatio: imageMetadata?.compressionRatio || 0
    });
  } catch (error) {
    console.error('Error uploading compressed image:', error);
    return res.status(500).json({ error: 'Failed to upload compressed image' });
  }
};

/**
 * Serve compressed image from database
 */
export const getCompressedImage = async (req: Request, res: Response) => {
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

    // Get the asset with compressed image
    const asset = await companyAssetsService.getCompanyAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }

    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (asset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }

    // Check if asset has compressed image
    if (!asset.compressedImage) {
      return res.status(404).json({ error: 'No compressed image found for this asset' });
    }

    // Parse the base64 data URL
    const matches = asset.compressedImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return res.status(500).json({ error: 'Invalid image data format' });
    }

    const [, mimeType, base64Data] = matches;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Set proper headers
    res.setHeader('Content-Type', `image/${mimeType}`);
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('ETag', `"${id}-${asset.updatedAt || asset.createdAt}"`);

    // Send the image
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error serving compressed image:', error);
    return res.status(500).json({ error: 'Failed to serve compressed image' });
  }
};

/**
 * Delete asset photo
 * DELETE /api/company-assets/:id/photo
 */
export const deleteAssetPhoto = async (req: Request, res: Response) => {
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

    console.log(`[Asset Photo] Deleting photo for asset ${id}`);

    // Update the asset to remove photo data
    const updatedAsset = await companyAssetsService.updateCompanyAsset(id, { 
      compressedImage: null,
      imageMetadata: null,
      photoUrl: null
    });

    if (!updatedAsset) {
      return res.status(500).json({ error: 'Failed to delete asset photo' });
    }

    console.log(`[Asset Photo] Successfully deleted photo for asset ${id}`);

    return res.json({ 
      success: true,
      message: 'Asset photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset photo:', error);
    return res.status(500).json({ error: 'Failed to delete asset photo' });
  }
};

/**
 * Update company asset status
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

    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    
    // Get the current asset to check if it exists and belongs to user's tenant
    const existingAsset = await companyAssetsService.getCompanyAssetById(id);
    if (!existingAsset) {
      return res.status(404).json({ error: 'Company asset not found' });
    }

    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (existingAsset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }

    // Update the asset status
    const updatedAsset = await companyAssetsService.updateCompanyAssetStatus(id, status);
    if (!updatedAsset) {
      return res.status(404).json({ error: 'Failed to update asset status' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(updatedAsset);
    
    return res.json(serializedAsset);
  } catch (error) {
    console.error('Error updating company asset status:', error);
    return res.status(500).json({ error: 'Failed to update asset status' });
  }
};

/**
 * Search company asset by barcode
 */
export const searchCompanyAssetByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.query;
    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({ error: 'Barcode query parameter is required' });
    }

    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;

    // Find the asset by barcode
    const asset = await companyAssetsService.findCompanyAssetByBarcode(barcode);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found with the provided barcode' });
    }

    // TENANT SAFETY: Ensure asset belongs to the user's tenant
    if (asset.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
    }

    // Serialize asset to ensure CDN URL is properly formatted
    const serializedAsset = serializeCompanyAsset(asset);
    
    return res.json(serializedAsset);
  } catch (error) {
    console.error('Error searching for asset by barcode:', error);
    return res.status(500).json({ error: 'Failed to search for asset' });
  }
};

/**
 * Import company assets from bulk data
 */
export const importCompanyAssets = async (req: Request, res: Response) => {
  try {
    const { assets } = req.body;
    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'Assets array is required in the request body' });
    }

    // Ensure user is authenticated and has tenantId
    if (!req.user || !(req.user as any)?.tenantId) {
      return res.status(401).json({ error: 'User must be authenticated with valid organization' });
    }

    const tenantId = (req.user as any).tenantId;
    const results = {
      total: assets.length,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each asset in the import
    for (let i = 0; i < assets.length; i++) {
      const assetData = assets[i];
      try {
        // Add tenant ID to each asset
        const assetWithTenant = {
          ...assetData,
          tenantId: tenantId
        };

        // Validate the asset data
        insertCompanyAssetSchema.parse(assetWithTenant);

        // Create the asset
        await companyAssetsService.createCompanyAsset(assetWithTenant);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          asset: assetData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Error importing asset at index ${i}:`, error);
      }
    }

    return res.status(201).json(results);
  } catch (error) {
    console.error('Error importing company assets:', error);
    return res.status(500).json({ error: 'Failed to import assets' });
  }
};

/**
 * Local asset photo upload (fallback when S3 is not available)
 * POST /api/company-assets/:id/photo/local
 */
export const uploadAssetPhotoLocal = async (req: Request, res: Response) => {
  try {
    const multer = await import('multer');
    const path = await import('path');
    const fs = await import('fs');
    
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

    // Setup multer for local upload
    const storage = multer.default.memoryStorage();
    const upload = multer.default({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req: any, file: any, cb: any) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
        }
      },
    }).single('file');

    // Handle the upload
    upload(req, res, async (err: any) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.resolve('uploads', 'photos', tenantId.toString());
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(req.file.originalname) || '.jpg';
        const fileName = `${id}-${Date.now()}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);

        // Save file to local storage
        fs.writeFileSync(filePath, req.file.buffer);

        // Generate URL for the uploaded file
        const photoUrl = `/uploads/photos/${tenantId}/${fileName}`;

        // Update the asset with the new photo URL
        const updatedAsset = await companyAssetsService.updateCompanyAsset(id, { photoUrl });

        if (!updatedAsset) {
          return res.status(500).json({ error: 'Failed to update asset photo' });
        }

        // Serialize asset to ensure CDN URL is properly formatted
        const serializedAsset = serializeCompanyAsset(updatedAsset);

        console.log(`[Asset Photo] Local upload successful for asset ${id}: ${photoUrl}`);
        return res.json({ 
          success: true,
          photoUrl: serializedAsset.photoUrl,
          message: 'Photo uploaded successfully'
        });
      } catch (uploadError) {
        console.error('Error during local upload:', uploadError);
        return res.status(500).json({ error: 'Failed to upload photo' });
      }
    });
  } catch (error) {
    console.error('Error setting up local upload:', error);
    return res.status(500).json({ error: 'Failed to setup local upload' });
  }
};

/**
 * Test AWS S3 connectivity
 * GET /api/company-assets/test-s3
 */
export const testS3Connectivity = async (req: Request, res: Response) => {
  try {
    // Check environment variables
    const awsConfig = {
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      AWS_REGION: process.env.AWS_REGION || 'us-east-1'
    };

    console.log('[S3 Test] AWS Configuration:', {
      AWS_ACCESS_KEY_ID: awsConfig.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
      AWS_SECRET_ACCESS_KEY: awsConfig.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
      AWS_S3_BUCKET: awsConfig.AWS_S3_BUCKET || 'NOT SET',
      AWS_REGION: awsConfig.AWS_REGION
    });

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      return res.json({
        success: false,
        error: 'AWS environment variables not configured',
        config: awsConfig,
        message: 'Using local storage fallback'
      });
    }

    // Try to create S3 client and test connectivity
    const s3Client = new S3Client({
      region: awsConfig.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Test bucket access with a simple head bucket operation
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    
    try {
      await s3Client.send(new HeadBucketCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
      }));

      return res.json({
        success: true,
        message: 'S3 connectivity test passed',
        config: {
          bucket: process.env.AWS_S3_BUCKET,
          region: awsConfig.AWS_REGION,
          credentials: 'VALID'
        }
      });
    } catch (s3Error: any) {
      console.error('[S3 Test] S3 connectivity error:', s3Error);
      
      return res.json({
        success: false,
        error: 'S3 connectivity failed',
        details: s3Error.message,
        code: s3Error.name,
        config: {
          bucket: process.env.AWS_S3_BUCKET,
          region: awsConfig.AWS_REGION,
          credentials: 'CHECK FAILED'
        }
      });
    }
  } catch (error) {
    console.error('[S3 Test] Error testing S3 connectivity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test S3 connectivity',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};