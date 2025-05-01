import { Request, Response } from 'express';
import { getStorage } from '../../storage';

export interface Holiday {
  name: string;
  date: string; // ISO format date string (YYYY-MM-DD)
  enabled: boolean;
}

/**
 * Get all holidays for an organization
 */
export async function getOrganizationHolidays(req: Request, res: Response) {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }
    
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Get holidays from organization metadata
    const holidays = organization.metadata?.holidays || [];
    
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching organization holidays:', error);
    res.status(500).json({ message: 'Failed to fetch organization holidays' });
  }
}

/**
 * Update holidays for an organization
 */
export async function updateOrganizationHolidays(req: Request, res: Response) {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }
    
    const { holidays } = req.body;
    
    if (!Array.isArray(holidays)) {
      return res.status(400).json({ message: 'Holidays must be an array' });
    }
    
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Create or update metadata object with holidays
    const metadata = organization.metadata || {};
    metadata.holidays = holidays;
    
    // Update organization with new metadata
    await storage.updateTenant(organizationId, {
      metadata
    });
    
    res.json({ success: true, holidays });
  } catch (error) {
    console.error('Error updating organization holidays:', error);
    res.status(500).json({ message: 'Failed to update organization holidays' });
  }
}

/**
 * Check if a given date is a holiday for an organization
 */
export async function isHoliday(organizationId: number, dateStr: string): Promise<boolean> {
  try {
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return false;
    }
    
    // Get holidays from organization metadata
    const holidays: Holiday[] = organization.metadata?.holidays || [];
    
    // Check if the date matches any enabled holiday
    return holidays.some(holiday => 
      holiday.enabled && 
      holiday.date === dateStr
    );
  } catch (error) {
    console.error('Error checking if date is a holiday:', error);
    return false;
  }
}