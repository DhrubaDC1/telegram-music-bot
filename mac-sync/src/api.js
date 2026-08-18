import { config } from "./config.js";

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export class AuthError extends Error {}
export class ConnectionError extends Error {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shared GET path for every endpoint. `raw: true` returns the fetch Response
// itself (for streaming downloads); otherwise the parsed JSON body.
async function get(urlPath, { raw = false } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${config.serverUrl}${urlPath}`, {
        headers: { Authorization: `Bearer ${config.apiToken}` },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 401) {
        throw new AuthError("Authentication failed (check MUSIC_API_TOKEN)");
      }
      if (!res.ok) {
        throw new Error(`Server returned ${res.status} ${res.statusText}`);
      }

      return raw ? res : res.json();
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof AuthError) throw error; // wrong token won't fix itself on retry

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
    }
  }

  throw new ConnectionError(lastError.message);
}

export function getHealth() {
  return get("/api/health");
}

export function getManifest() {
  return get("/api/sync/manifest");
}

export function getTrack(id) {
  return get(`/api/tracks/${id}`);
}

export function downloadTrack(id) {
  return get(`/api/tracks/${id}/download`, { raw: true });
}

export function getArtwork(id) {
  return get(`/api/tracks/${id}/artwork`, { raw: true });
}
