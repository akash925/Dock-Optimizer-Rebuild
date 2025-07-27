import { Express } from 'express';
import settingsRoutes from './routes.js.js';

export default {
  name: 'admin-settings',
  initialize: (app: Express) => {
    console.log('Initializing Admin Settings module...');
    
    // Register routes
    app.use('/api/admin/settings', settingsRoutes);
    
    console.log('Admin Settings module loaded successfully');
    return true;
  }
};