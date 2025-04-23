import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";

// Check if Asset Manager module is enabled
const ENABLE_ASSET_MANAGER = process.env.ENABLE_ASSET_MANAGER === 'true';
// Get list of enabled modules from environment variable
const ENABLED_MODULES = (process.env.ENABLED_MODULES || '').split(',').filter(Boolean);

console.log(`Asset Manager module is ${ENABLE_ASSET_MANAGER ? 'enabled' : 'disabled'}`);
console.log(`Enabled modules: ${ENABLED_MODULES.length ? ENABLED_MODULES.join(', ') : 'none'}`);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register core routes
  const server = await registerRoutes(app);
  
  // Conditionally load the Asset Manager module
  if (ENABLE_ASSET_MANAGER || ENABLED_MODULES.includes('assetManager')) {
    console.log('Loading Asset Manager module...');
    try {
      const { router } = await import('./modules/assetManager/routes');
      app.use('/api', router);
      console.log('Asset Manager module loaded successfully');
    } catch (error) {
      console.error('Failed to load Asset Manager module:', error);
    }
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
