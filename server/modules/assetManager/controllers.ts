import { Request, Response } from 'express';
import { assetService } from './service';

/**
 * Asset Manager Controllers
 * Handles HTTP requests for the Asset Manager module
 */
export const assetControllers = {
  /**
   * Get all assets
   */
  async getAllAssets(req: Request, res: Response) {
    try {
      const assets = await assetService.getAllAssets();
      res.json(assets);
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ 
        message: 'Failed to fetch assets',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },

  /**
   * Upload a new asset
   */
  async uploadAsset(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Save the file to disk
      const url = await assetService.saveFile(
        req.file.buffer,
        req.file.originalname
      );

      // Create asset record in the database
      const asset = await assetService.createAsset({
        filename: req.file.originalname,
        url,
        uploadedBy: req.user?.id || 1 // Fallback to admin user if not authenticated
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error('Error uploading asset:', error);
      res.status(500).json({ 
        message: 'Failed to upload asset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },

  /**
   * Delete an asset
   */
  async deleteAsset(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const success = await assetService.deleteAsset(id);

      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: 'Asset not found' });
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      res.status(500).json({ 
        message: 'Failed to delete asset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};