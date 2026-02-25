import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/routers/_app";
import { createContext } from "./trpc/context";
import { corsMiddleware } from "./middleware/cors";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const app = new Hono();

// Middleware
app.use("*", corsMiddleware);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Local file serving for development
if (process.env.DYNAMODB_ENDPOINT) {
  app.get("/uploads/*", async (c) => {
    const filePath = join(process.cwd(), ".local", c.req.path);
    try {
      const file = await readFile(filePath);
      return c.body(file);
    } catch {
      return c.notFound();
    }
  });
}

// tRPC
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  }),
);

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export { app, appRouter };
