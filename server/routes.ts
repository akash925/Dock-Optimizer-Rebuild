import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Get storage instance
  const storage = getStorage();
  
  // Setup authentication routes
  setupAuth(app);
  
  // Basic API Health check
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  console.log("Basic server routes registered successfully");
  
  return httpServer;
}