const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { bookingPages } = require('../../shared/schema');
const { eq } = require('drizzle-orm');
const { storage } = require('../storage');
const { z } = require('zod');

// Input validation schema
const bookingPageSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional().nullable(),
  welcomeMessage: z.string().optional().nullable(),
  confirmationMessage: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  facilities: z.array(z.number()).min(1, "At least one facility must be selected"),
  excluded_appointment_types: z.array(z.number()),
  useOrganizationLogo: z.boolean().default(true),
  customLogo: z.string().optional().nullable(),
  primaryColor: z.string().default("#4CAF50"),
});

// GET all booking pages
router.get('/', async (req, res) => {
  try {
    const bookingPages = await storage.getBookingPages();
    res.json(bookingPages);
  } catch (err) {
    console.error("Error fetching booking pages:", err);
    res.status(500).json({ message: "Failed to fetch booking pages" });
  }
});

// GET booking page by ID
router.get('/:id', async (req, res) => {
  try {
    const bookingPage = await storage.getBookingPage(Number(req.params.id));
    if (!bookingPage) {
      return res.status(404).json({ message: "Booking page not found" });
    }
    res.json(bookingPage);
  } catch (err) {
    console.error("Error fetching booking page:", err);
    res.status(500).json({ message: "Failed to fetch booking page" });
  }
});

// GET booking page by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const bookingPage = await storage.getBookingPageBySlug(req.params.slug);
    if (!bookingPage) {
      return res.status(404).json({ message: "Booking page not found" });
    }
    res.json(bookingPage);
  } catch (err) {
    console.error("Error fetching booking page by slug:", err);
    res.status(500).json({ message: "Failed to fetch booking page" });
  }
});

// POST - Create a new booking page
router.post('/', async (req, res) => {
  try {
    // Parse and validate incoming data
    const { facilities, appointmentTypes, ...otherData } = req.body;
    
    // Validate facilities
    if (!facilities || !Array.isArray(facilities) || facilities.length === 0) {
      return res.status(400).json({
        error: "Validation error",
        message: "Please select at least one facility"
      });
    }
    
    // Validate appointment types
    if (!appointmentTypes || !Array.isArray(appointmentTypes) || appointmentTypes.length === 0) {
      return res.status(400).json({
        error: "Validation error",
        message: "Please select at least one appointment type"
      });
    }
    
    // Get all appointment types to calculate excluded ones
    const allAppointmentTypes = await storage.getAppointmentTypes();
    const allAppointmentTypeIds = allAppointmentTypes.map(type => type.id);
    
    // Calculate excluded appointment types (all types minus selected ones)
    const excluded_appointment_types = allAppointmentTypeIds.filter(
      id => !appointmentTypes.includes(id)
    );
    
    // Create booking page data with user ID and excluded types
    const bookingPageData = {
      ...otherData,
      facilities,
      excluded_appointment_types,
      createdBy: req.user?.id || 1, // Fallback to admin user if no user in request
    };
    
    // Validate with Zod schema
    try {
      bookingPageSchema.parse(bookingPageData);
    } catch (validationError) {
      return res.status(400).json({
        error: "Validation error",
        message: validationError.errors[0]?.message || "Invalid booking page data",
        details: validationError.errors
      });
    }
    
    // Check if slug already exists
    const existingBookingPage = await storage.getBookingPageBySlug(bookingPageData.slug);
    if (existingBookingPage) {
      return res.status(400).json({ message: "Slug already in use" });
    }
    
    // Create the booking page
    const newBookingPage = await storage.createBookingPage(bookingPageData);
    
    res.status(201).json({
      bookingPage: newBookingPage,
      success: true
    });
  } catch (err) {
    console.error("Error creating booking page:", err);
    res.status(500).json({ message: "Failed to create booking page" });
  }
});

// PUT - Update a booking page by ID
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Check if booking page exists
    const bookingPage = await storage.getBookingPage(id);
    if (!bookingPage) {
      return res.status(404).json({ message: "Booking page not found" });
    }
    
    // Parse and validate incoming data
    const { facilities, appointmentTypes, ...otherData } = req.body;
    
    // Validate facilities
    if (!facilities || !Array.isArray(facilities) || facilities.length === 0) {
      return res.status(400).json({
        error: "Validation error",
        message: "Please select at least one facility"
      });
    }
    
    // Validate appointment types
    if (!appointmentTypes || !Array.isArray(appointmentTypes) || appointmentTypes.length === 0) {
      return res.status(400).json({
        error: "Validation error",
        message: "Please select at least one appointment type"
      });
    }
    
    // Get all appointment types to calculate excluded ones
    const allAppointmentTypes = await storage.getAppointmentTypes();
    const allAppointmentTypeIds = allAppointmentTypes.map(type => type.id);
    
    // Calculate excluded appointment types (all types minus selected ones)
    const excluded_appointment_types = allAppointmentTypeIds.filter(
      id => !appointmentTypes.includes(id)
    );
    
    // Create update data with user ID and excluded types
    const bookingPageData = {
      ...otherData,
      facilities,
      excluded_appointment_types,
      lastModifiedBy: req.user?.id || 1, // Fallback to admin user if no user in request
    };
    
    // Validate with Zod schema
    try {
      bookingPageSchema.parse(bookingPageData);
    } catch (validationError) {
      return res.status(400).json({
        error: "Validation error",
        message: validationError.errors[0]?.message || "Invalid booking page data",
        details: validationError.errors
      });
    }
    
    // If slug is being changed, check if it's already in use
    if (bookingPageData.slug && bookingPageData.slug !== bookingPage.slug) {
      const existingBookingPage = await storage.getBookingPageBySlug(bookingPageData.slug);
      if (existingBookingPage && existingBookingPage.id !== id) {
        return res.status(400).json({ message: "Slug already in use" });
      }
    }
    
    // Update the booking page
    const updatedBookingPage = await storage.updateBookingPage(id, bookingPageData);
    
    res.status(200).json({
      bookingPage: updatedBookingPage,
      success: true
    });
  } catch (err) {
    console.error("Error updating booking page:", err);
    res.status(500).json({ message: "Failed to update booking page" });
  }
});

// DELETE - Delete a booking page by ID
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Check if booking page exists
    const bookingPage = await storage.getBookingPage(id);
    if (!bookingPage) {
      return res.status(404).json({ message: "Booking page not found" });
    }
    
    // Delete the booking page
    const success = await storage.deleteBookingPage(id);
    
    if (success) {
      res.status(204).send();
    } else {
      res.status(500).json({ message: "Failed to delete booking page" });
    }
  } catch (err) {
    console.error("Error deleting booking page:", err);
    res.status(500).json({ message: "Failed to delete booking page" });
  }
});

module.exports = router;