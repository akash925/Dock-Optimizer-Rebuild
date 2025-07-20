/**
 * vite.config.ts – Replit‑safe (v4)
 * --------------------------------------------------
 * • Consolidates earlier edits (removes duplicate block that referenced
 *   an undefined `allowedHosts`).
 * • `allowedHosts: true` (works in Vite ≥5.4).
 * • Adds alias "/src" → client/src so absolute imports in index.html work.
 * • Polling watcher keeps ENOSPC away.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isReplit = Boolean(process.env.REPL_ID);

// Dev‑server watcher tuning
const watchSettings = {
  usePolling: true,
  interval: 300,
  ignored: ["**/.pnpm/**", "**/.local/**", "**/node_modules/**"],
};

async function replitPlugins() {
  if (!isReplit) return [];
  const pkgs = [
    "@replit/vite-plugin-runtime-error-modal",
    "@replit/vite-plugin-shadcn-theme-json",
    "@replit/vite-plugin-cartographer",
  ];
  const plugs = [];
  for (const p of pkgs) {
    try {
      const mod = await import(p);
      const factory = mod.default ?? mod.cartographer;
      if (typeof factory === "function") plugs.push(factory());
    } catch {
      /* optional – skip */
    }
  }
  return plugs;
}

export default defineConfig(async () => {
  const plugins = [react(), ...(await replitPlugins())];

  return {
    plugins,
    logLevel: "error",

    // ───── Project layout & aliases ─────
    root: path.resolve(__dirname, "client"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
        "/src": path.resolve(__dirname, "client/src"), // absolute import fix
      },
    },

    // ───── Build ─────
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: true,
    },

    // ───── Dev‑server ─────
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: true,

      proxy: {
        "/api": {
          target: "http://localhost:5001",
          changeOrigin: true,
          secure: false,
        },
        "/ws": { target: "ws://localhost:5001", ws: true, changeOrigin: true },
      },

      watch: watchSettings,

      hmr: isReplit ? { protocol: "wss", port: 443 } : true,
    },
  };
});
