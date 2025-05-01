import express from 'express';
import { getOrganizationHolidays, updateOrganizationHolidays } from './holidays';

export default {
  initialize: (app: express.Express) => {
    console.log('Initializing Organizations module...');
    
    // Set up API routes for organization holidays
    app.get('/api/organizations/:organizationId/holidays', getOrganizationHolidays);
    app.post('/api/organizations/:organizationId/holidays', updateOrganizationHolidays);
    
    console.log('Organizations module loaded successfully');
  }
};