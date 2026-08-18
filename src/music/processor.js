import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import fsSync, { watch } from "node:fs";
import path from "node:path";

import { config } from "../config.js";
import {
  findTrackBySha256,
  insertJob,
  insertTrack,
  updateJob,
} from "../database/database.js";
import { saveArtwork } from "./artwork.js";
import { sha256File } from "./hashing.js";
import { readFlacMetadata } from "./metadata.js";
import { buildDestination, missingRequiredFields } from "./organizer.js";

// Decoupled from bot.js on purpose: the processor only emits events, it
// never talks to Telegram. index.js wires the two together.
export const events = new EventEmitter();

const STABLE_CHECK_DELAY_MS = 1500;

// ponytail: naive "stat twice, size/mtime unchanged" stability check instead
// of a lock file or inotify close-write event. Good enough for a single
// downloader writing one file at a time; revisit if inbox writers ever
// pause mid-stream for longer than STABLE_CHECK_DELAY_MS.
async function isFileStable(filePath) {
  const before = await fs.stat(filePath).catch(() => null);
  if (!before) return false;

  await new Promise((resolve) => setTimeout(resolve, STABLE_CHECK_DELAY_MS));

  const after = await fs.stat(filePath).catch(() => null);
  if (!after) return false;

  return before.size === after.size && before.mtimeMs === after.mtimeMs;
}

// Same filesystem (the common case -- inbox/library/problematic all live
// under one bind mount): atomic rename, source is gone the instant this
// returns. Different filesystem: copy, verify against the hash we already
// computed, and let the caller delete the source only after the DB write
// commits, so a crash mid-copy never loses the original or fakes a
// completed row.
async function moveIntoPlace(src, dest, knownSha256) {
  try {
    await fs.rename(src, dest);
    return { atomically: true };
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
  }

  await fs.copyFile(src, dest);
  const destHash = await sha256File(dest);
  if (destHash !== knownSha256) {
    await fs.unlink(dest).catch(() => {});
    throw new Error("Copy verification failed: hash mismatch");
  }

  return { atomically: false };
}

function logProcessing(filename, sha256, meta) {
  console.log(
    `\n🎵 Processing: ${filename}\n` +
      `Artist: ${meta.artist ?? "-"} | Album: ${meta.album ?? "-"} | Title: ${
        meta.title ?? "-"
      }\n` +
      `FLAC ${meta.bitsPerSample ?? "?"}-bit / ${
        meta.sampleRate ? (meta.sampleRate / 1000).toFixed(1) + " kHz" : "?"
      } / ${meta.channels ?? "?"}ch\n` +
      `SHA256: ${sha256}`
  );
}

async function processFile(filePath) {
  const filename = path.basename(filePath);
  const jobId = insertJob(filePath);

  try {
    const sha256 = await sha256File(filePath);
    const meta = await readFlacMetadata(filePath);
    logProcessing(filename, sha256, meta);

    const existing = findTrackBySha256(sha256);
    if (existing) {
      await fs.unlink(filePath);
      updateJob(jobId, {
        status: "duplicate",
        error: `Already in library at ${existing.path}`,
      });
      events.emit("duplicate", { filename, meta, existingPath: existing.path });
      return;
    }

    const missing = missingRequiredFields(meta);
    if (missing.length > 0) {
      const dest = path.join(config.problematicDir, "missing-metadata", filename);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const { atomically } = await moveIntoPlace(filePath, dest, sha256);
      if (!atomically) {
        await fs.unlink(filePath).catch(() => {});
      }
      updateJob(jobId, {
        status: "failed",
        error: `Missing metadata: ${missing.join(", ")}`,
      });
      events.emit("problematic", { filename, missing, destPath: dest });
      return;
    }

    const stat = await fs.stat(filePath);
    const { dir, albumDir, filePath: destPath, artistSegment, albumSegment } =
      buildDestination(meta, config.libraryDir);

    await fs.mkdir(dir, { recursive: true });
    const { atomically } = await moveIntoPlace(filePath, destPath, sha256);

    const artworkPath = meta.picture
      ? await saveArtwork(meta.picture, albumDir)
      : null;

    insertTrack({
      sha256,
      path: destPath,
      filename: path.basename(destPath),
      artist: meta.artist,
      album: meta.album,
      albumArtist: meta.albumArtist,
      title: meta.title,
      trackNumber: meta.trackNumber,
      discNumber: meta.discNumber,
      year: meta.year,
      genre: meta.genre,
      duration: meta.duration,
      sampleRate: meta.sampleRate,
      bitDepth: meta.bitsPerSample,
      channels: meta.channels,
      fileSize: stat.size,
    });

    updateJob(jobId, { status: "completed" });

    if (!atomically) {
      await fs.unlink(filePath).catch(() => {});
    }

    console.log(`✅ Added: ${artistSegment}/${albumSegment}/${path.basename(destPath)}`);
    events.emit("added", { meta, destPath, artistSegment, albumSegment, artworkPath });
  } catch (error) {
    updateJob(jobId, { status: "failed", error: error.message });
    console.error(`❌ Failed to process ${filename}:`, error.message);
    events.emit("failed", { filename, error });
  }
}

let scanning = false;

// ponytail: single in-process boolean lock. There's only ever one Node
// process touching the inbox, so this is enough to stop the watcher and a
// manual `npm run process` from racing each other; add real locking if the
// processor ever runs as more than one process.
export async function scanInboxOnce() {
  if (scanning) return;
  scanning = true;

  try {
    await fs.mkdir(config.inboxDir, { recursive: true });
    const entries = await fs.readdir(config.inboxDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".flac")) continue;

      const filePath = path.join(config.inboxDir, entry.name);
      if (!(await isFileStable(filePath))) continue; // still downloading, catch it next scan

      await processFile(filePath);
    }
  } finally {
    scanning = false;
  }
}

export function watchInbox() {
  // On a fresh deployment /music/inbox doesn't exist until the bot saves its
  // first file -- fs.watch() throws synchronously on a missing path.
  fsSync.mkdirSync(config.inboxDir, { recursive: true });

  let timer = null;
  const triggerScan = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      scanInboxOnce().catch((error) =>
        console.error("❌ Inbox scan failed:", error)
      );
    }, 1000);
  };

  const watcher = watch(config.inboxDir, triggerScan);
  watcher.on("error", (error) => console.error("❌ Inbox watcher error:", error));
  return watcher;
}
