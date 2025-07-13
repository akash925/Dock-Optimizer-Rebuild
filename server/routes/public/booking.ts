import { Router } from "express";
import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";
import { bookingPages, facilities, appointmentTypes, standardQuestions } from "@shared/schema";
import { safeToString } from "@/lib/utils"; 

const router = Router();

// GET /api/booking-pages/slug/:slug
router.get("/booking-pages/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    // Query the basic booking page data
    const page = await db.query.bookingPages.findFirst({
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
router.get("/booking-pages/standard-questions/appointment-type/:appointmentTypeId", async (req, res) => {
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
router.post("/booking-pages/:slug/book", async (req, res) => {
  const { slug } = req.params;
  const bookingData = req.body;
  
  try {
    console.log(`[BookingSubmission] Processing booking for page ${slug}:`, bookingData);
    
    // Get the booking page to verify it exists and is active
    const bookingPage = await db.query.bookingPages.findFirst({
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
    
    // Create the appointment using the booking data with proper type and appointment settings
    const appointment = await storage.createSchedule({
      facilityId: bookingData.facilityId,
      appointmentTypeId: bookingData.appointmentTypeId,
      startTime: new Date(`${bookingData.date}T${bookingData.time}`),
      endTime: new Date(`${bookingData.date}T${bookingData.time}`), // Will be calculated based on duration
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
    });
    
    console.log(`[BookingSubmission] Created appointment ${appointment.id} with confirmation code ${appointment.confirmationCode}`);
    
    // Send real-time notification to all connected clients
    try {
      const { broadcastToTenant } = await import("../../lib/secure-websocket");
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
      console.log(`[BookingSubmission] Real-time notification sent for appointment ${appointment.id}`);
    } catch (wsError) {
      console.error("[BookingSubmission] WebSocket notification failed:", wsError);
    }
    
    // Return the booking confirmation
    res.json({
      success: true,
      appointment: {
        id: appointment.id,
        confirmationCode: appointment.confirmationCode,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        facilityId: appointment.facilityId,
        appointmentTypeId: appointment.appointmentTypeId
      }
    });
    
  } catch (error) {
    console.error("[BookingSubmission] Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

export default router;
