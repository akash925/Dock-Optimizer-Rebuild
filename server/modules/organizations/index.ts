import express, { Request, Response } from 'express';
import { getOrganizationHolidays, updateOrganizationHolidays } from './holidays';
import { getStorage } from '../../storage';

/**
 * Get the organization ID for a facility
 */
export async function getFacilityOrganization(req: Request, res: Response) {
  try {
    const facilityId = Number(req.params.facilityId);
    
    if (isNaN(facilityId)) {
      return res.status(400).json({ message: 'Invalid facility ID' });
    }
    
    const storage = await getStorage();
    const facility = await storage.getFacility(facilityId);
    
    if (!facility) {
      return res.status(404).json({ message: 'Facility not found' });
    }
    
    // Return the organization ID for this facility
    res.json({ 
      organizationId: facility.tenantId 
    });
  } catch (error) {
    console.error('Error getting organization for facility:', error);
    res.status(500).json({ message: 'Failed to get organization for facility' });
  }
}

export default {
  initialize: (app: express.Express) => {
    console.log('Initializing Organizations module...');
    
    // Set up API routes for organization holidays
    app.get('/api/organizations/:organizationId/holidays', getOrganizationHolidays);
    app.post('/api/organizations/:organizationId/holidays', updateOrganizationHolidays);
    
    // Facility organization lookup - used for holiday checking
    app.get('/api/facilities/:facilityId/organization', getFacilityOrganization);
    
    console.log('Organizations module loaded successfully');
  }
};