import Fastify from "fastify";

import { config } from "../config.js";
import { requireAuth } from "./auth.js";
import { registerRoutes } from "./routes.js";

// logger: false -- default fastify request logging would echo the
// Authorization header on every hit; keep the token out of logs entirely.
export function buildApiServer() {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", requireAuth);
  registerRoutes(app);
  return app;
}

export async function startApiServer() {
  const app = buildApiServer();
  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  console.log(`🌐 Music API listening on :${config.apiPort}`);
  return app;
}
