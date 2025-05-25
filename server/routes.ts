import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  checkInSchema, 
  checkOutSchema, 
  validateWithZod, 
  bolDocumentLinkSchema,
  bolUploadSchema,
  bookAppointmentSchema,
  resendEmailSchema,
} from "./middleware/validation";
import { getBookingStyles } from "./controllers/admin-controller";
import path from "path";
import fs from "fs";
import multer from "multer";
import { sendConfirmationEmail, sendEmail, generateICalEvent } from "./notifications";
import { sendCheckoutCompletionEmail } from "./checkout-notification";
import { v4 as uuidv4 } from "uuid";
import { format, parseISO, addHours, addMinutes, differenceInMilliseconds } from 'date-fns';
import { WebSocketServer, WebSocket } from "ws";
import { adminRoutes } from "./admin";
import { 
  createSuperAdmin, 
  seedRoles,
  fixAdminPassword,
} from "./controllers/admin-controller";
import * as bolOcr from "./routes/bol-ocr.mjs";
import * as bolUploadSecure from "./routes/bol-upload-secure.mjs";
import * as bolUpload from "./routes/bol-upload.mjs";
import { startReminderScheduler } from "./reminders";
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

// Define WebSocket client interface
interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
}

export function registerRoutes(app: Express): Server {
  // Get storage instance
  const storage = getStorage();
  
  // Setup authentication routes
  setupAuth(app);
  
  // Run super-admin creation script
  try {
    console.log("Running create-super-admin script...");
    createSuperAdmin().catch(error => {
      console.error("Error running super-admin creation script:", error);
    });
    console.log("Super-admin creation script started");
  } catch (error) {
    console.error("Error starting super-admin creation script:", error);
  }
  
  // Seed roles
  try {
    console.log("Running seed-roles script...");
    seedRoles().catch(error => {
      console.error("Error seeding roles:", error);
    });
    console.log("Roles seeding started");
  } catch (error) {
    console.error("Error starting roles seeding:", error);
  }
  
  // Fix admin password
  try {
    console.log("Running fix-admin-password script...");
    fixAdminPassword().catch(error => {
      console.error("Error fixing admin password:", error);
    });
    console.log("Admin password fix started");
  } catch (error) {
    console.error("Error starting admin password fix:", error);
  }
  
  // Register admin routes
  adminRoutes(app);
  
  // Set up BOL OCR routes
  bolOcr.setupRoutes(app);
  
  // Set up secure BOL upload routes with tenant isolation
  bolUploadSecure.setupRoutes(app);
  
  // Set up BOL upload routes (legacy)
  bolUpload.setupRoutes(app);

  // API Health check
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // TEMPORARILY DISABLED WEBSOCKET INITIALIZATION - TO BE RE-INTEGRATED AFTER SERVER BOOT WORKS
  // NOTE: WebSocket setup has been disabled to ensure server can start properly
  // TODO: Re-integrate WebSocket setup after fixing the async/await issues
  console.log('[WebSocket] WebSocket initialization temporarily disabled to ensure server startup');
  
  /* WebSocket functionality will be re-enabled in a future update
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  */
  
  // Temporary stubs for WebSocket test endpoints
  app.post('/api/test/websocket-broadcast', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    console.log('[WebSocket Test] WebSocket functionality temporarily disabled');
    res.status(200).json({ 
      success: false, 
      message: 'WebSocket functionality temporarily disabled' 
    });
  });
  
  app.post('/api/test/websocket-disconnect', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    console.log('[WebSocket Test] WebSocket functionality temporarily disabled');
    res.status(200).json({ 
      success: false, 
      message: 'WebSocket functionality temporarily disabled' 
    });
  });
  
  // Add a global function to broadcast schedule updates to relevant tenants
  // Set up broadcast function for schedule updates with secure tenant isolation
  // TEMPORARILY DISABLED: WebSocket functionality removed to fix server startup
  // This function will be properly reimplemented after server is stable
  app.locals.broadcastScheduleUpdate = (schedule: any) => {
    console.log(`[WebSocket] Broadcasting disabled - update for schedule ID: ${schedule.id} not sent`);
    return 0;
  };
  
  // Start the email reminder scheduler
  try {
    console.log("[ReminderScheduler] Initializing email reminder scheduler...");
    startReminderScheduler();
    console.log("[ReminderScheduler] Email reminder scheduler initialized successfully");
  } catch (error) {
    console.error("[ReminderScheduler] Error initializing email reminder scheduler:", error);
  }
  
  return httpServer;
}