import { Express } from 'express';
import { adminRoutes } from './routes.js.js';

export default {
  name: 'admin',
  initialize: (app: Express) => {
    console.log('Initializing Admin module...');
    
    // Register admin routes
    adminRoutes(app);
    
    console.log('Admin module loaded successfully');
    return true;
  }
}; 