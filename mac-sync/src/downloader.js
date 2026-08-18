import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { downloadTrack } from "./api.js";
import { sha256File } from "./verifier.js";

/**
 * Streams a track to `<destPath>.part`, verifies its hash against the
 * manifest, then renames into place. Never leaves a `.part` pretending to be
 * a finished file -- on any failure it's deleted before the error propagates.
 */
export async function downloadAndVerify(track, destPath) {
  const partPath = `${destPath}.part`;
  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  try {
    const res = await downloadTrack(track.id);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partPath));

    const hash = await sha256File(partPath);
    if (hash !== track.sha256) {
      throw new Error(
        `hash mismatch (expected ${track.sha256.slice(0, 8)}…, got ${hash.slice(0, 8)}…)`
      );
    }

    await fsp.rename(partPath, destPath);
  } catch (error) {
    await fsp.unlink(partPath).catch(() => {});
    throw error;
  }
}
