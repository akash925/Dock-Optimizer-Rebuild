import express from 'express';
import * as controllers from './index';
import { getStorage } from '../../storage';
import { generateConfirmationCode } from '../../utils';

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

// Add missing booking endpoints
// POST /api/booking-pages/book/:slug
router.post('/booking-pages/book/:slug', async (req: any, res) => {
  try {
    const { slug } = req.params;
    const storage = await getStorage();
    
    // Get booking page to validate and get tenant context
    const bookingPage = await storage.getBookingPageBySlug(slug);
    if (!bookingPage) {
      return res.status(404).json({ message: 'Booking page not found' });
    }
    
    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();
    
    // Add confirmation code to request data
    const appointmentData = {
      ...req.body,
      confirmationCode,
      tenantId: bookingPage.tenantId,
      status: 'scheduled',
      createdVia: 'external'
    };
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    res.json({
      schedule: appointment,
      confirmationCode,
      success: true
    });
  } catch (error) {
    console.error('Error creating booking page appointment:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// POST /api/schedules/external 
router.post('/schedules/external', async (req: any, res) => {
  try {
    const storage = await getStorage();
    
    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();
    
    // Add confirmation code to request data
    const appointmentData = {
      ...req.body,
      confirmationCode,
      status: 'scheduled',
      createdVia: 'external'
    };
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    res.json({
      schedule: appointment,
      confirmationCode,
      success: true
    });
  } catch (error) {
    console.error('Error creating external appointment:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// Create router for new calendar module
const calendarRouter = express.Router();

// New routes at /api/calendar/...
calendarRouter.get('/schedules', isAuthenticated, controllers.getSchedules);
calendarRouter.get('/schedules/:id', isAuthenticated, controllers.getScheduleById);

export { calendarRouter };
export default router;