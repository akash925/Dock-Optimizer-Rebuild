import { Request, Response } from 'express';
import { tenantService } from './service.js';
import { TenantStatus, insertTenantSchema, AvailableModule } from '@shared/schema';
import { z } from 'zod';

export const getTenants = async (_req: Request, res: Response) => {
  try {
    const tenants = await tenantService.getTenants();
    return res.status(200).json(tenants);
  } catch (error) {
    console.error('Error getting tenants:', error);
    return res.status(500).json({ message: 'Failed to get tenants' });
  }
};

export const getTenant = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    const tenant = await tenantService.getTenant(id);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    
    return res.status(200).json(tenant);
  } catch (error) {
    console.error('Error getting tenant:', error);
    return res.status(500).json({ message: 'Failed to get tenant' });
  }
};

export const getTenantBySubdomain = async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.params;
    
    if (!subdomain) {
      return res.status(400).json({ message: 'Subdomain is required' });
    }
    
    const tenant = await tenantService.getTenantBySubdomain(subdomain);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    
    return res.status(200).json(tenant);
  } catch (error) {
    console.error('Error getting tenant by subdomain:', error);
    return res.status(500).json({ message: 'Failed to get tenant' });
  }
};

export const createTenant = async (req: Request, res: Response) => {
  try {
    // Create extended schema with validation
    const createTenantSchema = insertTenantSchema.extend({
      initialModules: z.array(z.string()).optional(),
    });
    
    // Validate request body
    const result = createTenantSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid tenant data', 
        errors: result.error.errors 
      });
    }
    
    const { initialModules, ...tenantData } = result.data;
    
    // Create tenant
    const newTenant = await tenantService.createTenant(
      tenantData as any, // Type assertion for tenant creation data
      initialModules as AvailableModule[]
    );
    
    if (!newTenant) {
      return res.status(500).json({ message: 'Failed to create tenant' });
    }
    
    return res.status(201).json(newTenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    return res.status(500).json({ message: 'Failed to create tenant' });
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    // Validate request body
    const updateTenantSchema = insertTenantSchema.partial();
    const result = updateTenantSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Invalid tenant data', 
        errors: result.error.errors 
      });
    }
    
    const updatedTenant = await tenantService.updateTenant(id, result.data as any); // Type assertion for update data
    
    if (!updatedTenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    
    return res.status(200).json(updatedTenant);
  } catch (error) {
    console.error('Error updating tenant:', error);
    return res.status(500).json({ message: 'Failed to update tenant' });
  }
};

export const updateTenantStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    // Validate status
    if (!status || !Object.values(TenantStatus).includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const updatedTenant = await tenantService.updateTenantStatus(id, status as TenantStatus);
    
    if (!updatedTenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    
    return res.status(200).json(updatedTenant);
  } catch (error) {
    console.error('Error updating tenant status:', error);
    return res.status(500).json({ message: 'Failed to update tenant status' });
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    const success = await tenantService.deleteTenant(id);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete tenant' });
    }
    
    return res.status(200).json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return res.status(500).json({ message: 'Failed to delete tenant' });
  }
};