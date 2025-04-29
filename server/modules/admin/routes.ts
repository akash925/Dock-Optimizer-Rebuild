import { Router } from 'express';
import { getStorage } from '../../storage';
import { z } from 'zod';
import { insertOrgUserSchema, insertOrgModuleSchema } from '@shared/schema';

// Authorization middleware - only allow super-admin and admin users
function checkAdminAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  if (!req.user || (req.user.role !== 'super-admin' && req.user.role !== 'admin')) {
    return res.status(403).json({ message: 'Access denied. Requires admin privileges.' });
  }
  
  // Super-admin can access everything
  if (req.user.role === 'super-admin') {
    return next();
  }

  // Regular admin can only access their own organization's data
  // We'll implement organization-specific filters later
  next();
}

// Admin API routes
const router = Router();

// Apply admin authorization to all routes
router.use(checkAdminAccess);

// Get all organizations
router.get('/orgs', (req, res) => {
  return withStorage(req, res, async (storage) => {
    const organizations = await storage.getAllTenants();
    return res.json(organizations);
  });
});

// Get a single organization by ID
router.get('/orgs/:id', (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    const organization = await storage.getTenantById(orgId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Get users and modules for this organization
    const users = await storage.getUsersByOrganizationId(orgId);
    const modules = await storage.getModulesByOrganizationId(orgId);
    
    return res.json({
      ...organization,
      users,
      modules
    });
  });
});

// Create a new organization
router.post('/orgs', (req, res) => {
  return withStorage(req, res, async (storage) => {
    const newOrg = await storage.createTenant(req.body);
    return res.status(201).json(newOrg);
  });
});

// Update an organization
router.put('/orgs/:id', (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    const updatedOrg = await storage.updateTenant(orgId, req.body);
    return res.json(updatedOrg);
  });
});

// Delete an organization
router.delete('/orgs/:id', (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    await storage.deleteTenant(orgId);
    return res.json({ message: 'Organization deleted successfully' });
  });
});

// Add a user to an organization
router.post('/orgs/:orgId/users', (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    // Validate the request body
    const validatedData = insertOrgUserSchema.parse({
      ...req.body,
      organizationId: orgId
    });
    
    const orgUser = await storage.addUserToOrganization(validatedData);
    return res.status(201).json(orgUser);
  });
});

// Remove a user from an organization
router.delete('/orgs/:orgId/users/:userId', (req, res) => {
  const orgId = parseInt(req.params.orgId);
  const userId = parseInt(req.params.userId);
  
  if (isNaN(orgId) || isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid organization or user ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    await storage.removeUserFromOrganization(orgId, userId);
    return res.json({ message: 'User removed from organization successfully' });
  });
});

// Get modules for an organization
router.get('/orgs/:orgId/modules', (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    const modules = await storage.getModulesByOrganizationId(orgId);
    return res.json(modules);
  });
});

// Update modules for an organization
router.put('/orgs/:orgId/modules', (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  return withStorage(req, res, async (storage) => {
    // Validate the modules array
    const modulesSchema = z.array(insertOrgModuleSchema);
    const validatedModules = modulesSchema.parse(req.body.modules.map((module: any) => ({
      ...module,
      organizationId: orgId
    })));
    
    const updatedModules = await storage.updateOrganizationModules(orgId, validatedModules);
    return res.json(updatedModules);
  });
});

// Get all users across all organizations (for super-admin)
router.get('/users', (req, res) => {
  // Only allow super-admin to access all users
  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ message: 'Access denied. Requires super-admin privileges.' });
  }
  
  return withStorage(req, res, async (storage) => {
    const users = await storage.getUsers();
    return res.json(users);
  });
});

// Helper function to get storage in each route handler
async function withStorage(req: any, res: any, callback: (storage: any) => Promise<any>) {
  try {
    const storage = await getStorage();
    return callback(storage);
  } catch (error: any) {
    console.error('Error accessing storage:', error);
    return res.status(500).json({ 
      message: 'Internal server error accessing storage', 
      error: error.message 
    });
  }
}

// Export the router
export default (app: any) => {
  app.use('/api/admin', router);
};