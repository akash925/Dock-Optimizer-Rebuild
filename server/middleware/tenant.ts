import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../modules/tenants/service';

/**
 * Add tenant information to the request object
 * This middleware detects the current tenant based on subdomain or header
 */
export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Add tenant field to the Express Request type
    const typedReq = req as Request & { tenant?: any };
    
    // Extract tenant identifier from various sources
    const hostname = req.hostname;
    const tenantHeader = req.headers['x-tenant-id'] as string;
    const tenantSubdomainHeader = req.headers['x-tenant-subdomain'] as string;
    
    // Method 1: Get tenant from Header (x-tenant-id)
    if (tenantHeader && !isNaN(parseInt(tenantHeader))) {
      const tenantId = parseInt(tenantHeader);
      const tenant = await tenantService.getTenant(tenantId);
      
      if (tenant) {
        typedReq.tenant = tenant;
        return next();
      }
    }
    
    // Method 2: Get tenant from Header (x-tenant-subdomain)
    if (tenantSubdomainHeader) {
      const tenant = await tenantService.getTenantBySubdomain(tenantSubdomainHeader);
      
      if (tenant) {
        typedReq.tenant = tenant;
        return next();
      }
    }
    
    // Method 3: Extract tenant from subdomain
    // Format: {subdomain}.example.com or {subdomain}.localhost
    const subdomain = hostname.split('.')[0];
    
    // Skip for localhost without subdomain or for IP addresses
    if (subdomain && 
        hostname !== 'localhost' && 
        !hostname.match(/^\d+\.\d+\.\d+\.\d+$/) &&
        subdomain !== 'www') {
      
      const tenant = await tenantService.getTenantBySubdomain(subdomain);
      
      if (tenant) {
        typedReq.tenant = tenant;
        return next();
      }
    }
    
    // If we got here, either no tenant was identified or we're on the main domain
    // which is okay for shared resources or the super admin area
    next();
  } catch (error) {
    console.error('Error in tenant middleware:', error);
    next();
  }
};

/**
 * Require a valid tenant for this route
 * Ensures that the route is only accessible within the context of a tenant
 */
export const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  const typedReq = req as Request & { tenant?: any };
  
  if (!typedReq.tenant) {
    return res.status(404).json({ message: 'Tenant not found' });
  }
  
  next();
};