import express from 'express';
import { db } from '../lib/db'; // Adjust if your db import path is different

const router = express.Router();

router.get('/slug/:slug', async (req, res) => {
  const slug = req.params.slug;

  const bookingPage = await db.bookingPages.findFirst({
    where: { slug },
  });

  if (!bookingPage) {
    return res.status(404).json({ message: 'Booking page not found' });
  }

  const facilities = await db.facilities.findMany({
    where: { id: { in: bookingPage.facilities } },
    select: { id: true, name: true, timezone: true },
  });

  const appointmentTypes = await db.appointmentTypes.findMany({
    where: { facilityId: { in: facilities.map(f => f.id) } },
    select: { id: true, name: true, facilityId: true },
  });

  res.json({ ...bookingPage, facilities, appointmentTypes });
});

export default router;
