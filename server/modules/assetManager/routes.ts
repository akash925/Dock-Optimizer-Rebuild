import express from 'express';
import multer from 'multer';
import { assetControllers } from './controllers';

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Create router
const router = express.Router();

// Routes
router.get('/assets', assetControllers.getAllAssets);
router.post('/assets', upload.single('file'), assetControllers.uploadAsset);
router.delete('/assets/:id', assetControllers.deleteAsset);

export { router };