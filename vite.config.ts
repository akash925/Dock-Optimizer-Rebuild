/**
 * repo-root/vite.config.ts
 * – Works inside Replit OR on a local laptop
 * – Lets any *.replit.dev host through (fixes 403 / blocked-host)
 * – Proxies   /api/*  and  /ws  to the Node server on :5001
 * – Uses polling-watch so Replit’s inotify limit is never hit
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isReplit   = Boolean(process.env.REPL_ID);

export default defineConfig(async () => {
  /* ---------------- plugins ---------------- */
  const plugins = [react()];

  if (isReplit) {
    for (const pkg of [
      "@replit/vite-plugin-runtime-error-modal",
      "@replit/vite-plugin-shadcn-theme-json",
      "@replit/vite-plugin-cartographer",
    ]) {
      try {
        const mod     = await import(pkg);
        const factory = mod.default ?? mod.cartographer;
        if (typeof factory === "function") plugins.push(factory());
      } catch {
        /* silently skip optional plugin */
      }
    }
  }

  /* ---------------- config ----------------- */
  return {
    plugins,

    /* Monorepo folder layout */
    root: path.resolve(__dirname, "client"),
    resolve: {
      alias: {
        "@":       path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },

    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },

    /* Dev-server */
    server: {
      host: "0.0.0.0",
      port: 5173,

      /** allow every *.replit.dev sub-domain (fixes 403) */
      allowedHosts: "all",

      /** proxy API & WebSocket traffic to Express on :5001 */
      proxy: {
        "/api": { target: "http://localhost:5001", changeOrigin: true },
        "/ws":  { target: "ws://localhost:5001",  ws: true },
      },

      /** use polling so file-watcher survives Replit’s low inotify limits */
      watch: {
        usePolling: true,
        ignored: ["**/.pnpm/**", "**/.local/**", "**/node_modules/**"],
      },

      /** Replit needs WSS-based HMR; everywhere else use normal WS */
      hmr: isReplit
        ? {
            protocol: "wss",
            host: new URL(import.meta.url).hostname,
            port: 443,
          }
        : true,
    },

    logLevel: "error",
  };
});
