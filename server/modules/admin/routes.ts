import { Express, Request, Response } from 'express';
import { getStorage } from '../../storage';
import { z } from 'zod';
import { TenantStatus, AvailableModule } from '@shared/schema';
import { organizationsRoutes } from './organizations/routes';
import usersRoutes from './users/routes';

// Define the organization validation schema
const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  subdomain: z.string()
    .min(2, 'Subdomain must be at least 2 characters')
    .max(50, 'Subdomain must not exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens'),
  status: z.nativeEnum(TenantStatus).optional(),
  primaryContact: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  planLevel: z.string().optional()
});

const updateOrgSchema = createOrgSchema.partial();

const updateOrgModuleSchema = z.object({
  moduleName: z.nativeEnum(AvailableModule),
  enabled: z.boolean()
});

const updateOrgModulesSchema = z.array(updateOrgModuleSchema);

const assignUserSchema = z.object({
  userId: z.number(),
  roleId: z.number()
});

// Middleware to check if the user is a super-admin
const isSuperAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user.role !== 'super-admin') {
    return res.status(403).json({ message: 'Not authorized. Super admin access required.' });
  }

  next();
};

export const adminRoutes = (app: Express) => {
  // Register organization-specific routes
  organizationsRoutes(app);
  // Get all organizations (tenants)
  app.get('/api/admin/orgs', isSuperAdmin, async (req, res) => {
    try {
      const storage = await getStorage();
      const orgs = await storage.getAllTenants();
      
      // Enhance with extra information
      const enhancedOrgs = await Promise.all(orgs.map(async (org) => {
        // Count users for this organization
        const orgUsers = await storage.getOrganizationUsers(org.id);
        const userCount = orgUsers.length;
        
        // Count enabled modules for this organization
        const orgModules = await storage.getOrganizationModules(org.id);
        const enabledModulesCount = orgModules.filter(m => m.enabled).length;
        
        return {
          ...org,
          userCount,
          moduleCount: enabledModulesCount
        };
      }));
      
      res.json(enhancedOrgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ message: 'Failed to fetch organizations' });
    }
  });

  // Get single organization detail
  app.get('/api/admin/orgs/:id', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Get organization users
      const orgUsers = await storage.getOrganizationUsers(id);
      
      // Get organization modules
      const orgModules = await storage.getOrganizationModules(id);
      
      res.json({
        ...org,
        users: orgUsers,
        modules: orgModules
      });
    } catch (error) {
      console.error('Error fetching organization:', error);
      res.status(500).json({ message: 'Failed to fetch organization' });
    }
  });

  // Create a new organization
  app.post('/api/admin/orgs', isSuperAdmin, async (req, res) => {
    try {
      const validatedData = createOrgSchema.parse(req.body);
      
      const storage = await getStorage();
      
      // Check if subdomain is already in use
      const existingOrgWithSubdomain = await storage.getTenantBySubdomain(validatedData.subdomain);
      if (existingOrgWithSubdomain) {
        return res.status(409).json({ 
          message: 'Subdomain already in use by another organization' 
        });
      }
      
      // Set default status if not provided
      if (!validatedData.status) {
        validatedData.status = TenantStatus.ACTIVE;
      }
      
      // Set current user as creator
      const createdBy = req.user.id;
      
      const newOrg = await storage.createTenant({
        ...validatedData,
        createdBy
      });
      
      // Create default modules for the new organization
      const moduleValues = Object.values(AvailableModule);
      const moduleEntries = moduleValues.map(moduleName => ({
        organizationId: newOrg.id,
        moduleName,
        enabled: true // All modules enabled by default
      }));
      
      await storage.updateOrganizationModules(newOrg.id, moduleEntries);
      
      res.status(201).json(newOrg);
    } catch (error) {
      console.error('Error creating organization:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid organization data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to create organization' });
    }
  });

  // Update an organization
  app.put('/api/admin/orgs/:id', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validatedData = updateOrgSchema.parse(req.body);
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check subdomain uniqueness if it's being changed
      if (validatedData.subdomain && validatedData.subdomain !== org.subdomain) {
        const existingOrgWithSubdomain = await storage.getTenantBySubdomain(validatedData.subdomain);
        if (existingOrgWithSubdomain && existingOrgWithSubdomain.id !== id) {
          return res.status(409).json({ 
            message: 'Subdomain already in use by another organization' 
          });
        }
      }
      
      // Set the updater
      const updatedBy = req.user.id;
      
      const updatedOrg = await storage.updateTenant(id, {
        ...validatedData,
        updatedBy
      });
      
      res.json(updatedOrg);
    } catch (error) {
      console.error('Error updating organization:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid organization data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to update organization' });
    }
  });

  // Delete an organization
  app.delete('/api/admin/orgs/:id', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if this is the system admin organization (don't allow deletion)
      if (org.subdomain === 'admin') {
        return res.status(403).json({ 
          message: 'Cannot delete the system admin organization' 
        });
      }
      
      // Get organization users
      const orgUsers = await storage.getOrganizationUsers(id);
      
      // Remove all user-organization associations
      for (const user of orgUsers) {
        await storage.removeUserFromOrganization(user.userId, id);
      }
      
      // Delete the organization
      await storage.deleteTenant(id);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting organization:', error);
      res.status(500).json({ message: 'Failed to delete organization' });
    }
  });

  // Get users for an organization
  app.get('/api/admin/orgs/:id/users', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      const orgUsers = await storage.getOrganizationUsers(id);
      
      // Enhance with user details
      const enhancedUsers = await Promise.all(orgUsers.map(async (orgUser) => {
        const user = await storage.getUser(orgUser.userId);
        const role = await storage.getRole(orgUser.roleId);
        
        if (!user || !role) {
          return null; // Skip invalid entries
        }
        
        return {
          userId: user.id,
          email: user.username, // Using username as email
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          roleName: role.name
        };
      }));
      
      // Filter out any null entries (users or roles that weren't found)
      const validUsers = enhancedUsers.filter(user => user !== null);
      
      res.json(validUsers);
    } catch (error) {
      console.error('Error fetching organization users:', error);
      res.status(500).json({ message: 'Failed to fetch organization users' });
    }
  });

  // Add user to organization
  app.post('/api/admin/orgs/:id/users', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validatedData = assignUserSchema.parse(req.body);
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if user exists
      const user = await storage.getUser(validatedData.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if role exists
      const role = await storage.getRole(validatedData.roleId);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      
      // Check if user is already in the organization
      const existingOrgUser = await storage.getUserOrganizationRole(validatedData.userId, id);
      if (existingOrgUser) {
        return res.status(409).json({ 
          message: 'User is already assigned to this organization' 
        });
      }
      
      // Add user to organization
      const orgUser = await storage.addUserToOrganization({
        organizationId: id,
        userId: validatedData.userId,
        roleId: validatedData.roleId
      });
      
      res.status(201).json(orgUser);
    } catch (error) {
      console.error('Error adding user to organization:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid user assignment data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to add user to organization' });
    }
  });

  // Remove user from organization
  app.delete('/api/admin/orgs/:orgId/users/:userId', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      const userId = Number(req.params.userId);
      
      if (isNaN(orgId) || isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid organization or user ID' });
      }
      
      const storage = await getStorage();
      const org = await storage.getTenantById(orgId);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if user is in the organization
      const orgUser = await storage.getUserOrganizationRole(userId, orgId);
      if (!orgUser) {
        return res.status(404).json({ 
          message: 'User is not assigned to this organization' 
        });
      }
      
      // Don't allow removing the last super-admin from the admin organization
      if (org.subdomain === 'admin') {
        const role = await storage.getRole(orgUser.roleId);
        if (role && role.name === 'super-admin') {
          const adminOrgUsers = await storage.getOrganizationUsers(orgId);
          const superAdminCount = await Promise.all(adminOrgUsers.map(async (ou) => {
            const r = await storage.getRole(ou.roleId);
            return r && r.name === 'super-admin' ? 1 : 0;
          })).then(counts => counts.reduce((sum, count) => sum + count, 0));
          
          if (superAdminCount <= 1) {
            return res.status(403).json({ 
              message: 'Cannot remove the last super-admin from the system' 
            });
          }
        }
      }
      
      // Remove user from organization
      await storage.removeUserFromOrganization(userId, orgId);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error removing user from organization:', error);
      res.status(500).json({ message: 'Failed to remove user from organization' });
    }
  });

  // Get modules for an organization
  app.get('/api/admin/orgs/:id/modules', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      const modules = await storage.getOrganizationModules(id);
      
      res.json(modules);
    } catch (error) {
      console.error('Error fetching organization modules:', error);
      res.status(500).json({ message: 'Failed to fetch organization modules' });
    }
  });

  // Update modules for an organization
  app.put('/api/admin/orgs/:id/modules', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validatedData = updateOrgModulesSchema.parse(req.body);
      
      const storage = await getStorage();
      const org = await storage.getTenantById(id);
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Update the modules
      const updatedModules = await storage.updateOrganizationModules(
        id, 
        validatedData.map(module => ({
          organizationId: id,
          moduleName: module.moduleName,
          enabled: module.enabled
        }))
      );
      
      res.json(updatedModules);
    } catch (error) {
      console.error('Error updating organization modules:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid module data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to update organization modules' });
    }
  });

  // Get all users (for user selection)
  app.get('/api/admin/users', isSuperAdmin, async (req, res) => {
    try {
      const storage = await getStorage();
      const users = await storage.getUsers();
      
      // Filter out sensitive information
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get all roles
  app.get('/api/admin/roles', isSuperAdmin, async (req, res) => {
    try {
      const storage = await getStorage();
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ message: 'Failed to fetch roles' });
    }
  });
  
  // The organization user and module management endpoints are defined elsewhere
  // (These endpoints were duplicated in the file, so we're removing the duplicates)
  
  // Get all users
  app.get('/api/admin/users', isSuperAdmin, async (req, res) => {
    try {
      const storage = await getStorage();
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  // Get admin dashboard stats
  app.get('/api/admin/stats', isSuperAdmin, async (req, res) => {
    try {
      const storage = await getStorage();
      
      // Get organizations count
      const orgs = await storage.getAllTenants();
      const organizationsCount = orgs.length;
      
      // Get users count
      const users = await storage.getUsers();
      const usersCount = users.length;
      
      // Get unique modules count
      const availableModules = Object.values(AvailableModule);
      const modulesCount = availableModules.length;
      
      res.json({
        organizationsCount,
        usersCount,
        modulesCount,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  });
  

};