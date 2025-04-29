import { Express } from 'express';
import { modulesRouter } from './routes';

const initialize = (app: Express) => {
  console.log('Initializing Modules service...');
  
  // Register the modules router under /api/modules
  app.use('/api/modules', modulesRouter);
  
  console.log('Modules service initialized successfully');
};

export default {
  initialize
};