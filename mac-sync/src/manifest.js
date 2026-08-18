import { getManifest } from "./api.js";

// Thin wrapper so sync.js depends on "the server's track list" rather than
// the HTTP shape directly.
export async function fetchServerTracks() {
  const manifest = await getManifest();
  return manifest.tracks; // [{ id, path, sha256, fileSize }]
}
