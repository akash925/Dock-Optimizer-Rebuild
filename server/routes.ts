import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import passport from "passport";

export function registerRoutes(app: Express): Server {
  // Set up session store with PostgreSQL
  const PostgresStore = connectPg(session);
  
  // Configure session middleware
  const sessionConfig = {
    store: new PostgresStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'dock.sid',
    secret: process.env.SESSION_SECRET || 'dock-optimizer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
      // Removed problematic sameSite option
    }
  };
  
  // Apply session middleware to the main app
  app.use(session(sessionConfig));
  
  // Initialize passport middleware on the main app
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Create a dedicated API router that will handle ALL API routes
  const apiRouter = express.Router();
  
  // Add middleware to set proper Content-Type for all API routes
  apiRouter.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });
  
  // Get storage instance
  const storage = getStorage();
  
  // Setup authentication routes on the API router
  setupAuth(apiRouter);
  
  // Basic API Health check
  apiRouter.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Mount the API router BEFORE Vite middleware
  // This ensures API routes take precedence over frontend routes
  app.use('/api', apiRouter);
  
  // Add a fallback for all unmatched API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: "API endpoint not found",
      path: req.originalUrl 
    });
  });
  
  console.log("API routes registered with higher priority than Vite middleware");
  
  return httpServer;
}