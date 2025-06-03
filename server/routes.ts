import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import path from "path";
import { WebSocketServer } from "ws";

// Type for the WebSocket client with tenant metadata
interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
}

/**
 * Register routes for the application
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Get storage instance
  const storage = await getStorage();
  
  // Setup authentication routes
  setupAuth(app);
  
  // Core API routes that frontend expects
  app.get('/api/users', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const users = await storage.getUsers();
      
      // Filter users by tenant ID for proper tenant isolation
      const tenantUsers = users.filter(user => user.tenantId === currentUser.tenantId);
      
      // Remove password field for security
      const safeUsers = tenantUsers.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Appointment types endpoint
  app.get('/api/appointment-types', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const appointmentTypes = await storage.getAppointmentTypes();
      
      // Filter appointment types by tenant ID for proper tenant isolation
      const tenantAppointmentTypes = appointmentTypes.filter(type => type.tenantId === currentUser.tenantId);
      
      res.json(tenantAppointmentTypes);
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      res.status(500).json({ error: 'Failed to fetch appointment types' });
    }
  });
  
  // Booking pages endpoint
  app.get('/api/booking-pages', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const bookingPages = await storage.getBookingPages();
      
      // Filter booking pages by tenant ID for proper tenant isolation
      const tenantBookingPages = bookingPages.filter(page => page.tenantId === currentUser.tenantId);
      
      res.json(tenantBookingPages);
    } catch (error) {
      console.error('Error fetching booking pages:', error);
      res.status(500).json({ error: 'Failed to fetch booking pages' });
    }
  });
  
  // Docks endpoint
  app.get('/api/docks', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const docks = await storage.getDocks();
      
      // Filter docks by tenant ID through facility association
      const facilities = await storage.getFacilities();
      const tenantFacilities = facilities.filter(facility => facility.tenantId === currentUser.tenantId);
      const tenantFacilityIds = tenantFacilities.map(facility => facility.id);
      
      const tenantDocks = docks.filter(dock => tenantFacilityIds.includes(dock.facilityId));
      
      res.json(tenantDocks);
    } catch (error) {
      console.error('Error fetching docks:', error);
      res.status(500).json({ error: 'Failed to fetch docks' });
    }
  });
  
  // Create user with invitation email
  app.post('/api/users', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { email, firstName, lastName, role = 'worker' } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ error: 'Email, firstName, and lastName are required' });
      }
      
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Create user with proper tenant ID
      const currentUser = req.user;
      const newUser = await storage.createUser({
        username: email,
        email,
        firstName,
        lastName,
        role,
        password: tempPassword, // This will be hashed in storage
        tenantId: currentUser.tenantId // Assign to same tenant as creator
      });
      
      // Send invitation email if SendGrid is configured
      if (process.env.SENDGRID_API_KEY) {
        try {
          const { sendUserInvitationEmail } = require('./services/email');
          const currentUser = req.user;
          const inviterName = `${currentUser.firstName} ${currentUser.lastName}`;
          const organizationName = 'Dock Optimizer'; // Could be dynamic based on tenant
          
          await sendUserInvitationEmail(email, tempPassword, organizationName, inviterName);
          console.log(`Invitation email sent to ${email}`);
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Don't fail the user creation if email fails
        }
      }
      
      // Remove password from response
      const { password, ...safeUser } = newUser;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });
  
  // Create the HTTP server
  const httpServer = createServer(app);
  
  // Create a WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Handle WebSocket connections
  wss.on('connection', (ws: TenantWebSocket) => {
    console.log('WebSocket client connected');
    
    // Set up ping interval for this connection
    ws.isAlive = true;
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        // Log the received message for debugging
        console.log(`Received message: ${message}`);
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Set up regular pings to keep connections alive
  setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const tenantWs = ws as TenantWebSocket;
      
      if (tenantWs.isAlive === false) {
        console.log('Terminating inactive WebSocket client');
        return tenantWs.terminate();
      }
      
      tenantWs.isAlive = false;
      tenantWs.ping();
    });
  }, 30000); // Check every 30 seconds
  
  console.log('Core routes registered successfully');
  
  return httpServer;
}