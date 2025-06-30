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

// Company Assets routes
// ===========================

// API Routes for Company Assets UI
// Mount these at /api/company-assets/...
const companyAssetsRouter = express.Router();

// GET /api/company-assets/assets - Get all assets or filter by userId
companyAssetsRouter.get('/assets', isAuthenticated, controllers.listAssets);

// POST /api/company-assets/assets - Upload a new asset
companyAssetsRouter.post('/assets', 
  isAuthenticated, 
  upload.single('file'), // 'file' is the field name for the uploaded file
  controllers.uploadAsset
);

// DELETE /api/company-assets/assets/:id - Delete an asset
companyAssetsRouter.delete('/assets/:id', isAuthenticated, controllers.deleteAsset);

// Company Asset routes
// GET /api/company-assets/company-assets - List all company assets
companyAssetsRouter.get('/company-assets', isAuthenticated, controllers.listCompanyAssets);

// GET /api/company-assets/company-assets/:id - Get company asset by ID
companyAssetsRouter.get('/company-assets/:id', isAuthenticated, controllers.getCompanyAssetById);

// POST /api/company-assets/company-assets - Create a new company asset
companyAssetsRouter.post('/company-assets',
  isAuthenticated,
  upload.single('photo'), // 'photo' is the field name for the uploaded photo
  controllers.createCompanyAsset
);

// PUT /api/company-assets/company-assets/:id - Update a company asset
companyAssetsRouter.put('/company-assets/:id',
  isAuthenticated,
  upload.single('photo'), // Optional photo update
  controllers.updateCompanyAsset
);

// PATCH /api/company-assets/company-assets/:id/status - Update company asset status
companyAssetsRouter.patch('/company-assets/:id/status',
  isAuthenticated,
  controllers.updateCompanyAssetStatus
);

// PATCH /api/company-assets/company-assets/:id/barcode - Update company asset barcode
companyAssetsRouter.patch('/company-assets/:id/barcode',
  isAuthenticated,
  controllers.updateCompanyAssetBarcode
);

// PUT /api/company-assets/company-assets/:id/photo - Update company asset photo only
companyAssetsRouter.put('/company-assets/:id/photo',
  isAuthenticated,
  upload.single('photo'), // 'photo' is the field name for the uploaded photo
  controllers.updateCompanyAssetPhoto
);

// DELETE /api/company-assets/company-assets/:id - Delete a company asset
companyAssetsRouter.delete('/company-assets/:id', isAuthenticated, controllers.deleteCompanyAsset);

// POST /api/company-assets/company-assets/import - Bulk import company assets
companyAssetsRouter.post('/company-assets/import', isAuthenticated, controllers.importCompanyAssets);

// GET /api/company-assets/company-assets/barcode/search - Search for company asset by barcode
companyAssetsRouter.get('/company-assets/barcode/search', isAuthenticated, controllers.searchCompanyAssetByBarcode);

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

export { companyAssetsRouter };
export default router;