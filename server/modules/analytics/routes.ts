import express from 'express';
import * as controllers from './controllers.js';
import { isAuthenticated } from '../../middleware/auth.js';

// Middleware to disable caching for analytics endpoints
const disableCache = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};

// Add debug middleware to log auth status
const debugAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[Analytics] Authentication check: isAuthenticated=${req.isAuthenticated()}, user=${req.user ? JSON.stringify(req.user) : 'undefined'}`);
  next();
};

// Create router for analytics module
const router = express.Router();

// Apply cache disabling middleware to all routes
router.use(disableCache);

// Apply debug middleware first
router.use(debugAuth);

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Analytics routes
router.get('/heatmap', controllers.getHeatmapData);
router.get('/facilities', controllers.getFacilityStats);
router.get('/carriers', controllers.getCarrierStats);
router.get('/customers', controllers.getCustomerStats);
router.get('/attendance', controllers.getAttendanceStats);
router.get('/dock-utilization', controllers.getDockUtilizationStats);

export default router;