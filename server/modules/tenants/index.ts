import { Express } from 'express';
import tenantRoutes from './routes.js.js';

export default {
  name: 'tenants',
  initialize: (app: Express) => {
    console.log('Initializing Tenants module...');
    
    // Register routes
    app.use('/api/tenants', tenantRoutes);
    
    console.log('Tenants module loaded successfully');
    return true;
  }
};