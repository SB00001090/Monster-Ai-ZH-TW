import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api/trpc": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/api/oauth": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/monster-storage": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:7860",
        changeOrigin: true,
      },
      "/downloads": {
        target: "http://127.0.0.1:7860",
        changeOrigin: true,
      },
      "/monsterai-security.html": {
        target: "http://127.0.0.1:7860",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:7860",
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});