import express from 'express';
import * as controllers from './index';

// Add authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Create router for legacy routes
const router = express.Router();

// Schedules routes for legacy API
router.get('/schedules', isAuthenticated, controllers.getSchedules);
router.get('/schedules/:id', isAuthenticated, controllers.getScheduleById);

// Create router for new calendar module
const calendarRouter = express.Router();

// New routes at /api/calendar/...
calendarRouter.get('/schedules', isAuthenticated, controllers.getSchedules);
calendarRouter.get('/schedules/:id', isAuthenticated, controllers.getScheduleById);

export { calendarRouter };
export default router;