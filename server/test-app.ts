import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { vi } from 'vitest';

// Create a test Express app with minimal setup for testing
export function createTestApp(customUser?: any) {
  const app = express();
  
  // Basic middleware setup
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: false, limit: "5mb" }));

  // Mock authentication middleware for tests
  app.use((req: any, res, next) => {
    // Use custom user if provided, otherwise default test user
    req.user = customUser || {
      id: 1,
      tenantId: 2, // Changed to match test asset tenant
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin'
    };
    
    // Mock authentication check
    req.isAuthenticated = vi.fn().mockReturnValue(true);
    
    next();
  });

  // Company Assets routes for testing
  app.get('/api/assets', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const assets = await mockStorage.getCompanyAssetsByTenantId(req.user.tenantId);
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/company-assets', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const assets = await mockStorage.getCompanyAssetsByTenantId(req.user.tenantId);
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/company-assets', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const assetData = { ...req.body, tenantId: req.user.tenantId };
      const asset = await mockStorage.createCompanyAsset(assetData);
      res.status(201).json(asset);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/company-assets/:id/status', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      const asset = await mockStorage.getCompanyAsset(id);
      if (!asset || asset.tenantId !== req.user.tenantId) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      const updated = await mockStorage.updateCompanyAssetStatus(id, status);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/company-assets/barcode/search', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const { barcode } = req.query;
      const asset = await mockStorage.getCompanyAssetByBarcode(barcode as string);
      
      if (!asset || asset.tenantId !== req.user.tenantId) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/company-assets/import', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const { assets } = req.body;
      
      const imported = [];
      for (const assetData of assets) {
        const asset = await mockStorage.createCompanyAsset({
          ...assetData,
          tenantId: req.user.tenantId
        });
        imported.push(asset);
      }
      
      res.status(201).json({ total: imported.length, assets: imported });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Asset photo presign endpoints
  app.post('/api/company-assets/:id/photo/presign', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const id = parseInt(req.params.id);
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
      const existingAsset = await mockStorage.getCompanyAsset(id);
      if (!existingAsset) {
        return res.status(404).json({ error: 'Company asset not found' });
      }

      // TENANT SAFETY: Ensure asset belongs to the user's tenant
      if (existingAsset.tenantId !== req.user.tenantId) {
        return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
      }

      // Return mock presigned URL response
      res.json({
        url: 'https://test-bucket.s3.amazonaws.com',
        fields: {
          'Content-Type': fileType,
          'key': 'photos/test-uuid.jpg',
          'AWSAccessKeyId': 'test-access-key',
          'policy': 'test-policy',
          'signature': 'test-signature'
        },
        key: 'photos/test-uuid.jpg'
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/company-assets/:id/photo', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const id = parseInt(req.params.id);
      const { key, photoUrl } = req.body;

      const resolvedKey = key ?? (photoUrl ? photoUrl.replace(/^https?:\/\/[^/]+\//, '') : null);

      if (!resolvedKey) {
        return res.status(400).json({ error: 'S3 key is required' });
      }

      // Check if the asset exists and belongs to the user's tenant
      const existingAsset = await mockStorage.getCompanyAsset(id);
      if (!existingAsset) {
        return res.status(404).json({ error: 'Company asset not found' });
      }

      // TENANT SAFETY: Ensure asset belongs to the user's tenant
      if (existingAsset.tenantId !== req.user.tenantId) {
        return res.status(403).json({ error: 'Forbidden - Asset does not belong to your organization' });
      }

      const updatedAsset = await mockStorage.updateCompanyAsset(id, { photoUrl: resolvedKey });

      if (!updatedAsset) {
        return res.status(500).json({ error: 'Failed to update asset photo' });
      }

      res.json(updatedAsset);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // BOL routes for testing
  app.post('/api/schedules/:id/bol', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const scheduleId = parseInt(req.params.id);
      
      const schedule = await mockStorage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      const bolData = { ...req.body, scheduleId, tenantId: req.user.tenantId };
      const bol = await mockStorage.createBolDocument(bolData);
      res.status(201).json(bol);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/schedules/:id/bol', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const scheduleId = parseInt(req.params.id);
      const bols = await mockStorage.getBolDocumentsByScheduleId(scheduleId);
      res.json(bols);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/bol/:bolId', async (req: any, res) => {
    try {
      const { mockStorage } = await import('./__mocks__/storage');
      const bolId = parseInt(req.params.bolId);
      
      const bol = await mockStorage.getBolDocument(bolId);
      if (!bol) {
        return res.status(404).json({ error: 'BOL not found' });
      }
      
      // Check permissions (admin or owner)
      if (req.user.role !== 'admin' && bol.createdBy !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      await mockStorage.deleteBolDocument(bolId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}

// Export default app instance for require() calls
export default createTestApp(); 