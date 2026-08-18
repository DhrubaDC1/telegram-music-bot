import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Streams the file through SHA-256 in fixed-size chunks so multi-GB FLACs
 * never sit fully in memory.
 */
export async function sha256File(filePath) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
