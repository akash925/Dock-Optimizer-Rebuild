import { Express, Request, Response, NextFunction } from 'express';
import { getStorage } from './storage';

// Super admin middleware
const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  // Only allow super-admin role
  if (req.user.role !== 'super-admin') {
    return res.status(403).json({ 
      message: 'Not authorized. Super admin access required.', 
      userRole: req.user.role 
    });
  }

  console.log(`Admin API access granted to super-admin: ${req.user.username}`);
  next();
};

// Admin routes for the main admin panel
export function adminRoutes(app: Express) {
  const storage = getStorage();

  // Get all organizations
  app.get('/api/admin/organizations', isSuperAdmin, async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      return res.status(200).json(organizations);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return res.status(500).json({ 
        message: 'Error fetching organizations', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get organization by ID
  app.get('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
    try {
      const organization = await storage.getOrganization(parseInt(req.params.id));
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      return res.status(200).json(organization);
    } catch (error) {
      console.error(`Error fetching organization ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error fetching organization', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Create organization
  app.post('/api/admin/organizations', isSuperAdmin, async (req, res) => {
    try {
      const organization = await storage.createOrganization(req.body);
      return res.status(201).json(organization);
    } catch (error) {
      console.error('Error creating organization:', error);
      return res.status(500).json({ 
        message: 'Error creating organization', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Update organization
  app.put('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
    try {
      const organization = await storage.updateOrganization(parseInt(req.params.id), req.body);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      return res.status(200).json(organization);
    } catch (error) {
      console.error(`Error updating organization ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error updating organization', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Delete organization
  app.delete('/api/admin/organizations/:id', isSuperAdmin, async (req, res) => {
    try {
      const result = await storage.deleteOrganization(parseInt(req.params.id));
      if (!result) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      return res.status(200).json({ message: 'Organization deleted successfully' });
    } catch (error) {
      console.error(`Error deleting organization ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error deleting organization', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get all users
  app.get('/api/admin/users', isSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove password from response
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      return res.status(200).json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ 
        message: 'Error fetching users', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get user by ID
  app.get('/api/admin/users/:id', isSuperAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Remove password from response
      const { password, ...sanitizedUser } = user;
      return res.status(200).json(sanitizedUser);
    } catch (error) {
      console.error(`Error fetching user ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error fetching user', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Create user
  app.post('/api/admin/users', isSuperAdmin, async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      // Remove password from response
      const { password, ...sanitizedUser } = user;
      return res.status(201).json(sanitizedUser);
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ 
        message: 'Error creating user', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Update user
  app.put('/api/admin/users/:id', isSuperAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(parseInt(req.params.id), req.body);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Remove password from response
      const { password, ...sanitizedUser } = user;
      return res.status(200).json(sanitizedUser);
    } catch (error) {
      console.error(`Error updating user ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error updating user', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Delete user
  app.delete('/api/admin/users/:id', isSuperAdmin, async (req, res) => {
    try {
      const result = await storage.deleteUser(parseInt(req.params.id));
      if (!result) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error(`Error deleting user ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error deleting user', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get organization modules
  app.get('/api/admin/organizations/:id/modules', isSuperAdmin, async (req, res) => {
    try {
      const organization = await storage.getOrganization(parseInt(req.params.id));
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      return res.status(200).json(organization.modules || []);
    } catch (error) {
      console.error(`Error fetching modules for organization ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error fetching organization modules', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Update organization modules
  app.put('/api/admin/organizations/:id/modules', isSuperAdmin, async (req, res) => {
    try {
      const organization = await storage.getOrganization(parseInt(req.params.id));
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      const updatedOrg = await storage.updateOrganization(parseInt(req.params.id), {
        modules: req.body.modules
      });
      
      return res.status(200).json(updatedOrg.modules || []);
    } catch (error) {
      console.error(`Error updating modules for organization ${req.params.id}:`, error);
      return res.status(500).json({ 
        message: 'Error updating organization modules', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  console.log('Admin routes registered successfully');
}