import routes, { assetManagerRouter, setupStaticFileServing } from './routes';
import express from 'express';

export function initializeAssetManagerModule(app: express.Express): void {
  // Register legacy routes at /api
  app.use('/api', routes);

  // Mount the new asset manager routes at /api/asset-manager
  app.use('/api/asset-manager', assetManagerRouter);

  // Setup static file serving
  setupStaticFileServing(app);

  console.log('Asset Manager module loaded successfully');
}

export default {
  name: 'assetManager',
  initialize: initializeAssetManagerModule
};