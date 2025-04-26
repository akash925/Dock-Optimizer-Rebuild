import express from 'express';
import * as controllers from './controllers';

// Add authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Middleware to disable caching for analytics endpoints
const disableCache = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};

// Create router for analytics module
const router = express.Router();

// Apply cache disabling middleware to all routes
router.use(disableCache);

// Analytics routes
router.get('/heatmap', controllers.getHeatmapData);
router.get('/facilities', controllers.getFacilityStats);
router.get('/carriers', controllers.getCarrierStats);
router.get('/customers', controllers.getCustomerStats);
router.get('/attendance', controllers.getAttendanceStats);
router.get('/dock-utilization', controllers.getDockUtilizationStats);

export default router;