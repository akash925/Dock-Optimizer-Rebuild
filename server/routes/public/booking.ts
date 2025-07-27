import { Router, Request, Response } from "express";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";
import { bookingPages, facilities, appointmentTypes, standardQuestions } from "@shared/schema";
import { safeToString } from "@/lib/utils"; 

const router = Router();

// GET /api/booking-pages/slug/:slug
router.get("/booking-pages/slug/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    // Query the basic booking page data
    const page = await (db.query as any).bookingPages.findFirst({
      where: eq(bookingPages.slug, slug),
    });

    if (!page) return res.status(404).json({ message: "Booking page not found" });

    // Parse the facilities from JSON if present
    let facilityIds: number[] = [];
    if (page.facilities) {
      try {
        // If it's already an array, use it as is, otherwise parse it
        facilityIds = Array.isArray(page.facilities) ? page.facilities : JSON.parse(String(page.facilities));
      } catch (err) {
        console.error("Error parsing facilities JSON:", err);
      }
    }
    
    // Fetch the complete facility data for the facility IDs through organization_facilities mapping
    let facilityList: any[] = [];
    if (facilityIds.length > 0) {
      try {
        const query = `
          SELECT f.*
          FROM facilities f
          JOIN organization_facilities of ON f.id = of.facility_id
          WHERE f.id IN (${facilityIds.join(',')})
        `;
        
        const { rows } = await db.execute(query);
        facilityList = rows || [];
        console.log(`Loaded ${facilityList.length} facilities for booking page ${slug}`);
      } catch (err) {
        console.error("Error fetching facility data:", err);
      }
    }

    // Parse the excluded appointment types from JSON if present
    let excludedAppointmentTypeIds: number[] = [];
    if (page.excludedAppointmentTypes) {
      try {
        // If it's already an array, use it as is, otherwise parse it
        excludedAppointmentTypeIds = Array.isArray(page.excludedAppointmentTypes) 
          ? page.excludedAppointmentTypes 
          : JSON.parse(String(page.excludedAppointmentTypes));
      } catch (err) {
        console.error("Error parsing excludedAppointmentTypes JSON:", err);
      }
    }

    // Fetch appointment types for the tenant and filter out excluded ones
    let appointmentTypesList: any[] = [];
    try {
      if (facilityIds.length > 0) {
        // Get appointment types for the facilities included in this booking page
        const query = `
          SELECT 
            at.*,
            at.facility_id as "facilityId"
          FROM appointment_types at
          JOIN facilities f ON at.facility_id = f.id
          WHERE f.id IN (${facilityIds.join(',')})
        `;
        
        const { rows } = await db.execute(query);
        appointmentTypesList = rows || [];
        
        console.log(`Found ${appointmentTypesList.length} appointment types for facilities ${facilityIds.join(', ')}`);
        
        // Filter out excluded appointment types if any
        if (excludedAppointmentTypeIds.length > 0) {
          appointmentTypesList = appointmentTypesList.filter((type: any) => 
            !excludedAppointmentTypeIds.includes(type.id)
          );
          console.log(`After filtering excluded types, ${appointmentTypesList.length} appointment types remain`);
        }
      }
    } catch (err) {
      console.error("Error fetching appointment types:", err);
    }

    // Create the sanitized response
    const sanitized = {
      ...page,
      id: safeToString(page.id),
      facilities: facilityList,
      appointmentTypes: appointmentTypesList,
      excludedAppointmentTypes: excludedAppointmentTypeIds,
      tenantId: safeToString(page.tenantId),
    };

    res.json(sanitized);
  } catch (err) {
    console.error("Error fetching booking page by slug:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/booking-pages/standard-questions/appointment-type/:appointmentTypeId
router.get("/booking-pages/standard-questions/appointment-type/:appointmentTypeId", async (req: Request, res: Response) => {
  const { appointmentTypeId } = req.params;
  
  try {
    const appointmentTypeIdNum = parseInt(appointmentTypeId, 10);
    
    if (isNaN(appointmentTypeIdNum)) {
      return res.status(400).json({ message: "Invalid appointment type ID" });
    }
    
    // Query the standard questions for the appointment type using Drizzle
    const questions = await db
      .select()
      .from(standardQuestions)
      .where(eq(standardQuestions.appointmentTypeId, appointmentTypeIdNum))
      .orderBy(standardQuestions.orderPosition, standardQuestions.id);
    
    // Process the results to ensure consistent format
    const processedQuestions = questions.map((row: any) => ({
      id: row.id,
      label: row.label || '',
      fieldKey: row.fieldKey || `field_${row.id}`,
      fieldType: row.fieldType || 'TEXT',
      required: row.required || false,
      included: row.included || false,
      orderPosition: row.orderPosition || 0,
      appointmentTypeId: row.appointmentTypeId,
      options: row.options || []
    }));
    
    console.log(`Found ${processedQuestions.length} standard questions for appointment type ${appointmentTypeIdNum}`);
    
    res.json(processedQuestions);
  } catch (err) {
    console.error("Error fetching standard questions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/booking-pages/:slug/book - Create a new booking
router.post("/booking-pages/:slug/book", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const bookingData = req.body;
  
  if (!bookingData) {
    return res.status(400).json({ error: "Booking data is required" });
  }
  
  try {
    console.log(`[BookingSubmission] Processing booking for page ${slug}:`, bookingData);
    
    // Get the booking page to verify it exists and is active
    const bookingPage = await (db.query as any).bookingPages.findFirst({
      where: eq(bookingPages.slug, slug),
    });
    
    if (!bookingPage) {
      return res.status(404).json({ error: "Booking page not found" });
    }
    
    if (!bookingPage.isActive) {
      return res.status(400).json({ error: "Booking page is not active" });
    }
    
    // Import storage to create the appointment
    const { getStorage } = await import("../../storage");
    const storage = await getStorage();
    
    // Get facility timezone for proper time conversion
    const facility = await storage.getFacility(bookingData.facilityId);
    const facilityTimezone = facility?.timezone || 'America/New_York';
    
    console.log(`[BookingSubmission] Converting appointment time from facility timezone: ${facilityTimezone}`);
    console.log(`[BookingSubmission] Original date: ${bookingData.date}, time: ${bookingData.time}`);
    
    // Import timezone utility for proper conversion
    const { convertAppointmentTimeToUTC } = await import('../../../shared/timezone-service');
    
    // Convert appointment time from facility timezone to UTC for storage
    const appointmentStartTime = convertAppointmentTimeToUTC(bookingData.date, bookingData.time, facilityTimezone);
    
    // Get the appointment type to determine the correct duration
    const appointmentType = await storage.getAppointmentType(bookingData.appointmentTypeId);
    const durationMinutes = appointmentType?.duration || 60; // Default to 60 minutes if not found
    
    console.log(`[BookingSubmission] Using appointment type "${appointmentType?.name}" with duration ${durationMinutes} minutes`);
    
    // Calculate end time based on appointment type duration
    const appointmentEndTime = new Date(appointmentStartTime.getTime() + (durationMinutes * 60 * 1000));
    
    console.log(`[BookingSubmission] Final appointment times: ${appointmentStartTime.toISOString()} to ${appointmentEndTime.toISOString()}`);
    
    // Create the appointment using the booking data with proper type and appointment settings
    const appointment = await storage.createSchedule({
      facilityId: bookingData.facilityId,
      appointmentTypeId: bookingData.appointmentTypeId,
      startTime: appointmentStartTime,
      endTime: appointmentEndTime,
      status: 'scheduled',
      type: 'inbound', // Set proper appointment type
      driverName: bookingData.driverName,
      driverPhone: bookingData.driverPhone,
      driverEmail: bookingData.driverEmail,
      truckNumber: bookingData.truckNumber || null,
      trailerNumber: bookingData.trailerNumber || null,
      bolNumber: bookingData.bolNumber || null,
      palletCount: bookingData.palletCount ? parseInt(bookingData.palletCount) : null,
      weight: bookingData.weight || null,
      notes: bookingData.notes || null,
      carrierName: bookingData.carrierName || null,
      customerName: bookingData.customerName || null,
      tenantId: bookingPage.tenantId,
      customFormData: JSON.stringify(bookingData),
      bolDocumentPath: bookingData.bolDocumentPath || null,
      parsedOcrText: bookingData.parsedOcrText || null,
      confirmationCode: `${bookingPage.slug.toUpperCase()}-${Date.now().toString().slice(-6)}`
    } as any);
    
    console.log(`[BookingSubmission] Created appointment ${appointment.id} with confirmation code ${appointment.confirmationCode}`);
    
    // FIXED: Use Enhanced Event System for proper notifications and WebSocket broadcasting
    try {
      const { eventSystem } = await import("../../services/enhanced-event-system");
      
      // Create enhanced schedule object for the event system  
      const enhancedSchedule = {
        ...appointment,
        facilityName: facility?.name || 'Unknown Facility',
        appointmentTypeName: appointmentType?.name || 'Standard Appointment',
        dockName: 'Not assigned',
        timezone: facilityTimezone,
        userTimeZone: facilityTimezone,
        confirmationCode: appointment.confirmationCode,
        creatorEmail: bookingData.driverEmail,
        bolFileUploaded: false
      };
      // @ts-expect-error: EnhancedSchedule requires all properties but we use partial for event emission
      const typedSchedule: EnhancedSchedule = enhancedSchedule;
      
      // Emit appointment:created event - this will automatically:
      // 1. Create notifications in the database
      // 2. Send WebSocket broadcasts to all connected clients 
      // 3. Update the notification bell for all users
      eventSystem.emit('appointment:created', {
        // @ts-expect-error: EnhancedSchedule partial object for event emission
        schedule: enhancedSchedule,
        tenantId: bookingPage.tenantId
      });
      
      console.log(`[BookingSubmission] Enhanced event system notification sent for appointment ${appointment.id}`);
    } catch (eventError) {
      console.error("[BookingSubmission] Enhanced event system failed:", eventError);
      
      // Fallback to direct WebSocket broadcast if event system fails
      try {
        const { broadcastToTenant } = await import("../../websocket");
        // @ts-expect-error: broadcastToTenant signature mismatch
        await broadcastToTenant(bookingPage.tenantId, {
          type: 'appointment_created',
          data: {
            id: appointment.id,
            confirmationCode: appointment.confirmationCode,
            startTime: appointment.startTime,
            facilityId: appointment.facilityId,
            appointmentTypeId: appointment.appointmentTypeId,
            driverName: appointment.driverName,
            message: `New appointment scheduled: ${appointment.confirmationCode}`
          }
        });
        console.log(`[BookingSubmission] Fallback WebSocket notification sent for appointment ${appointment.id}`);
      } catch (wsError) {
        console.error("[BookingSubmission] Both event system and WebSocket fallback failed:", wsError);
      }
    }
    
    // Send confirmation email after appointment creation
    let emailSent = false;
    try {
      if (bookingData.driverEmail) {
        console.log('[BookingSubmission] Sending confirmation email to:', bookingData.driverEmail);
        console.log('[BookingSubmission] Appointment object:', JSON.stringify(appointment, null, 2));
        
        // Validate confirmation code exists
        if (!appointment.confirmationCode) {
          console.error('[BookingSubmission] No confirmation code found on appointment object');
          emailSent = false;
        } else {
          // Create enhanced schedule object for email with all required properties
          const enhancedSchedule = {
            // Core required properties
            id: appointment.id,
            facilityId: appointment.facilityId,
            dockId: appointment.dockId,
            carrierId: appointment.carrierId,
            appointmentTypeId: appointment.appointmentTypeId,
            truckNumber: appointment.truckNumber,
            trailerNumber: appointment.trailerNumber,
            driverName: appointment.driverName,
            driverPhone: appointment.driverPhone,
            driverEmail: appointment.driverEmail,
            customerName: appointment.customerName,
            carrierName: appointment.carrierName,
            mcNumber: appointment.mcNumber,
            bolNumber: appointment.bolNumber,
            poNumber: appointment.poNumber,
            palletCount: appointment.palletCount,
            weight: appointment.weight,
            appointmentMode: appointment.appointmentMode,
            // CRITICAL: Ensure dates are Date objects
            startTime: new Date(appointment.startTime),
            endTime: new Date(appointment.endTime),
            actualStartTime: appointment.actualStartTime ? new Date(appointment.actualStartTime) : null,
            actualEndTime: appointment.actualEndTime ? new Date(appointment.actualEndTime) : null,
            type: appointment.type,
            status: appointment.status,
            notes: appointment.notes,
            customFormData: appointment.customFormData,
            createdBy: appointment.createdBy,
            createdAt: new Date(appointment.createdAt),
            lastModifiedAt: appointment.lastModifiedAt ? new Date(appointment.lastModifiedAt) : null,
            lastModifiedBy: appointment.lastModifiedBy,
            
            // Enhanced properties for email (using already fetched facility and appointmentType)
            facilityName: facility?.name || 'Main Facility',
            appointmentTypeName: appointmentType?.name || 'Standard Appointment',
            dockName: 'Not assigned',
            timezone: facilityTimezone,
            userTimeZone: facilityTimezone,
            confirmationCode: appointment.confirmationCode,
            creatorEmail: bookingData.driverEmail,
            bolFileUploaded: false,
            bolData: null,
            bookingPageUrl: undefined
          };
          
          console.log('[BookingSubmission] Enhanced schedule for email:', JSON.stringify({
            id: enhancedSchedule.id,
            confirmationCode: enhancedSchedule.confirmationCode,
            facilityName: enhancedSchedule.facilityName,
            startTime: enhancedSchedule.startTime,
            endTime: enhancedSchedule.endTime,
            timezone: enhancedSchedule.timezone
          }, null, 2));
          
          // Import email notification function dynamically to avoid circular imports
          const { sendConfirmationEmail } = await import('../../notifications');
          
          // Send the confirmation email
          const emailResult = await sendConfirmationEmail(
            bookingData.driverEmail,
            appointment.confirmationCode,
            // @ts-expect-error: EnhancedSchedule partial object for email
            enhancedSchedule
          );
          
          if (emailResult) {
            console.log('[BookingSubmission] Confirmation email sent successfully');
            emailSent = true;
          } else {
            console.log('[BookingSubmission] Confirmation email failed to send - emailResult was false/null');
            emailSent = false;
          }
        }
      } else {
        console.log('[BookingSubmission] No email provided - skipping confirmation email');
        emailSent = false;
      }
    } catch (emailError) {
      const error = emailError as Error; // Type-safe error casting
      console.error('[BookingSubmission] Error sending confirmation email:', error);
      console.error('[BookingSubmission] Email error stack:', error.stack);
      // Don't fail the entire request if email fails
      emailSent = false;
    }
    
    // Return the booking confirmation with facility timezone information
    res.json({
      success: true,
      emailSent: emailSent,
      appointment: {
        id: appointment.id,
        confirmationCode: appointment.confirmationCode,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        facilityId: appointment.facilityId,
        appointmentTypeId: appointment.appointmentTypeId,
        facilityName: facility?.name || 'Unknown Facility',
        facilityTimezone: facilityTimezone,
        appointmentTypeName: appointmentType?.name || 'Standard Appointment'
      }
    });
    
  } catch (error) {
    console.error("[BookingSubmission] Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

export default router;
