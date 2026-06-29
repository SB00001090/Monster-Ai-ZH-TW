import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { loadForumStore } from "./forumStore";
import { loadPersistentStore } from "./persistentStore";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await Promise.all([loadPersistentStore(), loadForumStore()]);

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const apiOnly = process.env.API_ONLY === "1";

  // Split dev (pnpm dev): Vite runs separately on :5173; API serves tRPC only.
  // API_ONLY=1 (run.bat launcher): tRPC/oauth only — UI served by Python :7860.
  if (
    !apiOnly &&
    process.env.NODE_ENV === "development" &&
    process.env.EMBED_VITE === "true"
  ) {
    await setupVite(app, server);
  } else if (!apiOnly && process.env.NODE_ENV !== "development") {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  let port = preferredPort;

  if (apiOnly) {
    if (!(await isPortAvailable(preferredPort))) {
      // Launcher should reuse a healthy API; this is a last-resort guard.
      console.error(
        `Port ${preferredPort} is in use. Close other Monster AI / pnpm dev windows, run scripts\\stop-dev.bat, then run run.bat again.`
      );
      process.exit(1);
    }
  } else {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
