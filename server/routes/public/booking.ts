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

export default router;
