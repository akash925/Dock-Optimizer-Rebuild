// CRITICAL: Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import bookingPages from "./bookingPages";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { tenantMiddleware } from "./middleware/tenant";

// Default system modules (always loaded)
const SYSTEM_MODULES = ["tenants", "featureFlags", "modules", "organizations", "admin"];

// Tenant-specific modules (loaded based on tenant configuration)
const AVAILABLE_MODULES = [
  "assetManager",
  "calendar",
  "analytics",
  "bookingPages",
  "emailNotifications",
];

// Check if Asset Manager module is enabled globally (legacy support)
const ENABLE_ASSET_MANAGER = process.env.ENABLE_ASSET_MANAGER === "true";

// Get list of enabled modules from environment variable (legacy support)
const ENABLED_MODULES = (process.env.ENABLED_MODULES || "")
  .split(",")
  .filter(Boolean);

// FIXED: Make Asset Manager available by default so organizations can choose to enable it
// This makes the module available as an option, but doesn't force it on all orgs
const MAKE_ASSET_MANAGER_AVAILABLE = true;

// Log enabled modules for backward compatibility
console.log(
  `Asset Manager module is ${(ENABLE_ASSET_MANAGER || MAKE_ASSET_MANAGER_AVAILABLE) ? "available" : "disabled"}`,
);
console.log(
  `Enabled modules: ${ENABLED_MODULES.length ? ENABLED_MODULES.join(", ") : "none"}`,
);

import bookingPublicRouter from "./routes/public/booking"; // Adjust path if needed

const app = express();
// Increase JSON payload size limit to 5MB for logo uploads
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use("/api", bookingPublicRouter);

// Add tenant identification middleware
app.use(tenantMiddleware);

// Serve files from the uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

  // First, load system modules (tenant management and feature flags)
  for (const moduleName of SYSTEM_MODULES) {
    console.log(`Loading system module: ${moduleName}...`);
    try {
      const modulePath = `./modules/${moduleName}/index`;
      const module = await import(modulePath);
      if (module.default && typeof module.default.initialize === "function") {
        module.default.initialize(app);
      } else {
        console.warn(
          `Module ${moduleName} doesn't have a valid initialize function`,
        );
      }
    } catch (error) {
      console.error(`Failed to load system module ${moduleName}:`, error);
    }
  }

  // Load tenant-specific enabled modules
  // For backward compatibility, load modules from environment
  const modulesToLoad = [...ENABLED_MODULES];
  if ((ENABLE_ASSET_MANAGER || MAKE_ASSET_MANAGER_AVAILABLE) && !modulesToLoad.includes("assetManager")) {
    modulesToLoad.push("assetManager");
  }

  // Add facility management module to ensure API routes are available
  modulesToLoad.push("facilityManagement");
  
  // CRITICAL: Add calendar module to ensure tenant-filtered schedules endpoint is available
  modulesToLoad.push("calendar");

  // Load modules based on legacy configuration
  for (const moduleName of modulesToLoad) {
    console.log(`Loading ${moduleName} module...`);
    try {
      const modulePath = `./modules/${moduleName}/index`;
      const module = await import(modulePath);
      if (module.default && typeof module.default.initialize === "function") {
        module.default.initialize(app);
      } else {
        console.warn(
          `Module ${moduleName} doesn't have a valid initialize function`,
        );
      }
    } catch (error) {
      console.error(`Failed to load ${moduleName} module:`, error);
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

  // Serve the app on port 5000 (or PORT env var for flexibility)
  // this serves both the API and the client.
  // Port 5000 is the standard for Replit deployment.
  const port = process.env.PORT || 5000;
  server.listen(
    {
      port,
      host: process.env.NODE_ENV === "development" ? "localhost" : "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
