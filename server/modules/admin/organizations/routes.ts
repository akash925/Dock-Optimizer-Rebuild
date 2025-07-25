import { Express, Request, Response } from 'express';
import { getStorage } from '../../../storage';
import { z } from 'zod';
import { TenantStatus, AvailableModule, ActivityLogEvents } from '@shared/schema';
import { db } from '../../../db';
import { eq, sql } from 'drizzle-orm';
import { users, tenants, organizationUsers, organizationModules, roles } from '@shared/schema';
import { isAuthenticated } from '../../../types/express';

// API routes for organization modules
export const registerOrganizationModulesRoutes = (app: Express) => {
  // Public API endpoint to get tenant default hours by ID
  app.get('/api/tenants/:id/default-hours', async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const tenantId = parseInt(req.params.id);
      
      if (isNaN(tenantId)) {
        return res.status(400).json({ message: "Invalid tenant ID" });
      }
      
      const storage = await getStorage();
      
      // Get tenant default hours
      const defaultHours = await storage.getOrganizationDefaultHours(tenantId);
      
      if (!defaultHours) {
        return res.status(404).json({ 
          message: "Default hours not found for tenant" 
        });
      }
      
      res.json(defaultHours);
    } catch (error) {
      console.error('Error fetching tenant default hours:', error);
      res.status(500).json({ 
        message: "Failed to fetch tenant default hours", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get organization default hours
  app.get('/api/organizations/default-hours', async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    try {
      // Get user's tenant ID
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(403).json({ 
          message: "User must belong to an organization" 
        });
      }
      
      const storage = await getStorage();
      
      // Get organization default hours
      const defaultHours = await storage.getOrganizationDefaultHours(tenantId);
      
      if (!defaultHours) {
        return res.status(404).json({ 
          message: "Organization default hours not found" 
        });
      }
      
      res.json(defaultHours);
    } catch (error) {
      console.error('Error fetching organization default hours:', error);
      res.status(500).json({ 
        message: "Failed to fetch organization default hours", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // NOTE: Organization default hours PUT route removed to avoid conflicts
  // Use PATCH /api/organizations/default-hours from main routes.ts for individual day updates

  // Toggle a single module for an organization
  app.patch('/api/admin/orgs/:orgId/modules/:moduleName', async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const { orgId, moduleName } = req.params;
      const { enabled } = req.body;
      
      // Validate inputs
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      if (!orgId || isNaN(Number(orgId))) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      if (!moduleName || !Object.values(AvailableModule).includes(moduleName as AvailableModule)) {
        return res.status(400).json({ message: 'Invalid module name' });
      }
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Enabled status must be a boolean' });
      }
      
      const storage = await getStorage();
      
      // Update the module
      const updatedModule = await storage.updateOrganizationModule(
        Number(orgId),
        moduleName as AvailableModule,
        enabled
      );
      
      if (!updatedModule) {
        return res.status(404).json({
          message: 'Module not found for organization'
        });
      }
      
      // Log the activity
      await logOrganizationActivity(
        Number(orgId),
        req.user?.id,
        `module_${enabled ? 'enabled' : 'disabled'}`,
        `${moduleName} module was ${enabled ? 'enabled' : 'disabled'}`
      );
      
      // Return the updated module
      res.json(updatedModule);
      
    } catch (error) {
      console.error('Error toggling organization module:', error);
      res.status(500).json({
        message: 'Failed to toggle organization module'
      });
    }
  });
};

// Helper function to log organization activity
async function logOrganizationActivity(orgId: number, userId: number, action: string, details: string) {
  try {
    const storage = await getStorage();
    // Use the storage interface method for better consistency
    await storage.logOrganizationActivity({
      organizationId: orgId,
      userId,
      action,
      details
    });
    console.log(`Activity logged for org ${orgId}: ${action}`);
  } catch (error) {
    console.error('Failed to log organization activity:', error);
    // Fallback to direct DB insert if the storage method fails
    try {
      await db.insert(activityLogs).values({
        organizationId: orgId,
        userId,
        action,
        details
      });
    } catch (fallbackError) {
      console.error('Fallback logging also failed:', fallbackError);
    }
  }
}

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

// Middleware to check if the user is an admin/super-admin
const isSuperAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Allow both regular admin and super-admin roles
  if ((req.user as NonNullable<typeof req.user>).role !== 'super-admin' && (req.user as NonNullable<typeof req.user>).role !== 'admin') {
    return res.status(403).json({ 
      message: 'Not authorized. Admin access required.', 
      userRole: (req.user as NonNullable<typeof req.user>).role 
    });
  }

  console.log(`Admin API (org) access granted to user with role: ${(req.user as NonNullable<typeof req.user>).role}`);
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
  // Get all organizations with count information (support both URLs for backward compatibility)
  const getAllOrganizations = async (req: Request, res: Response) => {
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
  };

  // Register both endpoints for backward compatibility
  app.get('/api/admin/organizations', isSuperAdmin, getAllOrganizations);
  app.get('/api/admin/orgs', isSuperAdmin, getAllOrganizations);

  // Get single organization with all details
  app.get('/api/admin/organizations/:id', isSuperAdmin, async (req: Request, res: Response) => {
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
  app.post('/api/admin/organizations', isSuperAdmin, async (req: Request, res: Response) => {
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
  app.put('/api/admin/organizations/:id', isSuperAdmin, async (req: Request, res: Response) => {
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
  
  // Update organization logo
  app.post('/api/admin/organizations/:id/logo', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      const { logoData } = req.body;
      
      if (!logoData) {
        return res.status(400).json({ message: 'Logo data is required' });
      }
      
      // Check if user has permission (either super-admin or admin of this org)
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const isSuperAdmin = (req.user as NonNullable<typeof req.user>).role === 'super-admin';
      const isOrgAdmin = (req.user as NonNullable<typeof req.user>).tenantId === id && (req.user as NonNullable<typeof req.user>).role === 'admin';
      
      if (!isSuperAdmin && !isOrgAdmin) {
        console.log(`Access denied: User (tenant ${(req.user as NonNullable<typeof req.user>).tenantId}) attempted to update logo for organization ${id}`);
        return res.status(403).json({ 
          message: 'Not authorized to update this organization\'s logo',
          userTenant: (req.user as NonNullable<typeof req.user>).tenantId,
          requestedTenant: id
        });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const existingOrg = await storage.getTenantById(id);
      if (!existingOrg) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Process the image data - store the actual data URL
      let processedLogoData = logoData;
      
      // Make sure the logo data is valid
      if (!logoData.startsWith('data:image')) {
        console.warn(`Invalid logo data format received for organization ${id}`);
        return res.status(400).json({ message: 'Invalid logo data format. Must be a data URL.' });
      }
      
      // For database storage, we directly store the data URL
      // This allows us to retrieve the exact logo that was uploaded
      console.log(`Storing logo data for organization ${id}`);
      
      // No need to hardcode paths anymore - we'll store the actual image data
      // This fixes the issue where uploaded logos weren't being saved properly
      
      // Update just the logo field
      const updatedOrg = await storage.updateTenant(id, {
        logo: processedLogoData,
        updatedBy: req.user?.id
      });
      
      // Log the activity
      await logOrganizationActivity(
        id,
        req.user?.id || 0,
        'logo_updated',
        'Organization logo was updated'
      );
      
      res.json({ success: true, logo: updatedOrg.logo });
    } catch (error) {
      console.error('Error updating organization logo:', error);
      res.status(500).json({ message: 'Failed to update organization logo' });
    }
  });

  // Get organization logo
  app.get('/api/admin/organizations/:id/logo', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      // Ensure user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      // Check if the user is requesting a logo for their organization
      const requestedOrgId = id;
      const userOrgId = (req.user as NonNullable<typeof req.user>).tenantId;
      
      // Non-super-admin users can only access their own organization's logo
      if ((req.user as NonNullable<typeof req.user>).role !== 'super-admin' && userOrgId !== requestedOrgId) {
        console.log(`Access denied: User (tenant ${userOrgId}) attempted to access logo for organization ${requestedOrgId}`);
        return res.status(403).json({ 
          message: 'Not authorized to access another organization\'s logo',
          userTenant: userOrgId,
          requestedTenant: requestedOrgId
        });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const existingOrg = await storage.getTenantById(id);
      if (!existingOrg) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Add tenant isolation logging
      console.log(`Logo request for organization ${id} by user from tenant ${userOrgId}`);
      
      // Return the actual logo from the database
      // This ensures we're always returning what was uploaded and stored
      console.log(`Retrieving logo for organization ${id}`);
      
      if (existingOrg.logo) {
        console.log(`Found stored logo data for organization ${id}`);
      } else {
        console.log(`No logo data found for organization ${id}, using fallback path`);
        
        // Only use fallback paths if we don't have actual logo data
        // This maintains backward compatibility
        if (id === 5) {
          return res.json({ logo: "/assets/fresh-connect-logo.png" });
        } else if (id === 2) {
          return res.json({ logo: "/assets/hanzo-logo.png" });
        }
      }
      
      // Return the logo or null if not set
      res.json({ logo: existingOrg.logo || null });
    } catch (error) {
      console.error('Error fetching organization logo:', error);
      res.status(500).json({ message: 'Failed to fetch organization logo' });
    }
  });
  
  // Delete organization
  app.delete('/api/admin/organizations/:id', isSuperAdmin, async (req: Request, res: Response) => {
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
  app.get('/api/admin/orgs/:orgId', isSuperAdmin, async (req: Request, res: Response) => {
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
      let logs: any[] = [];
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
        timezone: org.timezone,
        logoUrl: org.logo,
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
  app.put('/api/admin/orgs/:orgId/modules', isSuperAdmin, async (req: Request, res: Response) => {
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
      
      // Get current modules for this organization
      const existingModules = await storage.getOrganizationModules(orgId);
      
      // Prepare updated modules list
      const updatedModules = existingModules.map(module => ({
        organizationId: orgId,
        moduleName: module.moduleName,
        enabled: module.moduleName === moduleName ? enabled : module.enabled
      }));
      
      // Update all modules at once
      const result = await storage.updateOrganizationModules(orgId, updatedModules);
      
      // For logging
      const updatedModule = result.find(m => m.moduleName === moduleName);
      
      // Log the action using our helper function
      try {
        const userId = req.user?.id || 0;
        const action = enabled ? 'module_enabled' : 'module_disabled';
        const details = `Module "${moduleName}" was ${enabled ? 'enabled' : 'disabled'} for organization "${org.name}"`;
        
        await logOrganizationActivity(orgId, userId, action, details);
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

  // Toggle a specific module for an organization
  app.put('/api/admin/orgs/:orgId/modules/:moduleName', isSuperAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = Number(req.params.orgId);
      const moduleName = req.params.moduleName as AvailableModule;
      
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      // Parse the enabled status from the request body
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be boolean' });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Update the module status
      const updatedModule = await storage.updateOrganizationModule(orgId, moduleName, enabled);
      
      // Log the activity
      try {
        const userId = req.user?.id || 0;
        const action = enabled ? 'module_enabled' : 'module_disabled';
        const details = `Module "${moduleName}" was ${enabled ? 'enabled' : 'disabled'} for organization "${org.name}"`;
        
        await logOrganizationActivity(orgId, userId, action, details);
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
  app.put('/api/admin/orgs/:orgId/users', isSuperAdmin, async (req: Request, res: Response) => {
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
      const user = await storage.getUser(userId);
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
        
        // Log the action using our helper function
        try {
          const adminUserId = req.user?.id || 0;
          const action = 'user_added';
          const details = `User "${user.username}" added with role "${role.name}" to organization "${org.name}"`;
          
          await logOrganizationActivity(orgId, adminUserId, action, details);
        } catch (logError) {
          console.warn('Failed to log user add activity:', logError);
          // Continue even if logging fails
        }
      } else {
        // Remove user from organization
        result = await storage.removeUserFromOrganization(userId, orgId);
        
        // Log the action using our helper function
        try {
          const adminUserId = req.user?.id || 0;
          const action = 'user_removed';
          const details = `User "${user.username}" removed from organization "${org.name}"`;
          
          await logOrganizationActivity(orgId, adminUserId, action, details);
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
  app.get('/api/admin/orgs/:orgId/logs', isSuperAdmin, async (req: Request, res: Response) => {
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
      
      // Get logs from database directly
      let logs: Array<{id: number, timestamp: string, action: string, details: string}> = [];
      let totalLogs = 0;
      
      try {
        // Calculate offset based on pagination
        const offset = (page - 1) * limit;
        
        // Get logs with pagination
        const result = await db.execute(sql`
          SELECT id, timestamp, action, details 
          FROM activity_logs 
          WHERE organization_id = ${orgId} 
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
        
        // Parse the results
        if (result.rows) {
          logs = result.rows.map(row => ({
            id: Number(row.id),
            timestamp: new Date(row.timestamp as string | number | Date).toISOString(),
            action: String(row.action),
            details: String(row.details)
          }));
        }
        
        // Get total count for pagination
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM activity_logs WHERE organization_id = ${orgId}
        `);
        
        if (countResult.rows?.[0]) {
          totalLogs = Number(countResult.rows[0].total) || 0;
        }
      } catch (logError) {
        console.warn('Error fetching activity logs:', logError);
        // If there's an error, return empty logs but don't fail the request
      }
      
      res.json({
        logs,
        pagination: {
          page,
          limit,
          totalItems: totalLogs,
          totalPages: Math.max(1, Math.ceil(totalLogs / limit))
        }
      });
    } catch (error) {
      console.error('Error fetching organization logs:', error);
      res.status(500).json({ message: 'Failed to fetch organization logs' });
    }
  });
  
  // Consolidated organization detail endpoint that combines all org data
  app.get('/api/admin/orgs/:orgId/detail', isSuperAdmin, async (req: Request, res: Response) => {
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
        console.log("Creating default modules for organization", orgId);
        const now = new Date();
        // Add default modules for UI display using correct AvailableModule values
        modules = [
          { moduleName: "doorManager", enabled: true, id: 1, createdAt: now, organizationId: orgId },
          { moduleName: "appointments", enabled: true, id: 2, createdAt: now, organizationId: orgId },
          { moduleName: "userManagement", enabled: false, id: 3, createdAt: now, organizationId: orgId },
          { moduleName: "companyAssets", enabled: false, id: 4, createdAt: now, organizationId: orgId },
          { moduleName: "analytics", enabled: false, id: 5, createdAt: now, organizationId: orgId },
          { moduleName: "emailNotifications", enabled: true, id: 6, createdAt: now, organizationId: orgId },
          { moduleName: "bookingPages", enabled: true, id: 8, createdAt: now, organizationId: orgId },
          { moduleName: "facilityManagement", enabled: true, id: 9, createdAt: now, organizationId: orgId },
        ];
      }
      
      // Simplify the module structure for the frontend to avoid TypeScript errors
      const simplifiedModules = modules.map(m => ({
        moduleName: m.moduleName,
        enabled: Boolean(m.enabled),
      }));
      
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
      
      // Get recent logs from database directly (limited to 10 most recent)
      let logs: Array<{id: number, timestamp: string, action: string, details: string}> = [];
      try {
        const result = await db.execute(sql`
          SELECT id, timestamp, action, details 
          FROM activity_logs 
          WHERE organization_id = ${orgId} 
          ORDER BY timestamp DESC
          LIMIT 10
        `);
        
        // Parse the results
        if (result.rows) {
          logs = result.rows.map(row => ({
            id: Number(row.id),
            timestamp: new Date(row.timestamp as string | number | Date).toISOString(),
            action: String(row.action),
            details: String(row.details)
          }));
        }
      } catch (logError) {
        console.warn('Error fetching activity logs for org detail:', logError);
        // If there's an error, return empty logs but don't fail the request
      }
      
      // For debugging
      console.log(`Got detail for org ${orgId}: ${enhancedUsers.length} users, ${modules.length} modules`);
      
      // Format response
      const result = {
        ...org,
        users: enhancedUsers,
        modules: simplifiedModules,
        logs,
      };
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching detailed organization data:', error);
      res.status(500).json({ message: 'Failed to fetch organization details' });
    }
  });
};