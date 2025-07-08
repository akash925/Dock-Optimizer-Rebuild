import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { vi } from 'vitest';

// Create a test Express app with minimal setup for testing
export function createTestApp() {
  const app = express();
  
  // Basic middleware setup
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: false, limit: "5mb" }));

  // Mock authentication middleware for tests
  app.use((req: any, res, next) => {
    // Default test user - can be overridden by individual tests
    req.user = {
      id: 1,
      tenantId: 1,
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