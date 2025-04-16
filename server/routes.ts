import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import {
  insertDockSchema,
  insertScheduleSchema,
  insertCarrierSchema,
  insertNotificationSchema,
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

  app.put("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      
      const updatedDock = await storage.updateDock(id, req.body);
      res.json(updatedDock);
    } catch (err) {
      res.status(500).json({ message: "Failed to update dock" });
    }
  });
  
  app.delete("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Check if there are any scheduled appointments using this dock
      const dockSchedules = await storage.getSchedulesByDock(id);
      if (dockSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete dock with existing schedules", 
          count: dockSchedules.length
        });
      }
      
      // Delete the dock
      const success = await storage.deleteDock(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete dock" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete dock" });
    }
  });

  // Schedule routes
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
        schedules = await storage.getSchedules();
      }
      
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch schedules" });
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
      // Add the current user to createdBy field
      const scheduleData = {
        ...req.body,
        createdBy: req.user!.id
      };
      
      const validatedData = insertScheduleSchema.parse(scheduleData);
      
      // Check if dock exists
      const dock = await storage.getDock(validatedData.dockId);
      if (!dock) {
        return res.status(400).json({ message: "Invalid dock ID" });
      }
      
      // Check if carrier exists
      const carrier = await storage.getCarrier(validatedData.carrierId);
      if (!carrier) {
        return res.status(400).json({ message: "Invalid carrier ID" });
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
      const scheduleData = {
        ...req.body,
        lastModifiedBy: req.user!.id
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to update schedule" });
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
        companyName: z.string().min(2),
        contactName: z.string().min(2),
        contactEmail: z.string().email(),
        contactPhone: z.string().min(10),
        appointmentDate: z.string().min(1),
        appointmentTime: z.string().min(1),
        location: z.string().min(1),
        mcNumber: z.string().optional(),
        truckNumber: z.string().min(1),
        trailerNumber: z.string().optional(),
        driverName: z.string().min(1),
        driverPhone: z.string().min(10),
        additionalNotes: z.string().optional(),
      });
      
      const validatedData = externalBookingSchema.parse(req.body);
      
      // Find or create the carrier based on company name
      let carrier = (await storage.getCarriers()).find(
        c => c.name.toLowerCase() === validatedData.companyName.toLowerCase()
      );
      
      if (!carrier) {
        carrier = await storage.createCarrier({
          name: validatedData.companyName,
          contactName: validatedData.contactName,
          contactEmail: validatedData.contactEmail,
          contactPhone: validatedData.contactPhone,
        });
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
      
      const startTime = new Date(year, month - 1, day, hour, minute);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      
      // Create schedule with the available information
      const scheduleData = {
        type: validatedData.appointmentType,
        status: "scheduled",
        dockId: docks[0].id,
        carrierId: carrier.id,
        truckNumber: validatedData.truckNumber,
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

  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
