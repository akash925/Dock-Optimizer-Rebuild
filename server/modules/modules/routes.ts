import { Router } from 'express';
import { getStorage } from '../../storage';
import { isAuthenticated } from '../../middleware/auth';

export const modulesRouter = Router();

// Default modules for users without a tenant ID
const DEFAULT_MODULES = [
  { moduleName: 'appointments', enabled: true },
  { moduleName: 'doorManager', enabled: true },
  { moduleName: 'facilityManagement', enabled: true }
];

/**
 * GET /api/modules
 * Returns the list of modules enabled for the authenticated user's organization
 */
modulesRouter.get('/', isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the user's tenant/organization ID
    const { tenantId } = req.user;
    
    // Log for debugging
    console.log(`[ModulesRouter] Fetching modules for user ${req.user.username} with tenantId:`, tenantId);

    // If no tenant ID, provide minimal default modules 
    if (!tenantId) {
      console.log('[ModulesRouter] No tenant ID, using default modules');
      return res.json(DEFAULT_MODULES);
    }

    // Get storage instance
    const storage = await getStorage();
    
    // Fetch modules for this organization
    const modules = await storage.getOrganizationModules(tenantId);
    console.log(`[ModulesRouter] Fetched ${modules.length} modules for organization ${tenantId}`);
    
    // Set cache headers to ensure fresh data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json(modules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    return res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * GET /api/modules/refresh
 * Forces a refresh of the modules cache by returning the latest modules data
 * Used when module settings are changed in admin console
 */
modulesRouter.get('/refresh', isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tenantId } = req.user;
    
    console.log(`[ModulesRouter] Refreshing modules for user ${req.user.username} with tenantId:`, tenantId);

    if (!tenantId) {
      return res.json(DEFAULT_MODULES);
    }

    const storage = await getStorage();
    const modules = await storage.getOrganizationModules(tenantId);
    
    // Set cache headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json(modules);
  } catch (error) {
    console.error('Error refreshing modules:', error);
    return res.status(500).json({ error: 'Failed to refresh modules' });
  }
});

export default modulesRouter;