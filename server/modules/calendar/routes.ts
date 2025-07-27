import express from 'express';
import * as controllers from './index.js';
import { getStorage } from '../../storage';
import { generateConfirmationCode, getOrganizationConfirmationPrefix } from '../../utils';

// Generate confirmation code with organization prefix
async function generateOrgConfirmationCode(tenantId?: number): Promise<string> {
  if (tenantId) {
    const prefix = await getOrganizationConfirmationPrefix(tenantId);
    return generateConfirmationCode(prefix);
  }
  return generateConfirmationCode('APP'); // Fallback
}

// Add authentication middleware with proper typing
import { Request, Response, NextFunction } from 'express';
// import { AuthenticatedRequest } from '../../middleware/auth';

const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
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
router.post('/booking-pages/book/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const storage = await getStorage();
    
    // Get user timezone from headers or use facility timezone as fallback
    const userTimeZone = req.headers['x-user-timezone'] as string;
    console.log('[BookingRoute] User timezone from header:', userTimeZone);
    
    // Get booking page to validate and get tenant context
    const bookingPage = await storage.getBookingPageBySlug(slug);
    if (!bookingPage) {
      return res.status(404).json({ message: 'Booking page not found' });
    }
    
    // Generate organization-specific confirmation code
    const confirmationCode = await generateOrgConfirmationCode(bookingPage.tenantId || undefined);
    
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
    const extractedTruckNumber = truckNumber || customFields?.truckNumber || ''; // Don't generate fake truck numbers  
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
      // Get facility timezone for proper time conversion
      const facility = await storage.getFacility(parseInt(facilityId));
      const facilityTimezone = facility?.timezone || 'America/New_York';
      
      console.log(`[BookingRoute] Converting appointment time from facility timezone: ${facilityTimezone}`);
      console.log(`[BookingRoute] Original date: ${date}, time: ${time}`);
      
      // Import timezone utility for consistent conversion
      const { convertAppointmentTimeToUTC } = await import('@shared/timezone-utils');
      
      // Convert appointment time from facility timezone to UTC for storage
      appointmentStartTime = convertAppointmentTimeToUTC(date, time, facilityTimezone);
      
      // Get the appointment type to determine the correct duration
      const appointmentType = await storage.getAppointmentType(parseInt(appointmentTypeId));
      const durationMinutes = appointmentType?.duration || 60; // Default to 60 minutes if not found
      
      console.log(`[BookingRoute] Using appointment type "${appointmentType?.name}" with duration ${durationMinutes} minutes`);
      
      // Calculate end time based on appointment type duration
      appointmentEndTime = new Date(appointmentStartTime.getTime() + (durationMinutes * 60 * 1000));
      
      console.log(`[BookingRoute] Final appointment times: ${appointmentStartTime.toISOString()} to ${appointmentEndTime.toISOString()}`);
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
    
    console.log('🔍 [BookingRoute] Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
    console.log('🔍 [BookingRoute] Standard Questions Data in customFormData:', JSON.stringify(customFields, null, 2));
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    console.log('[BookingRoute] Appointment created successfully:', appointment.id);
    
    // 🔥 REAL-TIME: Emit event for real-time notifications
    try {
      // Import the event system
      const { eventSystem } = await import('../../services/enhanced-event-system');
      
      // Create enhanced schedule object for the event
      const facility = await storage.getFacility(parseInt(facilityId));
      const appointmentType = await storage.getAppointmentType(parseInt(appointmentTypeId));
      
      const enhancedSchedule = {
        ...appointment,
        facilityName: facility?.name || 'Main Facility',
        appointmentTypeName: appointmentType?.name || 'Standard Appointment',
        dockName: 'Not assigned',
        timezone: facility?.timezone || 'America/New_York',
        userTimeZone: userTimeZone || facility?.timezone || 'America/New_York',
        confirmationCode: confirmationCode,
        creatorEmail: extractedEmail,
        bolFileUploaded: false
      };
      
      // Emit schedule created event
      eventSystem.emit('schedule:created', {
        schedule: enhancedSchedule as any,
        tenantId: (appointmentData as any).tenantId || 1
      });
      
      // Also emit appointment confirmed event for notifications
      eventSystem.emit('appointment:confirmed', {
        schedule: enhancedSchedule as any,
        confirmationCode: confirmationCode,
        tenantId: (appointmentData as any).tenantId || 1
      });
      
      console.log('[BookingRoute] Real-time events emitted successfully');
    } catch (eventError) {
      console.error('[BookingRoute] Error emitting real-time events:', eventError);
      // Don't fail the request if events fail
    }
    
    // 🔥 CRITICAL FIX: Send confirmation email after appointment creation
    let emailSent = false;
    try {
      if (extractedEmail) {
        console.log('[BookingRoute] Sending confirmation email to:', extractedEmail);
        
        // Get facility and appointment type details for email
        const facility = await storage.getFacility(parseInt(facilityId));
        const appointmentType = await storage.getAppointmentType(parseInt(appointmentTypeId));
        
        // Create enhanced schedule object for email
        const enhancedSchedule = {
          ...appointment,
          facilityName: facility?.name || 'Main Facility',
          appointmentTypeName: appointmentType?.name || 'Standard Appointment',
          dockName: 'Not assigned',
          timezone: facility?.timezone || 'America/New_York',
          userTimeZone: userTimeZone || facility?.timezone || 'America/New_York',
          confirmationCode: confirmationCode,
          creatorEmail: extractedEmail,
          bolFileUploaded: false
        };
        
        // Import email notification function dynamically to avoid circular imports
        const { sendConfirmationEmail } = await import('../../notifications');
        
        // Send the confirmation email
        const emailResult = await sendConfirmationEmail(
          extractedEmail,
          confirmationCode,
          enhancedSchedule as any // Type assertion for EnhancedSchedule compatibility
        );
        
        if (emailResult) {
          console.log('[BookingRoute] Confirmation email sent successfully');
          emailSent = true;
        } else {
          console.log('[BookingRoute] Confirmation email failed to send');
          emailSent = false;
        }
      } else {
        console.log('[BookingRoute] No email provided - skipping confirmation email');
        emailSent = false;
      }
    } catch (emailError) {
      console.error('[BookingRoute] Error sending confirmation email:', emailError);
      // Don't fail the entire request if email fails
      emailSent = false;
    }
    
    res.json({
      schedule: appointment,
      confirmationCode,
      success: true,
      message: 'Appointment created successfully',
      emailSent: emailSent
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
router.post('/schedules/external', async (req: any, res: any) => {
  try {
    const storage = await getStorage();
    
    // Get user timezone from headers
    const userTimeZone = req.headers['x-user-timezone'] as string;
    console.log('[ExternalScheduleRoute] User timezone from header:', userTimeZone);
    
    // Generate confirmation code (fallback for external bookings without tenant context)
    const confirmationCode = await generateOrgConfirmationCode();
    
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
    const extractedTruckNumber = truckNumber || customFields?.truckNumber || ''; // Don't generate fake truck numbers
    const extractedDriverName = driverName || customFields?.driverName || extractedCustomerName;
    const extractedCarrierName = carrierName || customFields?.carrierName || 'External Carrier';
    
    // Calculate proper end time if not provided
    let finalEndTime = endTime ? new Date(endTime) : null;
    const finalStartTime = startTime ? new Date(startTime) : new Date();
    
    if (!finalEndTime && appointmentTypeId) {
      // Get the appointment type to determine the correct duration
      const appointmentType = await storage.getAppointmentType(parseInt(appointmentTypeId));
      const durationMinutes = appointmentType?.duration || 60; // Default to 60 minutes if not found
      
      console.log(`[ExternalScheduleRoute] Using appointment type "${appointmentType?.name}" with duration ${durationMinutes} minutes`);
      
      // Calculate end time based on appointment type duration
      finalEndTime = new Date(finalStartTime.getTime() + (durationMinutes * 60 * 1000));
    } else if (!finalEndTime) {
      // Fallback to 1 hour if no appointment type
      finalEndTime = new Date(finalStartTime.getTime() + 60 * 60 * 1000);
    }
    
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
      startTime: finalStartTime,
      endTime: finalEndTime,
      customFormData: customFields
    };
    
    console.log('[ExternalScheduleRoute] Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
    
    // Create the appointment
    const appointment = await storage.createSchedule(appointmentData);
    
    // 🔥 REAL-TIME: Emit event for real-time notifications
    try {
      // Import the event system
      const { eventSystem } = await import('../../services/enhanced-event-system');
      
      // Create enhanced schedule object for the event
      const facility = await storage.getFacility(parseInt(facilityId) || 1);
      const appointmentType = await storage.getAppointmentType(parseInt(appointmentTypeId) || 1);
      
      const enhancedSchedule = {
        ...appointment,
        facilityName: facility?.name || 'Main Facility',
        appointmentTypeName: appointmentType?.name || 'Standard Appointment',
        dockName: 'Not assigned',
        timezone: facility?.timezone || 'America/New_York',
        userTimeZone: userTimeZone || facility?.timezone || 'America/New_York',
        confirmationCode: confirmationCode,
        creatorEmail: email || extractedCustomerName,
        bolFileUploaded: false
      };
      
      // Emit schedule created event
      eventSystem.emit('schedule:created', {
        schedule: enhancedSchedule as any,
        tenantId: appointment.tenantId || 1
      });
      
      // Also emit appointment:created event for notifications
      eventSystem.emit('appointment:created', {
        schedule: enhancedSchedule as any,
        tenantId: appointment.tenantId || 1
      });
      
      console.log('[ExternalScheduleRoute] Real-time events emitted successfully');
    } catch (eventError) {
      console.error('[ExternalScheduleRoute] Error emitting real-time events:', eventError);
      // Don't fail the request if events fail
    }
    
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