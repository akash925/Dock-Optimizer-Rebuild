import { Router } from 'express';
import * as controllers from './controllers.js';
import { isAuthenticated, validateTenant } from '../../middleware/auth.js';

const router = Router();

// BOL upload endpoints with tenant validation
router.post('/presign', isAuthenticated as any, validateTenant as any, controllers.presignBolUpload as any);
router.post('/upload', isAuthenticated as any, validateTenant as any, controllers.uploadBol as any);  
router.post('/confirm', isAuthenticated as any, validateTenant as any, controllers.confirmBolUpload as any);

// Export router
export default router; 