import routes, { companyAssetsRouter, setupStaticFileServing } from './routes';
import express from 'express';

export function initializeCompanyAssetsModule(app: express.Express): void {
  // Register legacy routes at /api
  app.use('/api', routes);

  // Mount the company assets routes at /api/company-assets
  app.use('/api/company-assets', companyAssetsRouter);

  // Setup static file serving
  setupStaticFileServing(app);

  console.log('Company Assets module loaded successfully');
}

export default {
  name: 'companyAssets',
  initialize: initializeCompanyAssetsModule
};