/* -------------------------------------------------------------------------- */
/*  server/vite.ts – Vite dev-middleware + static-file handler for Replit     */
/* -------------------------------------------------------------------------- */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.js.js.js.js";
import { nanoid } from "nanoid";

/* ───────────────────────────── Helpers ──────────────────────────────────── */

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/* ───────────────────────────── Dev middleware ───────────────────────────── */

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as true, // Type assertion for ServerOptions compatibility
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg: any, opts: any) => {
        viteLogger.error(msg, opts);
        /* Hard-fail in Replit so we see the error immediately */
        process.exit(1);
      },
    },
  });

  // Inject Vite middlewares
  app.use(vite.middlewares);

  // HTML entry (always read fresh from disk)
  app.use("*", async (req: any, res: any, next: any) => {
    try {
      const url = req.originalUrl;
      const templatePath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)), // /server
        "..",
        "client",
        "index.html",
      );

      let html = await fs.promises.readFile(templatePath, "utf-8");
      // Bust cache for the dev entry
      html = html.replace(
        'src="/src/main.tsx"',
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const transformed = await vite.transformIndexHtml(url, html);
      res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}

/* ------------------------------------------------------------------ */
/*      Production static hosting                                     */
/* ------------------------------------------------------------------ */
export function serveStatic(app: Express) {
  // <repo-root>/dist/public  (output of `pnpm run build:client`)
  const distPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
    "public"
  );

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Static bundle not found at ${distPath}. Run "pnpm run build:client" first.`
    );
  }

  /* 1️⃣  Serve all static assets */
  app.use(express.static(distPath));

  /* 2️⃣  SPA fallback: send index.html for any unknown route */
  app.get("*", (_req: any, res: any) =>
    res.sendFile(path.join(distPath, "index.html"))
  );
}
