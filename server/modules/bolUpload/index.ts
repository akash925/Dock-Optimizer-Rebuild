import { Router } from 'express';
import * as controllers from './controllers';
import { isAuthenticated, validateTenant } from '../../middleware/auth';

const router = Router();

// BOL upload endpoints with tenant validation
router.post('/presign', isAuthenticated, validateTenant, controllers.presignBolUpload);
router.post('/upload', isAuthenticated, validateTenant, controllers.uploadBol);  
router.post('/confirm', isAuthenticated, validateTenant, controllers.confirmBolUpload);

// Export router
export default router; 