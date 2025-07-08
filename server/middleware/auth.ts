import { Request, Response, NextFunction } from 'express';
import { Role } from '@shared/schema';

/**
 * Middleware to check if the user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Middleware to check if the user is an admin
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ error: 'Forbidden - Admin access required' });
}

/**
 * Middleware to check if the user has the required role(s)
 * @param role A single role or array of roles that are allowed to access the route
 */
export function hasRole(role: Role | Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = req.user.role;
    const requiredRoles = Array.isArray(role) ? role : [role];

    if (requiredRoles.includes(userRole as Role) || (userRole === 'admin')) {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
  };
}

/**
 * Middleware to check if the user is the owner of the resource or an admin
 * @param getOwnerId Function to extract the owner ID from the request
 */
export function isOwnerOrAdmin(getOwnerId: (req: Request) => Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins can access any resource
    if (userRole === 'admin') {
      return next();
    }

    // Get the owner ID of the resource
    const ownerId = await getOwnerId(req);
    
    // If the owner ID is null or doesn't match the current user
    if (ownerId === null || ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

/**
 * Middleware to validate that the user has a valid tenant ID
 */
export function validateTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = req.user as any;
  if (!user.tenantId) {
    return res.status(400).json({ error: 'User must be associated with a valid organization' });
  }

  return next();
}