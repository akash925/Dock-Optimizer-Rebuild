
/**
 * vite.config.ts – Replit‑safe (final)
 * --------------------------------------------------
 * Memory‑friendly build + correct syntax
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isReplit = Boolean(process.env.REPL_ID);
const isProd = process.env.NODE_ENV === "production"; // ✅ OUTSIDE return

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
      // NB: suppresses undefined destructure if plugin missing
      const mod: any = await import(p);
      const factory = mod?.default ?? mod?.cartographer;
      if (typeof factory === "function") plugs.push(factory());
    } catch {
      /* optional plugin not installed – ignore */
    }
  }
  return plugs;
}

export default defineConfig(async () => ({
  plugins: [react(), ...(await replitPlugins())],
  logLevel: "error",

  // ───── Project layout & aliases ─────
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@":            path.resolve(__dirname, "client/src"),
      "@components":  path.resolve(__dirname, "client/src/components"),
      "@pages":       path.resolve(__dirname, "client/src/pages"),
      "@lib":         path.resolve(__dirname, "client/src/lib"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      "/src": path.resolve(__dirname, "client/src"),
    },
  },

  // ───── Build – low‑memory tweaks ─────
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: isProd ? false : "inline",
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            return id.split("node_modules/")[1].split("/")[0];
          }
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 1600,
  },

  // ───── Dev‑server ─────
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:5001", changeOrigin: true },
      "/ws": { target: "ws://localhost:5001", ws: true, changeOrigin: true },
    },
    watch: watchSettings,
    hmr: isReplit ? { protocol: "wss", port: 443 } : true,
  },
}));
