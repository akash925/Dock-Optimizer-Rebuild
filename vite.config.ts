/// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Utility: load an optional plugin if it’s installed ---------------------- */
async function maybeLoad(pkg: string) {
  try {
    const mod = await import(pkg);
    const factory = mod.default ?? mod.cartographer; // cartographer exports `cartographer()`
    return typeof factory === "function" ? factory() : undefined;
  } catch {
    console.warn(`[vite] Optional plugin "${pkg}" not found – skipping`);
    return undefined;
  }
}

export default defineConfig(async () => {
  const plugins = [react()];

  /* Detect Replit --------------------------------------------------------- */
  const isReplit = Boolean(process.env.REPL_ID);
  if (isReplit) {
    for (const pkg of [
      "@replit/vite-plugin-runtime-error-modal",
      "@replit/vite-plugin-shadcn-theme-json",
      "@replit/vite-plugin-cartographer",
    ]) {
      const maybe = await maybeLoad(pkg);
      if (maybe) plugins.push(maybe);
    }
  }

  /* ---------------------------------------------------------------------- */
  return {
    plugins,

    /* ------------------------------ Aliases ------------------------------ */
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },

    /* ----------------------- Monorepo sub-folder ------------------------- */
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },

    /* ----------------------- Dev-server / HMR --------------------------- */
    server: {
      host: "0.0.0.0",
      port: 5173,

      // ⬇ **The fix:** tell chokidar to ignore heavy dirs everywhere
      //    (Vite passes this straight to chokidar).           :contentReference[oaicite:1]{index=1}
      watch: {
        ignored: ["**/.pnpm/**", "**/.local/**", "**/node_modules/**"],
      },

      hmr: isReplit
        ? {
            protocol: "wss",
            host: new URL(import.meta.url).hostname,
            port: 443,
          }
        : true,
    },
  };
});
