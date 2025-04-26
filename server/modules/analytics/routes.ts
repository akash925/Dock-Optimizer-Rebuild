import express from 'express';
import * as controllers from './controllers';

// Add authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Create router for analytics module
const router = express.Router();

// Analytics routes
router.get('/heatmap', controllers.getHeatmapData);
router.get('/facilities', controllers.getFacilityStats);
router.get('/carriers', controllers.getCarrierStats);
router.get('/customers', controllers.getCustomerStats);
router.get('/attendance', controllers.getAttendanceStats);

export default router;