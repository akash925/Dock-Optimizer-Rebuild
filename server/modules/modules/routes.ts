import { Router } from 'express';
import { storage } from '../../storage';
import { requireAuth } from '../../auth-middleware';

export const modulesRouter = Router();

/**
 * GET /api/modules
 * Returns the list of modules enabled for the authenticated user's organization
 */
modulesRouter.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the user's tenant/organization ID
    const { tenantId } = req.user;

    // If no tenant ID, provide minimal default modules 
    if (!tenantId) {
      return res.json([
        { moduleName: 'appointments', enabled: true },
        { moduleName: 'doorManager', enabled: true },
        { moduleName: 'facilityManagement', enabled: true }
      ]);
    }

    // Fetch modules for this organization
    const modules = await storage.getOrganizationModules(tenantId);
    
    return res.json(modules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    return res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

export default modulesRouter;