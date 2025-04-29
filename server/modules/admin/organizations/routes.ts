import { Express, Request, Response } from 'express';
import { getStorage } from '../../../storage';
import { z } from 'zod';
import { TenantStatus } from '@shared/schema';

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
};