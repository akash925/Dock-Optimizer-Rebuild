import routes, { companyAssetsRouter, setupStaticFileServing } from './routes.js.js';
import express from 'express';

export function initializeCompanyAssetsModule(app: express.Express): void {
  // Register legacy routes at /api - DISABLED to resolve route conflicts
  // app.use('/api', routes);

  // Mount the company assets routes at /api/company-assets - SINGLE SOURCE OF TRUTH
  app.use('/api/company-assets', companyAssetsRouter);

  // Setup static file serving
  setupStaticFileServing(app);

  console.log('Company Assets module loaded successfully - legacy routes disabled');
}

export default {
  name: 'companyAssets',
  initialize: initializeCompanyAssetsModule
};