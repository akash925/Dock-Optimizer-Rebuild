import { Express, Request, Response } from 'express';
import { getStorage } from '../../storage';
import { z } from 'zod';
import { TenantStatus, AvailableModule } from '@shared/schema';
import { organizationsRoutes } from './organizations/routes';
import usersRoutes from './users/routes';
import settingsRoutes from './settings/routes';

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

// Middleware to check if the user is an admin or super-admin
const isSuperAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Allow both regular admin and super-admin roles
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Not authorized. Admin access required.', 
      userRole: req.user.role 
    });
  }

  console.log(`Admin API access granted to user with role: ${req.user.role}`);
  next();
};

export const adminRoutes = (app: Express) => {
  // Register organization-specific routes
  organizationsRoutes(app);
  
  // Register users routes
  app.use('/api/admin/users', usersRoutes);
  
  // Register settings routes
  app.use('/api/admin/settings', settingsRoutes);
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
      const createdBy = req.user?.id;
      
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
      
      // Create a user account for the primary contact if email is provided
      let userCreated = false;
      if (validatedData.contactEmail && validatedData.primaryContact) {
        try {
          // Import the hashPassword function from auth
          const { hashPassword } = await import('../../auth');
          
          // Create a default password (contactEmail + name parts combined)
          const nameParts = validatedData.primaryContact.split(' ');
          const defaultPassword = nameParts.length > 1 
            ? `${nameParts[0].toLowerCase()}${nameParts[1].charAt(0).toUpperCase()}123!` 
            : `${nameParts[0]}123!`;
            
          // Hash the password
          const hashedPassword = await hashPassword(defaultPassword);
          
          // Create the user
          const newUser = await storage.createUser({
            username: validatedData.contactEmail,
            email: validatedData.contactEmail,
            password: hashedPassword,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            role: 'admin'
          });
          
          // Add user to the organization with admin role (assuming role ID 1 is admin)
          // Use the addUserToOrganization method with parameters, not direct values
          await storage.addUserToOrganization({
            organizationId: newOrg.id,
            userId: newUser.id,
            roleId: 1
          });
          
          userCreated = true;
          console.log(`Created user account for ${validatedData.contactEmail} and added to organization ${newOrg.id}`);
        } catch (userError) {
          console.error('Error creating user account for contact:', userError);
          // Continue with organization creation even if user creation fails
        }
      }
      
      res.status(201).json({
        ...newOrg,
        userCreated,
        contactEmail: validatedData.contactEmail
      });
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
      const updatedBy = req.user?.id;
      
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
          })).then(counts => counts.reduce((sum, count) => sum + count, 0) as number);
          
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

  // Add user to organization with role name
  app.post('/api/admin/orgs/:orgId/users', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      // Parse the request body for userId and role
      const { userId, role } = req.body;
      
      if (!userId || !role) {
        return res.status(400).json({ message: 'User ID and role are required' });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get the role ID from the role name
      const roleRecord = await storage.getRoleByName(role);
      if (!roleRecord) {
        return res.status(404).json({ message: 'Role not found' });
      }
      
      // Add or update the user-organization relationship
      await storage.addUserToOrganizationWithRole(userId, orgId, roleRecord.id);
      
      // Get the updated users list
      const orgUsers = await storage.getOrganizationUsers(orgId);
      
      // Format users with role information
      const enhancedUsers = await Promise.all(orgUsers.map(async (orgUser) => {
        const userDetail = await storage.getUser(orgUser.userId);
        const roleDetail = await storage.getRole(orgUser.roleId);
        
        if (!userDetail || !roleDetail) {
          return null; // Skip invalid entries
        }
        
        return {
          userId: userDetail.id,
          email: userDetail.username,
          firstName: userDetail.firstName || '',
          lastName: userDetail.lastName || '',
          roleName: roleDetail.name
        };
      }));
      
      // Filter out null entries
      const validUsers = enhancedUsers.filter(user => user !== null);
      
      res.json({ success: true, users: validUsers });
    } catch (error) {
      console.error('Error adding user to organization:', error);
      res.status(500).json({ message: 'Failed to update organization user' });
    }
  });
  
  // Toggle a specific module for an organization
  app.put('/api/admin/orgs/:orgId/modules/:moduleName', isSuperAdmin, async (req, res) => {
    try {
      const orgId = Number(req.params.orgId);
      const moduleName = req.params.moduleName;
      
      if (isNaN(orgId)) {
        return res.status(400).json({ message: 'Invalid organization ID' });
      }
      
      // Parse the enabled status from the request body
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Enabled status must be a boolean' });
      }
      
      const storage = await getStorage();
      
      // Check if organization exists
      const org = await storage.getTenantById(orgId);
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Validate moduleName as a proper AvailableModule
      if (!Object.values(AvailableModule).includes(moduleName as AvailableModule)) {
        return res.status(400).json({ 
          message: 'Invalid module name',
          availableModules: Object.values(AvailableModule)
        });
      }
      
      // Use the new single module update method for better performance
      const updatedModule = await storage.updateOrganizationModule(
        orgId, 
        moduleName as AvailableModule, 
        enabled
      );
      
      if (!updatedModule) {
        return res.status(500).json({ message: 'Failed to update module' });
      }
      
      // Log the activity
      try {
        await storage.logOrganizationActivity({
          organizationId: orgId,
          userId: req.user?.id || 0,
          action: enabled ? 'module_enabled' : 'module_disabled',
          details: `Module "${moduleName}" ${enabled ? 'enabled' : 'disabled'} for organization "${org.name}"`
        });
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
  
  // Get all appointments across all organizations (admin view)
  app.get('/api/admin/appointments', isSuperAdmin, async (req, res) => {
    try {
      const { page = 1, limit = 50, status, organizationId, startDate, endDate, search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      console.log('[Admin] Fetching appointments across all organizations');
      
      // Build query conditions
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;
      
      // Filter by status if provided
      if (status && status !== 'all') {
        whereConditions.push(`s.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }
      
      // Filter by organization if provided
      if (organizationId && organizationId !== 'all') {
        whereConditions.push(`t.id = $${paramIndex}`);
        queryParams.push(Number(organizationId));
        paramIndex++;
      }
      
      // Filter by date range if provided
      if (startDate) {
        whereConditions.push(`s.start_time >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        whereConditions.push(`s.start_time <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }
      
      // Search functionality (customer name, confirmation code, etc.)
      if (search) {
        whereConditions.push(`(
          s.customer_name ILIKE $${paramIndex} OR 
          s.confirmation_code ILIKE $${paramIndex} OR 
          s.driver_name ILIKE $${paramIndex} OR
          c.name ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Main query to get appointments with organization context
      const appointmentsQuery = `
        SELECT 
          s.id,
          s.start_time,
          s.end_time,
          s.status,
          s.customer_name,
          s.driver_name,
          s.confirmation_code,
          s.notes,
          s.created_at,
          s.updated_at,
          
          -- Organization info
          t.id as organization_id,
          t.name as organization_name,
          t.subdomain as organization_subdomain,
          
          -- Facility info
          f.id as facility_id,
          f.name as facility_name,
          f.address1 as facility_address,
          
          -- Dock info
          d.id as dock_id,
          d.name as dock_name,
          
          -- Carrier info
          c.id as carrier_id,
          c.name as carrier_name,
          
          -- Appointment type info
          at.id as appointment_type_id,
          at.name as appointment_type_name,
          at.duration as appointment_duration
          
        FROM schedules s
        
        -- Join with docks to get facility
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        
        -- Join with organization through facility relationship
        LEFT JOIN organization_facilities of ON f.id = of.facility_id
        LEFT JOIN tenants t ON of.organization_id = t.id
        
        -- Join with other entities
        LEFT JOIN carriers c ON s.carrier_id = c.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        
        ${whereClause}
        
        ORDER BY s.start_time DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      // Add pagination parameters
      queryParams.push(Number(limit), offset);
      
      // Count query for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN organization_facilities of ON f.id = of.facility_id
        LEFT JOIN tenants t ON of.organization_id = t.id
        LEFT JOIN carriers c ON s.carrier_id = c.id
        ${whereClause}
      `;
      
      // Execute queries
      const appointmentsResult = await db.execute(appointmentsQuery);
      const countResult = await db.execute(countQuery.replace(/\$\d+/g, (match, p1) => {
        const index = parseInt(match.replace('$', '')) - 1;
        return queryParams[index] !== undefined ? `$${index + 1}` : match;
      }));
      
      const appointments = appointmentsResult.rows;
      const total = parseInt(countResult.rows[0]?.total || '0');
      const totalPages = Math.ceil(total / Number(limit));
      
      console.log(`[Admin] Found ${appointments.length} appointments (${total} total)`);
      
      res.json({
        appointments,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: Number(page) < totalPages,
          hasPreviousPage: Number(page) > 1
        }
      });
    } catch (error) {
      console.error('Error fetching admin appointments:', error);
      res.status(500).json({ message: 'Failed to fetch appointments' });
    }
  });

  // Get single appointment details for admin view
  app.get('/api/admin/appointments/:id', isSuperAdmin, async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      
      if (isNaN(appointmentId)) {
        return res.status(400).json({ message: 'Invalid appointment ID' });
      }
      
      console.log(`[Admin] Fetching appointment details for ID: ${appointmentId}`);
      
      // Detailed appointment query with all related information
      const appointmentQuery = `
        SELECT 
          s.*,
          
          -- Organization info
          t.id as organization_id,
          t.name as organization_name,
          t.subdomain as organization_subdomain,
          t.contact_email as organization_contact,
          
          -- Facility info
          f.id as facility_id,
          f.name as facility_name,
          f.address1 as facility_address,
          f.city as facility_city,
          f.state as facility_state,
          f.pincode as facility_zip,
          
          -- Dock info
          d.id as dock_id,
          d.name as dock_name,
          
          -- Carrier info
          c.id as carrier_id,
          c.name as carrier_name,
          c.contact_phone as carrier_phone,
          
          -- Appointment type info
          at.id as appointment_type_id,
          at.name as appointment_type_name,
          at.duration as appointment_duration,
          at.description as appointment_type_description,
          
          -- User who created the appointment
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name,
          u.email as created_by_email
          
        FROM schedules s
        
        -- Join with docks to get facility
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        
        -- Join with organization through facility relationship
        LEFT JOIN organization_facilities of ON f.id = of.facility_id
        LEFT JOIN tenants t ON of.organization_id = t.id
        
        -- Join with other entities
        LEFT JOIN carriers c ON s.carrier_id = c.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        LEFT JOIN users u ON s.created_by = u.id
        
        WHERE s.id = $1
      `;
      
      const result = await db.execute(appointmentQuery);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      const appointment = result.rows[0];
      
      // Get any custom field data for this appointment
      let customFields = [];
      try {
        const customFieldsQuery = `
          SELECT field_key, field_value, field_type
          FROM appointment_custom_fields 
          WHERE appointment_id = $1
          ORDER BY field_key
        `;
        const customFieldsResult = await db.execute(customFieldsQuery);
        customFields = customFieldsResult.rows;
      } catch (error) {
        console.warn('Could not fetch custom fields:', error);
      }
      
      console.log(`[Admin] Successfully retrieved appointment ${appointmentId} details`);
      
      res.json({
        appointment,
        customFields
      });
    } catch (error) {
      console.error('Error fetching admin appointment details:', error);
      res.status(500).json({ message: 'Failed to fetch appointment details' });
    }
  });

};