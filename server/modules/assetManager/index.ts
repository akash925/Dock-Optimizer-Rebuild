import routes, { setupStaticFileServing } from './routes';
import express from 'express';

export function initializeAssetManagerModule(app: express.Express): void {
  // Register routes
  app.use('/api', routes);

  // Setup static file serving
  setupStaticFileServing(app);

  console.log('Asset Manager module loaded successfully');
}

export default {
  name: 'assetManager',
  initialize: initializeAssetManagerModule
};