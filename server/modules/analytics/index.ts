import express from 'express';
import analyticsRoutes from './routes/index.js';

// Export all controllers for use in the routes file
export * from './controllers';

// Initialize the analytics module
export function initializeAnalyticsModule(app: express.Express): void {
  // Mount the analytics routes at /api/analytics
  app.use('/api/analytics', analyticsRoutes);
  console.log('Analytics module loaded successfully');
}

// Export default object for dynamic loading
export default {
  name: 'analytics',
  initialize: initializeAnalyticsModule
};