import { Router } from 'express';
import * as featureFlagController from './controllers.js';
import { isAuthenticated, isAdmin } from '../../middleware/auth.js';

const router = Router();

// Get status of a specific module for a tenant
router.get('/tenants/:tenantId/modules/:moduleName', 
  isAuthenticated, 
  isAdmin, 
  featureFlagController.getModuleStatus
);

// Get all enabled modules for a tenant
router.get('/tenants/:tenantId/modules', 
  isAuthenticated, 
  isAdmin, 
  featureFlagController.getEnabledModules
);

// Enable a module for a tenant
router.post('/tenants/:tenantId/modules/:moduleName/enable', 
  isAuthenticated, 
  isAdmin, 
  featureFlagController.enableModule
);

// Disable a module for a tenant
router.post('/tenants/:tenantId/modules/:moduleName/disable', 
  isAuthenticated, 
  isAdmin, 
  featureFlagController.disableModule
);

// Update module settings
router.put('/tenants/:tenantId/modules/:moduleName/settings', 
  isAuthenticated, 
  isAdmin, 
  featureFlagController.updateModuleSettings
);

export default router;