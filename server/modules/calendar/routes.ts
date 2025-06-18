import express from 'express';
import * as controllers from './index';
import { getStorage } from '../../storage';

// Generate confirmation code function
function generateConfirmationCode(): string {
  const prefix = 'HZL';
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${prefix}-${timestamp}${random}`;
}

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
    
    console.log('[BookingRoute] Received form data:', JSON.stringify(req.body, null, 2));
    
    // Extract and map form data with proper defaults for required fields
    const {
      facilityId,
      appointmentTypeId,
      customFields = {},
      // Date and time
      date,
      time,
      startTime,
      endTime,
      // Add fallbacks for any other potential field names
      customerName,
      contactName,
      email,
      phone,
      carrierName,
      driverName,
      driverPhone,
      driverEmail,
      truckNumber,
      trailerNumber,
      mcNumber,
      poNumber,
      bolNumber,
      notes
    } = req.body;
    
    // Handle different ways the form data might be structured
    const extractedCustomerName = customerName || customFields?.customerName || contactName || customFields?.contactName || 'External Customer';
    const extractedEmail = email || customFields?.email || driverEmail || customFields?.driverEmail || customFields?.contactEmail || '';
    const extractedPhone = phone || customFields?.phone || driverPhone || customFields?.driverPhone || customFields?.contactPhone || '';
    const extractedCarrierName = carrierName || customFields?.carrierName || 'External Carrier';
    const extractedDriverName = driverName || customFields?.driverName || extractedCustomerName;
    const extractedTruckNumber = truckNumber || customFields?.truckNumber || 'TRUCK-' + Math.floor(Math.random() * 10000);
    const extractedTrailerNumber = trailerNumber || customFields?.trailerNumber || '';
    const extractedMcNumber = mcNumber || customFields?.mcNumber || '';
    const extractedPoNumber = poNumber || customFields?.poNumber || '';
    const extractedBolNumber = bolNumber || customFields?.bolNumber || '';
    const extractedNotes = notes || customFields?.notes || '';
    
    // Parse date and time
    let appointmentStartTime: Date;
    let appointmentEndTime: Date;
    
    if (startTime && endTime) {
      appointmentStartTime = new Date(startTime);
      appointmentEndTime = new Date(endTime);
    } else if (date && time) {
      // Combine date and time strings
      const dateTimeStr = `${date}T${time}:00`;
      appointmentStartTime = new Date(dateTimeStr);
      appointmentEndTime = new Date(appointmentStartTime.getTime() + (60 * 60 * 1000)); // Default 1 hour duration
    } else {
      return res.status(400).json({ message: 'Date and time are required' });
    }
    
    // Create appointment data with all required fields
    const appointmentData = {
      // Required core fields
      facilityId: parseInt(facilityId),
      appointmentTypeId: parseInt(appointmentTypeId),
      truckNumber: extractedTruckNumber, // Required field
      customerName: extractedCustomerName,
      driverName: extractedDriverName,
      carrierName: extractedCarrierName,
      
      // Time fields
      startTime: appointmentStartTime,
      endTime: appointmentEndTime,
      
      // Contact information
      driverEmail: extractedEmail,
      driverPhone: extractedPhone,
      creatorEmail: extractedEmail,
      
      // Additional fields
      trailerNumber: extractedTrailerNumber,
      mcNumber: extractedMcNumber,
      poNumber: extractedPoNumber,
      bolNumber: extractedBolNumber,
      notes: extractedNotes,
      
      // Appointment metadata
      confirmationCode,
      tenantId: bookingPage.tenantId,
      status: 'scheduled',
      type: 'inbound', // Default type
      appointmentMode: 'trailer', // Default mode
      createdVia: 'external',
      createdBy: 1, // Default system user
      
      // Store custom form data
      customFormData: customFields
    };
    
    console.log('[BookingRoute] Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    console.log('[BookingRoute] Appointment created successfully:', appointment.id);
    
    res.json({
      schedule: appointment,
      confirmationCode,
      success: true,
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error('Error creating booking page appointment:', error);
    res.status(500).json({ 
      message: 'Failed to create appointment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/schedules/external 
router.post('/schedules/external', async (req: any, res) => {
  try {
    const storage = await getStorage();
    
    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();
    
    console.log('[ExternalScheduleRoute] Received form data:', JSON.stringify(req.body, null, 2));
    
    // Extract form data with defaults for required fields
    const {
      facilityId,
      appointmentTypeId,
      customFields = {},
      customerName,
      contactName,
      email,
      carrierName,
      driverName,
      truckNumber,
      startTime,
      endTime,
      ...otherFields
    } = req.body;
    
    // Provide defaults for required fields
    const extractedCustomerName = customerName || customFields?.customerName || contactName || 'External Customer';
    const extractedTruckNumber = truckNumber || customFields?.truckNumber || 'TRUCK-' + Math.floor(Math.random() * 10000);
    const extractedDriverName = driverName || customFields?.driverName || extractedCustomerName;
    const extractedCarrierName = carrierName || customFields?.carrierName || 'External Carrier';
    
    // Create appointment data with required fields
    const appointmentData = {
      ...otherFields,
      facilityId: parseInt(facilityId) || null,
      appointmentTypeId: parseInt(appointmentTypeId) || null,
      truckNumber: extractedTruckNumber,
      customerName: extractedCustomerName,
      driverName: extractedDriverName,
      carrierName: extractedCarrierName,
      confirmationCode,
      status: 'scheduled',
      type: 'inbound',
      appointmentMode: 'trailer',
      createdVia: 'external',
      createdBy: 1,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(Date.now() + 60 * 60 * 1000),
      customFormData: customFields
    };
    
    console.log('[ExternalScheduleRoute] Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    res.json({
      schedule: appointment,
      confirmationCode,
      success: true
    });
  } catch (error) {
    console.error('Error creating external appointment:', error);
    res.status(500).json({ 
      message: 'Failed to create appointment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create router for new calendar module
const calendarRouter = express.Router();

// New routes at /api/calendar/...
calendarRouter.get('/schedules', isAuthenticated, controllers.getSchedules);
calendarRouter.get('/schedules/:id', isAuthenticated, controllers.getScheduleById);

export { calendarRouter };
export default router;