import { config } from "../config.js";

// Single shared-secret bearer token, checked on every /api request. Good
// enough for one trusted Mac on the LAN; swap for per-client tokens if more
// devices need independent revocation later.
export async function requireAuth(request, reply) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || token !== config.apiToken) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
