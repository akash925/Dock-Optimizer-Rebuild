import { Express, Request, Response } from 'express';
import { getStorage } from '../../../storage';
import { z } from 'zod';
import { TenantStatus } from '@shared/schema';
import { db } from '../../../db';
import { users } from '@shared/schema';

// Define organization validation schemas
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
  logoUrl: z.string().optional().nullable()
});

const updateOrgSchema = createOrgSchema.partial();

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

// Schemas for organization modules and users
const updateModuleSchema = z.object({
  moduleName: z.string().min(1, "Module name is required"),
  enabled: z.boolean()
});

const updateUserSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  roleId: z.number().int().positive("Role ID must be a positive integer").optional(),
  action: z.enum(["add", "remove"])
});

export const organizationsRoutes = (app: Express) => {
  // Get all organizations with count information
  app.get('/api/admin/organizations', isSuperAdmin, async (req, res) => {
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

  // Get single organization with all details
  app.get('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
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
        modules: orgModules,
        userCount: orgUsers.length,
        moduleCount: orgModules.filter(m => m.enabled).length
      });
    } catch (error) {
      console.error('Error fetching organization details:', error);
      res.status(500).json({ message: 'Failed to fetch organization details' });
    }
  });

  // Create organization
  app.post('/api/admin/organizations', isSuperAdmin, async (req, res) => {
    try {
      const validationResult = createOrgSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid organization data', 
          errors: validationResult.error.format() 
        });
      }
      
      const storage = await getStorage();
      
      // Check if subdomain is already taken
      const existingOrg = await storage.getTenantBySubdomain(req.body.subdomain);
      if (existingOrg) {
        return res.status(409).json({ message: 'Subdomain already in use' });
      }
      
      // Create the organization
      const newOrg = await storage.createTenant({
        ...validationResult.data,
        createdBy: req.user?.id, // Use optional chaining
        status: req.body.status || TenantStatus.ACTIVE
      });
      
      res.status(201).json(newOrg);
    } catch (error) {
      console.error('Error creating organization:', error);
      res.status(500).json({ message: 'Failed to create organization' });
    }
  });

  // Update organization
  app.put('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validationResult = updateOrgSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid organization data', 
          errors: validationResult.error.format() 
        });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const existingOrg = await storage.getTenantById(id);
      if (!existingOrg) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if subdomain is already taken by another organization
      if (req.body.subdomain && req.body.subdomain !== existingOrg.subdomain) {
        const orgWithSubdomain = await storage.getTenantBySubdomain(req.body.subdomain);
        if (orgWithSubdomain && orgWithSubdomain.id !== id) {
          return res.status(409).json({ message: 'Subdomain already in use' });
        }
      }
      
      // Update the organization
      const updatedOrg = await storage.updateTenant(id, {
        ...validationResult.data,
        updatedBy: req.user?.id // Use optional chaining
      });
      
      res.json(updatedOrg);
    } catch (error) {
      console.error('Error updating organization:', error);
      res.status(500).json({ message: 'Failed to update organization' });
    }
  });

  // Delete organization
  app.delete('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const existingOrg = await storage.getTenantById(id);
      if (!existingOrg) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Prevent deletion of Global Admin organization
      if (existingOrg.subdomain === 'admin' || existingOrg.name === 'Global Admin') {
        return res.status(403).json({ message: 'Cannot delete the Global Admin organization' });
      }
      
      // Delete organization
      await storage.deleteTenant(id);
      
      res.status(200).json({ message: 'Organization deleted successfully' });
    } catch (error) {
      console.error('Error deleting organization:', error);
      res.status(500).json({ message: 'Failed to delete organization' });
    }
  });

  // Get detailed organization data for edit page
  app.get('/api/admin/orgs/:orgId', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      
      // Get organization details
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Get organization users with role information
      const users = await storage.getOrganizationUsersWithRoles(orgId);
      
      // Get organization modules
      const modules = await storage.getOrganizationModules(orgId);

      // Get organization activity logs (if implemented)
      let logs = [];
      try {
        logs = await storage.getOrganizationLogs(orgId);
      } catch (logError) {
        console.warn(`Activity logs not available for organization ${orgId}:`, logError);
        // Continue without logs if not implemented
      }
      
      res.json({
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        status: org.status,
        createdAt: org.createdAt,
        contactEmail: org.contactEmail,
        primaryContact: org.primaryContact,
        contactPhone: org.contactPhone,
        address: org.address,
        city: org.city,
        state: org.state,
        country: org.country,
        zipCode: org.zipCode,
        timezone: org.timezone,
        logoUrl: org.logoUrl,
        modules,
        users,
        logs
      });
    } catch (error) {
      console.error('Error fetching organization details:', error);
      res.status(500).json({ message: 'Failed to fetch organization details' });
    }
  });

  // Toggle organization module
  app.put('/api/admin/orgs/:orgId/modules', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validationResult = updateModuleSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid module data', 
          errors: validationResult.error.format() 
        });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Update module status
      const { moduleName, enabled } = validationResult.data;
      const updatedModule = await storage.updateOrganizationModule(orgId, moduleName, enabled);
      
      // Log the action
      try {
        await storage.logOrganizationActivity(
          orgId,
          req.user?.id || 0,
          enabled ? 'module_enabled' : 'module_disabled',
          `Module ${moduleName} ${enabled ? 'enabled' : 'disabled'}`
        );
      } catch (logError) {
        console.warn('Failed to log module update activity:', logError);
        // Continue even if logging fails
      }
      
      res.json(updatedModule);
    } catch (error) {
      console.error('Error updating organization module:', error);
      res.status(500).json({ message: 'Failed to update organization module' });
    }
  });

  // Add/remove user from organization
  app.put('/api/admin/orgs/:orgId/users', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid user data', 
          errors: validationResult.error.format() 
        });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      const { userId, roleId, action } = validationResult.data;
      
      // Check if user exists
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      let result;
      if (action === 'add') {
        if (!roleId) {
          return res.status(400).json({ message: 'Role ID is required for adding users' });
        }
        
        // Check if role exists
        const role = await storage.getRoleById(roleId);
        if (!role) {
          return res.status(404).json({ message: 'Role not found' });
        }
        
        // Add user to organization with the specified role
        result = await storage.addUserToOrganizationWithRole(userId, orgId, roleId);
        
        // Log the action
        try {
          await storage.logOrganizationActivity(
            orgId,
            req.user?.id || 0,
            'user_added',
            `User ${user.username} added with role ${role.name}`
          );
        } catch (logError) {
          console.warn('Failed to log user add activity:', logError);
          // Continue even if logging fails
        }
      } else {
        // Remove user from organization
        result = await storage.removeUserFromOrganization(userId, orgId);
        
        // Log the action
        try {
          await storage.logOrganizationActivity(
            orgId,
            req.user?.id || 0,
            'user_removed',
            `User ${user.username} removed from organization`
          );
        } catch (logError) {
          console.warn('Failed to log user remove activity:', logError);
          // Continue even if logging fails
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error updating organization user:', error);
      res.status(500).json({ message: 'Failed to update organization user' });
    }
  });

  // Get organization activity logs (paginated)
  app.get('/api/admin/orgs/:orgId/logs', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      // Parse pagination parameters
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Get logs with pagination
      const logs = await storage.getOrganizationLogsPaginated(orgId, page, limit);
      const totalLogs = await storage.getOrganizationLogsCount(orgId);
      
      res.json({
        logs,
        pagination: {
          page,
          limit,
          totalLogs,
          totalPages: Math.ceil(totalLogs / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching organization logs:', error);
      res.status(500).json({ message: 'Failed to fetch organization logs' });
    }
  });
  
  // Consolidated organization detail endpoint that combines all org data
  app.get('/api/admin/orgs/:orgId/detail', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const storage = await getStorage();
      
      // Get organization details
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Get user data with detailed info
      const orgUsers = await storage.getOrganizationUsers(orgId);
      
      // Get module data
      let modules = await storage.getOrganizationModules(orgId);
      
      // Ensure we provide some sample modules if none exist
      if (!modules || modules.length === 0) {
        // Add default modules for UI display
        modules = [
          { moduleName: 'doorManager', enabled: true },
          { moduleName: 'appointmentManager', enabled: true },
          { moduleName: 'userManager', enabled: false },
          { moduleName: 'assetManager', enabled: false },
          { moduleName: 'analytics', enabled: false },
          { moduleName: 'notifications', enabled: true },
          { moduleName: 'reports', enabled: true },
          { moduleName: 'settings', enabled: true },
          { moduleName: 'externalBooking', enabled: true },
        ];
      }
      
      // Try to load all users to get details
      let userDetails = [];
      try {
        userDetails = await db.select().from(users);
      } catch (err) {
        console.warn('Could not fetch user details from DB:', err);
      }
      
      // Format users with simple role names and add real email when possible
      const enhancedUsers = orgUsers.map((user) => {
        // Find matching user details
        const userDetail = userDetails.find(u => u.id === user.userId);
        
        return {
          userId: user.userId,
          email: userDetail?.username || `User ${user.userId}`,
          firstName: userDetail?.firstName || "",
          lastName: userDetail?.lastName || "",
          roleName: user.roleId === 1 ? 'Admin' : 
                   user.roleId === 2 ? 'Manager' : 
                   user.roleId === 3 ? 'User' : 'Unknown',
        };
      });
      
      // Empty logs array for now since we don't have the implementation yet
      const logs: Array<{id: number, timestamp: string, action: string, details: string}> = [];
      
      // For debugging
      console.log(`Got detail for org ${orgId}: ${enhancedUsers.length} users, ${modules.length} modules`);
      
      // Format response
      const result = {
        ...org,
        users: enhancedUsers,
        modules,
        logs,
      };
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching detailed organization data:', error);
      res.status(500).json({ message: 'Failed to fetch organization details' });
    }
  });
};