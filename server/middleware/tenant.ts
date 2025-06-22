import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../modules/tenants/service';
import { reportRateLimitError } from './rate-limit-protection';

// In-memory cache for tenant lookups (5 minute TTL)
const tenantCache = new Map<string, { tenant: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  tenantCache.forEach((value, key) => {
    if (value.expires < now) {
      tenantCache.delete(key);
    }
  });
}, 60 * 1000); // Clean up every minute

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
    
    // Skip tenant lookup for Replit development environments
    if (hostname.includes('replit.dev') || 
        hostname.includes('replit.co') || 
        hostname.match(/^[a-f0-9-]{36,}$/i) || // Replit workspace ID pattern
        hostname === 'localhost' ||
        hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return next();
    }
    
    // Helper function to get cached tenant or fetch from DB
    const getCachedTenant = async (cacheKey: string, fetchFn: () => Promise<any>) => {
      const cached = tenantCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.tenant;
      }
      
      try {
        const tenant = await fetchFn();
        if (tenant) {
          tenantCache.set(cacheKey, {
            tenant,
            expires: Date.now() + CACHE_TTL
          });
        }
        return tenant;
             } catch (error: any) {
         // Report rate limit errors to protection system
         if (error.code === 'XX000' && error.message?.includes('rate limit')) {
           reportRateLimitError(error);
           
           // If it's a rate limit error, use cached value if available
           if (cached) {
             console.log(`[TENANT] Using cached tenant for ${cacheKey} due to rate limit`);
             return cached.tenant;
           }
         }
         throw error;
       }
    };

    // Method 1: Get tenant from Header (x-tenant-id)
    if (tenantHeader && !isNaN(parseInt(tenantHeader))) {
      const tenantId = parseInt(tenantHeader);
      const tenant = await getCachedTenant(`id:${tenantId}`, () => 
        tenantService.getTenant(tenantId)
      );
      
      if (tenant) {
        typedReq.tenant = tenant;
        return next();
      }
    }
    
    // Method 2: Get tenant from Header (x-tenant-subdomain)
    if (tenantSubdomainHeader) {
      const tenant = await getCachedTenant(`subdomain:${tenantSubdomainHeader}`, () =>
        tenantService.getTenantBySubdomain(tenantSubdomainHeader)
      );
      
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
      
      const tenant = await getCachedTenant(`subdomain:${subdomain}`, () =>
        tenantService.getTenantBySubdomain(subdomain)
      );
      
      if (tenant) {
        typedReq.tenant = tenant;
        return next();
      }
    }
    
    // If we got here, either no tenant was identified or we're on the main domain
    // which is okay for shared resources or the super admin area
    next();
  } catch (error: any) {
    // Handle rate limiting gracefully
    if (error.code === 'XX000' && error.message?.includes('rate limit')) {
      reportRateLimitError(error);
      console.log('[TENANT] Rate limit hit, proceeding without tenant lookup');
      return next();
    }
    
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