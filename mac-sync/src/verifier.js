import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/**
 * Streams a file through SHA-256 in fixed-size chunks so multi-GB FLACs
 * never sit fully in memory. Mirrors src/music/hashing.js on the server --
 * separate packages, not worth a shared workspace for eight lines.
 */
export async function sha256File(filePath) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
