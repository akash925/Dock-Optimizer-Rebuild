import express from 'express';
import multer from 'multer';
import * as controllers from './controllers';
import { isAuthenticated } from '../../middleware/auth';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
});

// GET /api/assets - Get all assets or filter by userId
router.get('/assets', isAuthenticated, controllers.getAssets);

// GET /api/assets/:id - Get a single asset by ID
router.get('/assets/:id', isAuthenticated, controllers.getAssetById);

// POST /api/assets - Create a new asset
router.post('/assets', 
  isAuthenticated, 
  upload.single('file'), // 'file' is the field name for the uploaded file
  controllers.createAsset
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

export default router;