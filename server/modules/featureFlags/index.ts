import { Express } from 'express';
import featureFlagRoutes from './routes/index.js';

export default {
  name: 'featureFlags',
  initialize: (app: Express) => {
    console.log('Initializing Feature Flags module...');
    
    // Register routes
    app.use('/api/feature-flags', featureFlagRoutes);
    
    console.log('Feature Flags module loaded successfully');
    return true;
  }
};