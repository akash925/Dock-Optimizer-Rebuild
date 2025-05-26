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