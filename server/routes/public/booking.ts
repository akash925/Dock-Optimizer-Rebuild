import { Router } from "express";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { bookingPages } from "@/db/schema";
import { safeToString } from "@/lib/utils"; 

const router = Router();

// GET /api/booking-pages/slug/:slug
router.get("/booking-pages/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const page = await db.query.bookingPages.findFirst({
      where: eq(bookingPages.slug, slug),
      with: {
        facilities: true,
        appointmentTypes: true,
      },
    });

    if (!page) return res.status(404).json({ message: "Booking page not found" });

    const sanitized = {
      ...page,
      facilities: page.facilities.map(f => ({
        ...f,
        id: safeToString(f.id),
      })),
      appointmentTypes: page.appointmentTypes.map(t => ({
        ...t,
        id: safeToString(t.id),
        facilityId: safeToString(t.facilityId),
      })),
    };

    res.json(sanitized);
  } catch (err) {
    console.error("Error fetching booking page by slug:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
