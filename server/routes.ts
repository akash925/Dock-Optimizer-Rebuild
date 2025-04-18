import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import path from "path";
import fs from "fs";
import multer from "multer";
import {
  insertDockSchema,
  // Removing insertScheduleSchema as we're handling date validation manually
  insertCarrierSchema,
  insertNotificationSchema,
  insertFacilitySchema,
  insertAppointmentSettingsSchema,
  insertAppointmentTypeSchema,
  insertDailyAvailabilitySchema,
  insertCustomQuestionSchema,
  insertBookingPageSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  await setupAuth(app);
  
  // Get the role check middleware
  const { checkRole } = app.locals;
  
  // Get storage instance
  const storage = await getStorage();

  // API Routes
  // Dock routes
  app.get("/api/docks", async (req, res) => {
    try {
      const docks = await storage.getDocks();
      res.json(docks);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch docks" });
    }
  });
  
  // Get docks by facility
  app.get("/api/facilities/:id/docks", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const facility = await storage.getFacility(facilityId);
      
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      const docks = await storage.getDocks();
      const facilityDocks = docks.filter(dock => dock.facilityId === facilityId);
      
      res.json(facilityDocks);
    } catch (err) {
      console.error("Error fetching facility docks:", err);
      res.status(500).json({ message: "Failed to fetch facility docks" });
    }
  });

  app.get("/api/docks/:id", async (req, res) => {
    try {
      const dock = await storage.getDock(Number(req.params.id));
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      res.json(dock);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dock" });
    }
  });

  app.post("/api/docks", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDockSchema.parse(req.body);
      const dock = await storage.createDock(validatedData);
      res.status(201).json(dock);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dock data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create dock" });
    }
  });
  
  // Create dock for a specific facility
  app.post("/api/facilities/:id/docks", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      console.log(`Creating dock for facility ID: ${facilityId} with data:`, req.body);
      
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Add facility ID to the dock data
      const dockData = {
        ...req.body,
        facilityId
      };
      
      // Validate dock data
      const validatedData = insertDockSchema.parse(dockData);
      console.log("Validated dock data:", validatedData);
      
      // Create the dock
      const dock = await storage.createDock(validatedData);
      console.log("Dock created successfully:", dock);
      
      res.status(201).json(dock);
    } catch (err) {
      console.error("Error creating dock for facility:", err);
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid dock data", 
          errors: err.errors,
          details: err.format() 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create dock",
        error: err instanceof Error ? err.message : "Unknown error" 
      });
    }
  });

  app.put("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Updating dock ID: ${id} with data:`, req.body);
      
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Make sure we have all required fields by combining existing and new data
      try {
        const fieldsToCheck = {
          ...dock,  // Start with existing dock data
          ...req.body   // Override with update data
        };
        // Validate combined data preserves required fields
        insertDockSchema.parse(fieldsToCheck);
      } catch (validationErr) {
        if (validationErr instanceof z.ZodError) {
          console.error("Validation error updating dock:", validationErr.format());
          return res.status(400).json({ 
            message: "Invalid dock data", 
            errors: validationErr.errors,
            details: validationErr.format()
          });
        }
        throw validationErr;
      }
      
      const updatedDock = await storage.updateDock(id, req.body);
      console.log("Dock updated successfully:", updatedDock);
      res.json(updatedDock);
    } catch (err) {
      console.error("Error updating dock:", err);
      res.status(500).json({ 
        message: "Failed to update dock",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  app.delete("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Attempting to delete dock ID: ${id}`);
      
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Check if there are any scheduled appointments using this dock
      const dockSchedules = await storage.getSchedulesByDock(id);
      if (dockSchedules.length > 0) {
        console.log(`Cannot delete dock ID ${id}: ${dockSchedules.length} existing schedules`);
        return res.status(409).json({ 
          message: "Cannot delete dock with existing schedules", 
          count: dockSchedules.length
        });
      }
      
      // Delete the dock
      const success = await storage.deleteDock(id);
      if (!success) {
        console.error(`Failed to delete dock ID ${id} from storage`);
        return res.status(500).json({ message: "Failed to delete dock" });
      }
      
      console.log(`Successfully deleted dock ID: ${id}`);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting dock:", err);
      res.status(500).json({ 
        message: "Failed to delete dock",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Schedule routes
  // Lookup schedule by confirmation code
  app.get("/api/schedules/confirmation/:code", async (req, res) => {
    try {
      const { code } = req.params;
      if (!code) {
        return res.status(400).json({ error: "Confirmation code is required" });
      }
      
      const schedule = await storage.getScheduleByConfirmationCode(code);
      if (!schedule) {
        return res.status(404).json({ error: "No schedule found with the provided confirmation code" });
      }
      
      res.json(schedule);
    } catch (error) {
      console.error("Error looking up schedule by confirmation code:", error);
      res.status(500).json({ error: "Failed to lookup schedule" });
    }
  });
  
  app.get("/api/schedules", async (req, res) => {
    try {
      // Handle date range filtering
      const { startDate, endDate } = req.query;
      let schedules;
      
      if (startDate && endDate) {
        schedules = await storage.getSchedulesByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        try {
          schedules = await storage.getSchedules();
        } catch (error) {
          console.error("Error in getSchedules:", error);
          throw error;
        }
      }
      
      res.json(schedules);
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
      res.status(500).json({ message: "Failed to fetch schedules", error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.getSchedule(Number(req.params.id));
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.get("/api/docks/:id/schedules", async (req, res) => {
    try {
      const schedules = await storage.getSchedulesByDock(Number(req.params.id));
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch schedules for dock" });
    }
  });

  app.post("/api/schedules", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("=== SCHEDULE CREATION START ===");
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));
      
      // Add the current user to createdBy field and process the dates
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      let scheduleData = {
        ...rawData,
        createdBy: req.user!.id
      };
      
      // Extract newCarrier data if present
      const newCarrierData = scheduleData.newCarrier;
      delete scheduleData.newCarrier;
      
      // NO validation, NO date conversion, pass directly to storage
      console.log("IMPORTANT: Bypassing all validation and date conversion");
      
      // Just pass the raw data to storage and let it handle everything
      const validatedData = scheduleData;
      
      // Check if dock exists
      const dock = await storage.getDock(validatedData.dockId);
      if (!dock) {
        return res.status(400).json({ message: "Invalid dock ID" });
      }
      
      // Handle custom carrier creation if needed
      let carrierId = validatedData.carrierId;
      if (!carrierId && newCarrierData) {
        try {
          console.log("Creating new carrier:", newCarrierData);
          const validatedCarrierData = insertCarrierSchema.parse(newCarrierData);
          const newCarrier = await storage.createCarrier(validatedCarrierData);
          carrierId = newCarrier.id;
          validatedData.carrierId = carrierId;
          console.log("New carrier created with ID:", carrierId);
        } catch (carrierErr) {
          console.error("Failed to create new carrier:", carrierErr);
          if (carrierErr instanceof z.ZodError) {
            return res.status(400).json({ 
              message: "Invalid carrier data", 
              errors: carrierErr.errors 
            });
          }
          return res.status(500).json({ message: "Failed to create new carrier" });
        }
      } else {
        // Check if existing carrier ID is valid
        const carrier = await storage.getCarrier(validatedData.carrierId);
        if (!carrier) {
          return res.status(400).json({ message: "Invalid carrier ID" });
        }
      }
      
      // Check for schedule conflicts
      const conflictingSchedules = (await storage.getSchedulesByDock(validatedData.dockId))
        .filter(s => 
          (new Date(validatedData.startTime) < new Date(s.endTime)) && 
          (new Date(validatedData.endTime) > new Date(s.startTime))
        );
      
      if (conflictingSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Schedule conflicts with existing schedules", 
          conflicts: conflictingSchedules 
        });
      }
      
      const schedule = await storage.createSchedule(validatedData);
      res.status(201).json(schedule);
    } catch (err) {
      console.error("Failed to create schedule:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid schedule data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.put("/api/schedules/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Add the current user to lastModifiedBy field
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      const scheduleData = {
        ...rawData,
        lastModifiedBy: req.user!.id
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });
  
  // PATCH for partial updates to schedules
  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Add the current user to lastModifiedBy field
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      const scheduleData = {
        ...rawData,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to patch schedule:", err);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });
  
  // Check-in endpoint - starts appointment
  app.patch("/api/schedules/:id/check-in", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Update schedule status to in-progress and set actual start time
      const scheduleData = {
        status: "in-progress",
        actualStartTime: new Date(),
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to check in schedule:", err);
      res.status(500).json({ message: "Failed to check in" });
    }
  });
  
  // Check-out endpoint - completes appointment
  app.patch("/api/schedules/:id/check-out", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Update schedule status to completed and set actual end time
      const scheduleData = {
        status: "completed",
        actualEndTime: new Date(),
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to check out schedule:", err);
      res.status(500).json({ message: "Failed to check out" });
    }
  });
  
  // Cancel endpoint
  app.patch("/api/schedules/:id/cancel", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Update schedule status to cancelled
      const scheduleData = {
        status: "cancelled",
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to cancel schedule:", err);
      res.status(500).json({ message: "Failed to cancel appointment" });
    }
  });
  
  // Reschedule endpoint
  app.patch("/api/schedules/:id/reschedule", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Validate new times
      const { startTime: rawStartTime, endTime: rawEndTime } = req.body;
      if (!rawStartTime || !rawEndTime) {
        return res.status(400).json({ message: "Start time and end time are required" });
      }
      
      // Round times to 15-minute intervals
      const startDate = new Date(rawStartTime);
      const endDate = new Date(rawEndTime);
      
      // Round minutes to nearest 15-minute interval (0, 15, 30, 45)
      const roundStartMinutes = Math.round(startDate.getMinutes() / 15) * 15;
      const roundEndMinutes = Math.round(endDate.getMinutes() / 15) * 15;
      
      // Handle case where rounding results in 60 minutes
      const startHour = roundStartMinutes === 60 ? startDate.getHours() + 1 : startDate.getHours();
      const endHour = roundEndMinutes === 60 ? endDate.getHours() + 1 : endDate.getHours();
      const startMinutes = roundStartMinutes === 60 ? 0 : roundStartMinutes;
      const endMinutes = roundEndMinutes === 60 ? 0 : roundEndMinutes;
      
      startDate.setHours(startHour, startMinutes, 0, 0);
      endDate.setHours(endHour, endMinutes, 0, 0);
      
      const startTime = startDate;
      const endTime = endDate;
      
      // Check for schedule conflicts with new times
      const conflictingSchedules = (await storage.getSchedulesByDock(schedule.dockId))
        .filter(s => 
          s.id !== id && // Ignore the current schedule
          (new Date(startTime) < new Date(s.endTime)) && 
          (new Date(endTime) > new Date(s.startTime))
        );
      
      if (conflictingSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Schedule conflicts with existing schedules", 
          conflicts: conflictingSchedules 
        });
      }
      
      // Update the schedule with new times
      const scheduleData = {
        startTime,
        endTime,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to reschedule appointment:", err);
      res.status(500).json({ message: "Failed to reschedule appointment" });
    }
  });

  app.delete("/api/schedules/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      await storage.deleteSchedule(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  // Carrier routes
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getCarriers();
      res.json(carriers);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch carriers" });
    }
  });
  
  app.get("/api/carriers/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.json([]);
      }
      
      const carriers = await storage.getCarriers();
      const filteredCarriers = carriers.filter(carrier => 
        carrier.name.toLowerCase().includes(query.toLowerCase()) || 
        (carrier.mcNumber && carrier.mcNumber.toLowerCase().includes(query.toLowerCase()))
      );
      res.json(filteredCarriers);
    } catch (err) {
      res.status(500).json({ message: "Failed to search carriers" });
    }
  });

  app.get("/api/carriers/:id", async (req, res) => {
    try {
      const carrier = await storage.getCarrier(Number(req.params.id));
      if (!carrier) {
        return res.status(404).json({ message: "Carrier not found" });
      }
      res.json(carrier);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch carrier" });
    }
  });

  app.post("/api/carriers", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertCarrierSchema.parse(req.body);
      const carrier = await storage.createCarrier(validatedData);
      res.status(201).json(carrier);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid carrier data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create carrier" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid notification data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      const id = Number(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Ensure the notification belongs to the current user
      if (notification.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden: Cannot access this notification" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  // Facility routes
  app.get("/api/facilities", async (req, res) => {
    try {
      const facilities = await storage.getFacilities();
      res.json(facilities);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.get("/api/facilities/:id", async (req, res) => {
    try {
      const facility = await storage.getFacility(Number(req.params.id));
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      res.json(facility);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch facility" });
    }
  });

  app.post("/api/facilities", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("Creating facility with request body:", req.body);
      const validatedData = insertFacilitySchema.parse(req.body);
      console.log("Validated facility data:", validatedData);
      
      const facility = await storage.createFacility(validatedData);
      console.log("Facility created successfully:", facility);
      
      res.status(201).json(facility);
    } catch (err) {
      console.error("Error creating facility:", err);
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid facility data", 
          errors: err.errors,
          details: err.format() 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create facility",
        error: err instanceof Error ? err.message : "Unknown error" 
      });
    }
  });

  app.put("/api/facilities/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Updating facility ID: ${id} with data:`, req.body);
      
      const facility = await storage.getFacility(id);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Make sure we have at least the required fields
      try {
        const fieldsToCheck = {
          ...facility,  // Start with existing facility data
          ...req.body   // Override with update data
        };
        // Validate combined data preserves required fields
        insertFacilitySchema.parse(fieldsToCheck);
      } catch (validationErr) {
        if (validationErr instanceof z.ZodError) {
          console.error("Validation error updating facility:", validationErr.format());
          return res.status(400).json({ 
            message: "Invalid facility data", 
            errors: validationErr.errors,
            details: validationErr.format()
          });
        }
        throw validationErr;
      }
      
      const updatedFacility = await storage.updateFacility(id, req.body);
      console.log("Facility updated successfully:", updatedFacility);
      res.json(updatedFacility);
    } catch (err) {
      console.error("Error updating facility:", err);
      res.status(500).json({ 
        message: "Failed to update facility",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  app.delete("/api/facilities/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const facility = await storage.getFacility(id);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Check if there are any docks using this facility
      const docks = await storage.getDocks();
      const facilityDocks = docks.filter(d => d.facilityId === id);
      
      if (facilityDocks.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete facility with existing docks", 
          count: facilityDocks.length
        });
      }
      
      // Delete the facility
      const success = await storage.deleteFacility(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete facility" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete facility" });
    }
  });

  // User routes (admin only)
  app.get("/api/users", checkRole("admin"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // External booking endpoint - no authentication required
  app.post("/api/external-booking", async (req, res) => {
    try {
      // Create a schema for external booking validation
      const externalBookingSchema = z.object({
        appointmentType: z.string().min(1),
        pickupOrDropoff: z.string().min(1),
        customerName: z.string().min(2), // This is the company name from step 2
        contactName: z.string().min(2),
        contactEmail: z.string().email(),
        contactPhone: z.string().min(10),
        appointmentDate: z.string().min(1),
        appointmentTime: z.string().min(1),
        location: z.string().min(1),
        // Add carrier name and ID (if carrier is selected from dropdown)
        carrierId: z.number().or(z.string()).optional(),
        carrierName: z.string().optional(),
        // Make MC Number completely optional (empty string is also valid)
        mcNumber: z.string().optional().or(z.literal("")),
        truckNumber: z.string().min(1),
        trailerNumber: z.string().optional(),
        driverName: z.string().min(1),
        driverPhone: z.string().min(10),
        additionalNotes: z.string().optional(),
        // For tracking which carrier data is selected vs typed
        bolFileUploaded: z.boolean().optional(),
        bolUploaded: z.boolean().optional(),
      });
      
      const validatedData = externalBookingSchema.parse(req.body);
      
      // Handle carrier selection - don't try to create one, just use the selected carrier
      let carrier = null;
      
      try {
        // If carrierName and mcNumber were provided, find or use that carrier
        if (validatedData.carrierName) {
          console.log(`Looking for carrier by name: ${validatedData.carrierName}`);
          
          // Exact lookup by ID if coming from dropdown (where value is ID)
          if (validatedData.carrierId) {
            const carrierId = parseInt(validatedData.carrierId.toString(), 10);
            if (!isNaN(carrierId)) {
              carrier = await storage.getCarrier(carrierId);
              console.log(`Found carrier by ID ${carrierId}: ${carrier?.name || 'not found'}`);
            }
          }
          
          // If not found by ID, look for exact name match
          if (!carrier) {
            const allCarriers = await storage.getCarriers();
            carrier = allCarriers.find(c => 
              c.name.toLowerCase() === validatedData.carrierName!.toLowerCase()
            );
            console.log(`Carrier found by name match: ${carrier?.name || 'not found'}`);
          }
          
          // If we have a carrier and MC number was provided, update the carrier
          if (carrier && validatedData.mcNumber && validatedData.mcNumber !== carrier.mcNumber) {
            console.log(`Updating carrier ${carrier.name} with MC number: ${validatedData.mcNumber}`);
            carrier = await storage.updateCarrier(carrier.id, {
              ...carrier,
              mcNumber: validatedData.mcNumber
            });
          }
          
          // If still no carrier, use the first available one but don't create a new one
          if (!carrier) {
            const allCarriers = await storage.getCarriers();
            if (allCarriers.length > 0) {
              carrier = allCarriers[0];
              console.log(`Using first available carrier: ${carrier.name}`);
            } else {
              // This should almost never happen, but create a default carrier just in case
              carrier = await storage.createCarrier({
                name: "Default Carrier",
                mcNumber: validatedData.mcNumber || "",
                contactName: "System",
                contactEmail: "system@example.com",
                contactPhone: "0000000000",
              });
              console.log("Created default carrier as fallback");
            }
          }
        } else {
          // Get first available carrier if no name specified
          const allCarriers = await storage.getCarriers();
          if (allCarriers.length > 0) {
            carrier = allCarriers[0];
            console.log(`No carrier specified, using first available: ${carrier.name}`);
          } else {
            // Create a default carrier if none exist
            carrier = await storage.createCarrier({
              name: "Default Carrier",
              mcNumber: validatedData.mcNumber || "",
              contactName: "System",
              contactEmail: "system@example.com",
              contactPhone: "0000000000",
            });
            console.log("Created default carrier since none existed");
          }
        }
      } catch (error: any) {
        console.error("Error handling carrier:", error);
        return res.status(500).json({ 
          message: "Failed to create booking - error with carrier processing", 
          details: error?.message || "Unknown error"
        });
      }
      
      // Safety check - if we don't have a carrier by now, something went wrong
      if (!carrier) {
        return res.status(500).json({ message: "Failed to create or find a carrier" });
      }
      
      // Find the appropriate dock based on location
      // Here we're simplifying by getting the first available dock
      // In a real implementation, you'd have logic to find the right dock based on location
      const docks = await storage.getDocks();
      if (docks.length === 0) {
        return res.status(400).json({ message: "No available docks" });
      }
      
      // In a real implementation, you'd need to parse the appointmentDate and appointmentTime
      // For now, we'll use a simple approach to create Date objects
      const [year, month, day] = validatedData.appointmentDate.split('-').map(Number);
      const [hour, minute] = validatedData.appointmentTime.split(':').map(Number);
      
      // Round minutes to nearest 15-minute interval (0, 15, 30, 45)
      const roundedMinute = Math.round(minute / 15) * 15;
      const adjustedHour = roundedMinute === 60 ? hour + 1 : hour;
      const finalMinute = roundedMinute === 60 ? 0 : roundedMinute;
      
      const startTime = new Date(year, month - 1, day, adjustedHour, finalMinute);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      
      // Create schedule with the available information
      const scheduleData = {
        // Set type based on pickupOrDropoff (pickup -> outbound, dropoff -> inbound)
        type: validatedData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
        status: "scheduled",
        dockId: docks[0].id,
        carrierId: carrier.id,
        customerName: validatedData.customerName, // Include the customer name
        truckNumber: validatedData.truckNumber,
        trailerNumber: validatedData.trailerNumber || null,
        driverName: validatedData.driverName || null,
        driverPhone: validatedData.driverPhone || null,
        startTime,
        endTime,
        notes: validatedData.additionalNotes || null,
        createdBy: 1, // System user ID - in a real app, you might have a designated system user
      };
      
      const schedule = await storage.createSchedule(scheduleData);
      
      // Create a confirmation number
      const confirmationNumber = `HZL-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // In a real application, you'd send an email confirmation here
      
      // Return success response
      res.status(201).json({
        success: true,
        confirmationNumber,
        schedule,
        message: "Appointment successfully scheduled",
      });
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: err.errors });
      }
      console.error("External booking error:", err);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  // Appointment Settings routes
  app.get("/api/facilities/:id/appointment-settings", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      const settings = await storage.getAppointmentSettings(facilityId);
      if (!settings) {
        // Return default settings if none exist
        return res.json({
          facilityId,
          timeInterval: 30, // Default to 30 minutes
          maxConcurrentInbound: 2,
          maxConcurrentOutbound: 2,
          shareAvailabilityInfo: true
        });
      }
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment settings" });
    }
  });

  app.post("/api/facilities/:id/appointment-settings", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Check if settings already exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (existingSettings) {
        return res.status(409).json({ 
          message: "Appointment settings already exist for this facility. Use PUT to update.",
          settings: existingSettings
        });
      }

      const settingsData = {
        ...req.body,
        facilityId
      };
      
      const validatedData = insertAppointmentSettingsSchema.parse(settingsData);
      const settings = await storage.createAppointmentSettings(validatedData);
      res.status(201).json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create appointment settings" });
    }
  });

  app.put("/api/facilities/:id/appointment-settings", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Check if settings exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (!existingSettings) {
        // If settings don't exist, create them
        const settingsData = {
          ...req.body,
          facilityId
        };
        
        const validatedData = insertAppointmentSettingsSchema.parse(settingsData);
        const settings = await storage.createAppointmentSettings(validatedData);
        return res.status(201).json(settings);
      }

      // Update existing settings
      const updatedSettings = await storage.updateAppointmentSettings(facilityId, req.body);
      res.json(updatedSettings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update appointment settings" });
    }
  });

  // Appointment Type routes
  app.get("/api/appointment-types", async (req, res) => {
    try {
      const appointmentTypes = await storage.getAppointmentTypes();
      res.json(appointmentTypes);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment types" });
    }
  });

  app.get("/api/appointment-types/:id", async (req, res) => {
    try {
      const appointmentType = await storage.getAppointmentType(Number(req.params.id));
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      res.json(appointmentType);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment type" });
    }
  });

  app.get("/api/facilities/:id/appointment-types", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const appointmentTypes = await storage.getAppointmentTypesByFacility(facilityId);
      res.json(appointmentTypes);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment types for facility" });
    }
  });

  app.post("/api/appointment-types", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertAppointmentTypeSchema.parse(req.body);
      
      // Check if facility exists
      const facility = await storage.getFacility(validatedData.facilityId);
      if (!facility) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      const appointmentType = await storage.createAppointmentType(validatedData);
      res.status(201).json(appointmentType);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment type data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create appointment type" });
    }
  });

  app.put("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const appointmentType = await storage.getAppointmentType(id);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      const updatedAppointmentType = await storage.updateAppointmentType(id, req.body);
      res.json(updatedAppointmentType);
    } catch (err) {
      res.status(500).json({ message: "Failed to update appointment type" });
    }
  });

  app.delete("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const appointmentType = await storage.getAppointmentType(id);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Check if there are any schedules using this appointment type
      const schedules = await storage.getSchedules();
      const appointmentTypeSchedules = schedules.filter(s => s.appointmentTypeId === id);
      
      if (appointmentTypeSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete appointment type with existing schedules", 
          count: appointmentTypeSchedules.length
        });
      }
      
      // Delete the appointment type
      const success = await storage.deleteAppointmentType(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete appointment type" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete appointment type" });
    }
  });

  // Daily Availability routes
  app.get("/api/appointment-types/:id/availability", async (req, res) => {
    try {
      const appointmentTypeId = Number(req.params.id);
      const dailyAvailability = await storage.getDailyAvailabilityByAppointmentType(appointmentTypeId);
      res.json(dailyAvailability);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch daily availability" });
    }
  });

  app.post("/api/daily-availability", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDailyAvailabilitySchema.parse(req.body);
      
      // Check if appointment type exists
      const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
      if (!appointmentType) {
        return res.status(400).json({ message: "Invalid appointment type ID" });
      }
      
      const dailyAvailability = await storage.createDailyAvailability(validatedData);
      res.status(201).json(dailyAvailability);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid daily availability data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create daily availability" });
    }
  });

  app.put("/api/daily-availability/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const dailyAvailability = await storage.getDailyAvailability(id);
      if (!dailyAvailability) {
        return res.status(404).json({ message: "Daily availability not found" });
      }
      
      const updatedDailyAvailability = await storage.updateDailyAvailability(id, req.body);
      res.json(updatedDailyAvailability);
    } catch (err) {
      res.status(500).json({ message: "Failed to update daily availability" });
    }
  });

  // Custom Question routes
  app.get("/api/appointment-types/:id/questions", async (req, res) => {
    try {
      const appointmentTypeId = Number(req.params.id);
      const customQuestions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      res.json(customQuestions);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  });

  app.post("/api/custom-questions", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertCustomQuestionSchema.parse(req.body);
      
      // Check if appointment type exists if appointmentTypeId is provided
      if (validatedData.appointmentTypeId) {
        const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
        if (!appointmentType) {
          return res.status(400).json({ message: "Invalid appointment type ID" });
        }
      }
      
      const customQuestion = await storage.createCustomQuestion(validatedData);
      res.status(201).json(customQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid custom question data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create custom question" });
    }
  });

  app.put("/api/custom-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
      }
      
      const updatedCustomQuestion = await storage.updateCustomQuestion(id, req.body);
      res.json(updatedCustomQuestion);
    } catch (err) {
      res.status(500).json({ message: "Failed to update custom question" });
    }
  });

  app.delete("/api/custom-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
      }
      
      const success = await storage.deleteCustomQuestion(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete custom question" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete custom question" });
    }
  });

  // Booking Pages routes
  app.get("/api/booking-pages", async (req, res) => {
    try {
      const bookingPages = await storage.getBookingPages();
      res.json(bookingPages);
    } catch (err) {
      console.error("Error fetching booking pages:", err);
      res.status(500).json({ message: "Failed to fetch booking pages" });
    }
  });

  app.get("/api/booking-pages/slug/:slug", async (req, res) => {
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

  app.get("/api/booking-pages/:id", async (req, res) => {
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

  app.post("/api/booking-pages", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      // Add the current user to createdBy field
      const bookingPageData = {
        ...req.body,
        createdBy: req.user!.id
      };
      
      const validatedData = insertBookingPageSchema.parse(bookingPageData);
      
      // Check if slug already exists
      const existingBookingPage = await storage.getBookingPageBySlug(validatedData.slug);
      if (existingBookingPage) {
        return res.status(400).json({ message: "Slug already in use" });
      }
      
      const bookingPage = await storage.createBookingPage(validatedData);
      res.status(201).json(bookingPage);
    } catch (err) {
      console.error("Error creating booking page:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid booking page data", 
          errors: err.errors 
        });
      }
      res.status(500).json({ message: "Failed to create booking page" });
    }
  });

  app.put("/api/booking-pages/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bookingPage = await storage.getBookingPage(id);
      if (!bookingPage) {
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      // Add the current user to lastModifiedBy field
      const bookingPageData = {
        ...req.body,
        lastModifiedBy: req.user!.id
      };
      
      // If slug is being changed, check if new slug already exists
      if (bookingPageData.slug && bookingPageData.slug !== bookingPage.slug) {
        const existingBookingPage = await storage.getBookingPageBySlug(bookingPageData.slug);
        if (existingBookingPage && existingBookingPage.id !== id) {
          return res.status(400).json({ message: "Slug already in use" });
        }
      }
      
      const updatedBookingPage = await storage.updateBookingPage(id, bookingPageData);
      res.json(updatedBookingPage);
    } catch (err) {
      console.error("Error updating booking page:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid booking page data", 
          errors: err.errors 
        });
      }
      res.status(500).json({ message: "Failed to update booking page" });
    }
  });

  app.delete("/api/booking-pages/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const bookingPage = await storage.getBookingPage(id);
      if (!bookingPage) {
        return res.status(404).json({ message: "Booking page not found" });
      }
      
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

  // Set up multer for photo upload
  const uploadDir = path.join(process.cwd(), 'uploads');
  
  // Create upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Configure storage for file uploads
  const multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `schedule-${req.params.id}-${uniqueSuffix}${ext}`);
    }
  });
  
  const upload = multer({ 
    storage: multerStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      // Accept only images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(null, false);
        return new Error('Only image files are allowed');
      }
    }
  });
  
  // Release door endpoint (with optional notes and photo)
  app.post("/api/schedules/:id/release", upload.single('photo'), async (req, res) => {
    try {
      console.log("=== RELEASE DOOR START ===");
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Get notes and release type from request body
      const { notes, releaseType = 'normal' } = req.body;
      
      // Optional photo file info
      const photoInfo = req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null;
      
      console.log(`Releasing door for schedule ${id} with notes: ${notes}`);
      if (photoInfo) {
        console.log(`Photo uploaded: ${photoInfo.filename}`);
      }
      
      // Update schedule with notes, photo, and mark as completed
      const scheduleData = {
        status: "completed",
        actualEndTime: new Date(),
        notes: notes || schedule.notes,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date(),
        // Store photo information in custom form data if available
        customFormData: photoInfo ? JSON.stringify({
          ...(schedule.customFormData ? JSON.parse(schedule.customFormData) : {}),
          releasePhoto: photoInfo
        }) : typeof req.body.customFormData !== 'undefined' ? req.body.customFormData : schedule.customFormData
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Return updated schedule with photo information
      res.json({
        ...updatedSchedule,
        photoInfo: photoInfo
      });
    } catch (err) {
      console.error("Failed to release door:", err);
      res.status(500).json({ 
        message: "Failed to release door", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
