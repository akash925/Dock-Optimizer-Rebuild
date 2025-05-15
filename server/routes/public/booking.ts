import { Router } from "express";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { bookingPages } from "@shared/schema";
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
    let facilities = [];
    if (page.facilities) {
      try {
        // If it's already an array, use it as is, otherwise parse it
        facilities = Array.isArray(page.facilities) ? page.facilities : JSON.parse(String(page.facilities));
      } catch (err) {
        console.error("Error parsing facilities JSON:", err);
      }
    }

    // Parse the excluded appointment types from JSON if present
    let excludedAppointmentTypes = [];
    if (page.excludedAppointmentTypes) {
      try {
        // If it's already an array, use it as is, otherwise parse it
        excludedAppointmentTypes = Array.isArray(page.excludedAppointmentTypes) 
          ? page.excludedAppointmentTypes 
          : JSON.parse(String(page.excludedAppointmentTypes));
      } catch (err) {
        console.error("Error parsing excludedAppointmentTypes JSON:", err);
      }
    }

    // Create the sanitized response
    const sanitized = {
      ...page,
      id: safeToString(page.id),
      facilities,
      excludedAppointmentTypes,
      tenantId: safeToString(page.tenantId),
    };

    res.json(sanitized);
  } catch (err) {
    console.error("Error fetching booking page by slug:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
