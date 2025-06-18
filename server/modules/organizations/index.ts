import express, { Request, Response, Express } from 'express';
import { getOrganizationHolidays, updateOrganizationHolidays, syncOrganizationHolidays } from './holidays';
import { getStorage } from '../../storage';
import { 
  getCurrentOrganization, 
  updateCurrentOrganization, 
  getDefaultHours, 
  updateDefaultHours,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getOrganizationModules,
  updateOrganizationModule,
  getOrganizationSettings,
  updateOrganizationSettings
} from './controllers';
import { isAuthenticated } from '../../middleware/auth';

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
    
    // First try using the getOrganizationByFacilityId method which uses the junction table
    const organization = await storage.getOrganizationByFacilityId(facilityId);
    
    if (organization) {
      console.log(`Found organization ${organization.id} (${organization.name}) for facility ${facilityId}`);
      return res.json({ 
        organizationId: organization.id,
        organizationName: organization.name
      });
    }
    
    // Fallback to using getFacility
    const facility = await storage.getFacility(facilityId);
    
    if (!facility) {
      console.log(`No facility found with ID ${facilityId}`);
      return res.status(404).json({ message: 'Facility not found' });
    }
    
    if (!facility.tenantId) {
      console.log(`Facility ${facilityId} has no associated organization`);
      return res.json({ message: 'No organization associated with this facility' });
    }
    
    // Return the organization ID for this facility
    console.log(`Using facility.tenantId (${facility.tenantId}) for facility ${facilityId}`);
    return res.json({ 
      organizationId: facility.tenantId 
    });
  } catch (error) {
    console.error('Error getting organization for facility:', error);
    res.status(500).json({ message: 'Failed to get organization for facility' });
  }
}

export const registerOrganizationsRoutes = (app: Express) => {
  // Apply authentication middleware to all organization routes
  app.use('/api/organizations', isAuthenticated);
  
  // Organization info routes
  app.get('/api/organizations/current', getCurrentOrganization);
  app.put('/api/organizations/current', updateCurrentOrganization);
  
  // Organization settings routes
  app.get('/api/organizations/settings', getOrganizationSettings);
  app.put('/api/organizations/settings', updateOrganizationSettings);
  
  // Default hours routes
  app.get('/api/organizations/default-hours', getDefaultHours);
  app.put('/api/organizations/default-hours/:dayOfWeek', updateDefaultHours);
  
  // Holidays routes
  app.get('/api/organizations/holidays', getHolidays);
  app.post('/api/organizations/holidays', createHoliday);
  app.put('/api/organizations/holidays/:id', updateHoliday);
  app.delete('/api/organizations/holidays/:id', deleteHoliday);
  
  // Modules routes
  app.get('/api/organizations/modules', getOrganizationModules);
  app.put('/api/organizations/modules', updateOrganizationModule);
  
  console.log('✅ Organizations module routes registered');
};

export default {
  initialize: (app: express.Express) => {
    console.log('Initializing Organizations module...');
    
    // Set up API routes for organization holidays
    app.get('/api/organizations/:organizationId/holidays', getOrganizationHolidays);
    app.post('/api/organizations/:organizationId/holidays', updateOrganizationHolidays);
    app.post('/api/organizations/:organizationId/holidays/sync', syncOrganizationHolidays);
    
    // Facility organization lookup - used for holiday checking
    app.get('/api/facilities/:facilityId/organization', getFacilityOrganization);
    
    // Register additional routes
    registerOrganizationsRoutes(app);
    
    console.log('Organizations module loaded successfully');
  }
};