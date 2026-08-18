import fs from "node:fs";
import path from "node:path";

import { AuthError, getHealth } from "./api.js";
import { config } from "./config.js";
import { downloadAndVerify } from "./downloader.js";
import { fetchServerTracks } from "./manifest.js";
import { scanDirectory } from "./scanner.js";
import { sha256File } from "./verifier.js";

function checkEchoMini() {
  if (!fs.existsSync(config.echoMiniPath)) {
    console.error(`❌ Echo Mini path not found: ${config.echoMiniPath}`);
    console.error("Is it connected and mounted? Check ECHO_MINI_PATH in .env.");
    process.exit(1);
  }
  if (!fs.statSync(config.echoMiniPath).isDirectory()) {
    console.error(`❌ Not a directory: ${config.echoMiniPath}`);
    process.exit(1);
  }
}

async function checkServer() {
  try {
    await getHealth();
  } catch (error) {
    if (error instanceof AuthError) {
      console.error(`❌ ${error.message}`);
    } else {
      console.error(
        `❌ Cannot connect to music server.\n\nServer:\n${config.serverUrl}\n\n` +
          "Check that the server is running and reachable."
      );
    }
    if (config.debug) console.error(error);
    process.exit(1);
  }
}

// Additive-only diff against what's already on the Echo Mini: existing +
// matching size + matching hash => skip. Anything else is (re-)downloaded.
// Files present only on the Echo Mini are never touched.
export async function classify(serverTracks, echoFiles) {
  const toDownload = [];
  let skipped = 0;

  for (const track of serverTracks) {
    const existing = echoFiles.get(track.path);

    if (!existing) {
      toDownload.push({ track, reason: "new" });
    } else if (existing.size !== track.fileSize) {
      toDownload.push({ track, reason: "changed" });
    } else if ((await sha256File(existing.fullPath)) !== track.sha256) {
      toDownload.push({ track, reason: "changed" });
    } else {
      skipped++;
    }
  }

  return { toDownload, skipped };
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

async function main() {
  console.log("🎵 Echo Mini Sync\n");

  checkEchoMini();
  await checkServer();

  const serverTracks = await fetchServerTracks();
  console.log(`Server:\n  ${serverTracks.length} tracks\n`);

  const echoFiles = await scanDirectory(config.echoMiniPath);
  console.log(`Echo Mini:\n  ${echoFiles.size} tracks\n`);

  console.log("Checking...\n");
  const { toDownload, skipped } = await classify(serverTracks, echoFiles);
  const newCount = toDownload.filter((t) => t.reason === "new").length;
  const changedCount = toDownload.filter((t) => t.reason === "changed").length;

  console.log(`✓ ${skipped} already synchronized`);
  console.log(`↓ ${newCount} new track${newCount === 1 ? "" : "s"}`);
  console.log(`↻ ${changedCount} changed track${changedCount === 1 ? "" : "s"}\n`);

  if (toDownload.length === 0) {
    console.log("Sync complete. Nothing to do.");
    return;
  }

  console.log("Downloading:\n");
  let added = 0;
  let updated = 0;
  let failed = 0;
  let bytesDownloaded = 0;

  for (const [i, { track, reason }] of toDownload.entries()) {
    process.stdout.write(`[${i + 1}/${toDownload.length}] ${track.path} ... `);

    const destPath = path.join(config.echoMiniPath, track.path);
    try {
      await downloadAndVerify(track, destPath);
      bytesDownloaded += track.fileSize;
      if (reason === "new") added++;
      else updated++;
      console.log("✓");
    } catch (error) {
      failed++;
      console.log("❌");
      console.error(`   Failed: ${track.path}`);
      console.error(`   Reason: ${error.message}`);
    }
  }

  console.log(`\nVerifying...\n`);
  console.log(`✓ ${added + updated}/${toDownload.length} verified\n`);

  console.log(failed > 0 ? "Sync complete with errors.\n" : "Sync complete.\n");
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Downloaded: ${formatBytes(bytesDownloaded)}`);

  if (failed > 0) process.exitCode = 1;
}

// Only run when invoked directly (`npm run sync`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Unexpected error:", config.debug ? error : error.message);
    process.exitCode = 1;
  });
}
