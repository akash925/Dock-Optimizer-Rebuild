import { Router } from 'express';
import { storage } from '../../storage';
import { z } from 'zod';
import { insertOrgUserSchema, insertOrgModuleSchema } from '@shared/schema';

// Authorization middleware - only allow super-admin and admin users
function checkAdminAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') {
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
router.get('/orgs', async (req, res) => {
  try {
    const organizations = await storage.getAllTenants();
    return res.json(organizations);
  } catch (error: any) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({ message: 'Failed to fetch organizations', error: error.message });
  }
});

// Get a single organization by ID
router.get('/orgs/:id', async (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
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
  } catch (error: any) {
    console.error(`Error fetching organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to fetch organization details', error: error.message });
  }
});

// Create a new organization
router.post('/orgs', async (req, res) => {
  try {
    const newOrg = await storage.createTenant(req.body);
    return res.status(201).json(newOrg);
  } catch (error: any) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ message: 'Failed to create organization', error: error.message });
  }
});

// Update an organization
router.put('/orgs/:id', async (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
    const updatedOrg = await storage.updateTenant(orgId, req.body);
    return res.json(updatedOrg);
  } catch (error: any) {
    console.error(`Error updating organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to update organization', error: error.message });
  }
});

// Delete an organization
router.delete('/orgs/:id', async (req, res) => {
  const orgId = parseInt(req.params.id);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
    await storage.deleteTenant(orgId);
    return res.json({ message: 'Organization deleted successfully' });
  } catch (error: any) {
    console.error(`Error deleting organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to delete organization', error: error.message });
  }
});

// Add a user to an organization
router.post('/orgs/:orgId/users', async (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
    // Validate the request body
    const validatedData = insertOrgUserSchema.parse({
      ...req.body,
      organizationId: orgId
    });
    
    const orgUser = await storage.addUserToOrganization(validatedData);
    return res.status(201).json(orgUser);
  } catch (error: any) {
    console.error(`Error adding user to organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to add user to organization', error: error.message });
  }
});

// Remove a user from an organization
router.delete('/orgs/:orgId/users/:userId', async (req, res) => {
  const orgId = parseInt(req.params.orgId);
  const userId = parseInt(req.params.userId);
  
  if (isNaN(orgId) || isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid organization or user ID' });
  }
  
  try {
    await storage.removeUserFromOrganization(orgId, userId);
    return res.json({ message: 'User removed from organization successfully' });
  } catch (error: any) {
    console.error(`Error removing user ${userId} from organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to remove user from organization', error: error.message });
  }
});

// Get modules for an organization
router.get('/orgs/:orgId/modules', async (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
    const modules = await storage.getModulesByOrganizationId(orgId);
    return res.json(modules);
  } catch (error: any) {
    console.error(`Error fetching modules for organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to fetch organization modules', error: error.message });
  }
});

// Update modules for an organization
router.put('/orgs/:orgId/modules', async (req, res) => {
  const orgId = parseInt(req.params.orgId);
  
  if (isNaN(orgId)) {
    return res.status(400).json({ message: 'Invalid organization ID' });
  }
  
  try {
    // Validate the modules array
    const modulesSchema = z.array(insertOrgModuleSchema);
    const validatedModules = modulesSchema.parse(req.body.modules.map((module: any) => ({
      ...module,
      organizationId: orgId
    })));
    
    const updatedModules = await storage.updateOrganizationModules(orgId, validatedModules);
    return res.json(updatedModules);
  } catch (error: any) {
    console.error(`Error updating modules for organization ${orgId}:`, error);
    return res.status(500).json({ message: 'Failed to update organization modules', error: error.message });
  }
});

// Get all users across all organizations (for super-admin)
router.get('/users', async (req, res) => {
  // Only allow super-admin to access all users
  if (req.user.role !== 'super-admin') {
    return res.status(403).json({ message: 'Access denied. Requires super-admin privileges.' });
  }
  
  try {
    const users = await storage.getUsers();
    return res.json(users);
  } catch (error: any) {
    console.error('Error fetching all users:', error);
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

export default router;