// server/index.ts — Dock Optimizer (launch‑ready)
// =================================================
// • Express API, WebSocket gateway and (optionally) Vite dev‑middleware live here.
// • Set SKIP_INTERNAL_VITE=1 when you already run an external `vite` process.
// • Dynamic module‑loader restored → /api/facilities, /api/booking‑pages … work again.
// • Redis hardened, global JSON error handler, concise request logging.

import express, { Request, Response, NextFunction } from "express";
import path               from "node:path";
import { fileURLToPath }  from "node:url";

import { registerRoutes }      from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { tenantMiddleware }    from "./middleware/tenant";
import { initializeWebSocket } from "./websocket/index";
import bookingPublicRouter     from "./routes/public/booking";

// ────────────────────────────────────────────────────────────────────────────
// 1.  Environment sanity checks
// --------------------------------------------------------------------------

const criticalEnvVars = ["DATABASE_URL", "SENDGRID_API_KEY"];
const optionalEnvVars = [
  "AWS_S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
];

const missingCrit = criticalEnvVars.filter((v) => !process.env[v]);
if (missingCrit.length) {
  console.error(`❌ Missing critical env vars: ${missingCrit.join(", ")}`);
  process.exit(1);
}

if (optionalEnvVars.some((v) => !process.env[v])) {
  console.warn("⚠️  AWS / S3 not fully configured → uploads will be local only");
}

// Redis startup resilience
process.env.REDIS_ENABLE_OFFLINE_QUEUE ??= "true";

// Flag to disable internal Vite when using an external one
const SKIP_INTERNAL_VITE = process.env.SKIP_INTERNAL_VITE === "1";

// ────────────────────────────────────────────────────────────────────────────
// 2.  Express bootstrap
// --------------------------------------------------------------------------

const app = express();
export { app };              // tests
export default app;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use("/api", bookingPublicRouter);
app.use(tenantMiddleware);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Concise per‑request log
app.use((req, res, next) => {
  const start = Date.now();
  let body: unknown;
  const origJson = res.json;
  // eslint‑disable‑next‑line @typescript-eslint/ban-ts-comment
  // @ts‑ignore – override type safely
  res.json = function (payload: unknown, ...args) {
    body = payload;
    return origJson.call(this, payload, ...args);
  } as typeof res.json;
  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    const ms = Date.now() - start;
    let line = `${req.method} ${req.path} ${res.statusCode} in ${ms}ms`;
    if (body) line += ` :: ${JSON.stringify(body).slice(0, 100)}`;
    log(line);
  });
  next();
});

// ────────────────────────────────────────────────────────────────────────────
// 3.  Dynamic module configuration                                          
// --------------------------------------------------------------------------

const SYSTEM_MODULES = [
  "tenants",
  "featureFlags",
  "modules",
  "organizations",
  "admin",
];

const AVAILABLE_MODULES = [
  "companyAssets",
  "calendar",
  "analytics",
  "bookingPages",
  "emailNotifications",
  "facilityManagement",
];

// Feature‑flag style env vars (legacy support)
const ENABLED_MODULES = (process.env.ENABLED_MODULES || "").split(",").filter(Boolean);
const ENABLE_ASSET_MANAGER = process.env.ENABLE_ASSET_MANAGER === "true";

// ensure essential UI routes always exist
const essentialModules = ["facilityManagement", "calendar", "analytics"];

function buildModuleList() {
  const set = new Set<string>();
  ENABLED_MODULES.forEach((m) => set.add(m));
  essentialModules.forEach((m) => set.add(m));
  if (ENABLE_ASSET_MANAGER) set.add("companyAssets");
  return Array.from(set);
}

async function loadModules(mods: string[], appRef: express.Express) {
  let ok = 0, fail = 0;
  for (const name of mods) {
    try {
      const { default: mod } = await import(`./modules/${name}/index`);
      if (mod?.initialize) {
        await mod.initialize(appRef);
        console.log(`✅ ${name} module loaded`);
        ok++;
      } else {
        console.warn(`⚠️  ${name} missing initialize()`);
        fail++;
      }
    } catch (err) {
      console.error(`❌ Failed to load ${name}:`, err);
      fail++;
    }
  }
  console.log(`📊 Module loading complete → ${ok} ok, ${fail} skipped`);
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  Async bootstrap (routes, modules, ws, vite, server)                    
// --------------------------------------------------------------------------

(async () => {
  const server = await registerRoutes(app); // auth & base API

  // Load core + tenant modules
  await loadModules([...SYSTEM_MODULES, ...buildModuleList()], app);

  // WebSocket layer needs storage
  try {
    const { getStorage } = await import("./storage");
    initializeWebSocket(server, await getStorage());
    console.log("✅ WebSocket ready");
  } catch (e) {
    console.error("❌ WebSocket init failed", e);
  }

  // Vite dev‑middleware (unless external)
  if (app.get("env") === "development" && !SKIP_INTERNAL_VITE) {
    await setupVite(app, server);
  } else if (app.get("env") === "production") {
    serveStatic(app);
  }

  // JSON error guard
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const PORT = Number(process.env.PORT || 5001);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[express] 🔧 Listening on ${PORT} (${app.get("env")})`);
  });
})();

// Hard exits on fatal errors
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

console.log("🚀 Dock Optimizer API bootstrap complete");
