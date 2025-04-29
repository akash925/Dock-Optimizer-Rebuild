import { Router } from 'express';
import * as tenantController from './controllers';
import { isAuthenticated, isAdmin } from '../../middleware/auth';

const router = Router();

// Get all tenants
router.get('/', 
  isAuthenticated, 
  isAdmin, 
  tenantController.getTenants
);

// Get tenant by ID
router.get('/:id', 
  isAuthenticated, 
  isAdmin, 
  tenantController.getTenant
);

// Get tenant by subdomain
router.get('/subdomain/:subdomain', 
  isAuthenticated, 
  isAdmin, 
  tenantController.getTenantBySubdomain
);

// Create new tenant
router.post('/', 
  isAuthenticated, 
  isAdmin, 
  tenantController.createTenant
);

// Update tenant
router.put('/:id', 
  isAuthenticated, 
  isAdmin, 
  tenantController.updateTenant
);

// Update tenant status
router.patch('/:id/status', 
  isAuthenticated, 
  isAdmin, 
  tenantController.updateTenantStatus
);

// Delete tenant
router.delete('/:id', 
  isAuthenticated, 
  isAdmin, 
  tenantController.deleteTenant
);

export default router;