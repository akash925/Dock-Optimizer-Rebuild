import express from 'express';
import multer from 'multer';
import * as controllers from './controllers';
// Add this check to avoid auth errors
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
});

// Asset Manager routes
// ===========================

// API Routes for Asset Manager UI
// Mount these at /api/asset-manager/...
const assetManagerRouter = express.Router();

// GET /api/asset-manager/assets - Get all assets or filter by userId
assetManagerRouter.get('/assets', isAuthenticated, controllers.listAssets);

// POST /api/asset-manager/assets - Upload a new asset
assetManagerRouter.post('/assets', 
  isAuthenticated, 
  upload.single('file'), // 'file' is the field name for the uploaded file
  controllers.uploadAsset
);

// DELETE /api/asset-manager/assets/:id - Delete an asset
assetManagerRouter.delete('/assets/:id', isAuthenticated, controllers.deleteAsset);

// Legacy API routes (keeping for backward compatibility)
// ===========================
// Mount these at /api/...

// GET /api/assets - Get all assets or filter by userId
router.get('/assets', isAuthenticated, controllers.listAssets);

// GET /api/assets/:id - Get a single asset by ID
router.get('/assets/:id', isAuthenticated, controllers.getAssetById);

// POST /api/assets - Create a new asset
router.post('/assets', 
  isAuthenticated, 
  upload.single('file'), // 'file' is the field name for the uploaded file
  controllers.uploadAsset
);

// PUT /api/assets/:id - Update an asset
router.put('/assets/:id', isAuthenticated, controllers.updateAsset);

// DELETE /api/assets/:id - Delete an asset
router.delete('/assets/:id', isAuthenticated, controllers.deleteAsset);

// Setup static file serving for the uploads directory
// This should be called from the main server setup to properly serve the files
export function setupStaticFileServing(app: express.Express) {
  app.use('/uploads', express.static('uploads'));
}

export { assetManagerRouter };
export default router;