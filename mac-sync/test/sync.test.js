import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.MUSIC_SERVER_URL = "http://127.0.0.1:1"; // unused by classify()
process.env.MUSIC_API_TOKEN = "secret";
process.env.ECHO_MINI_PATH = "/tmp";

const { classify } = await import("../src/sync.js");
const { sha256File } = await import("../src/verifier.js");

test("classify separates new, changed, and already-synced tracks", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echo-mini-"));

  const matchingPath = path.join(dir, "matching.flac");
  await fs.writeFile(matchingPath, "same bytes");
  const matchingHash = await sha256File(matchingPath);

  const staleHashPath = path.join(dir, "stale-hash.flac");
  await fs.writeFile(staleHashPath, "same size!"); // 10 bytes, wrong content

  const serverTracks = [
    { path: "new.flac", sha256: "whatever", fileSize: 5 },
    { path: "wrong-size.flac", sha256: "whatever", fileSize: 999 },
    { path: "stale-hash.flac", sha256: "0123456789abcdef", fileSize: 10 },
    { path: "matching.flac", sha256: matchingHash, fileSize: "same bytes".length },
  ];

  const echoFiles = new Map([
    ["wrong-size.flac", { fullPath: matchingPath, size: 3 }],
    ["stale-hash.flac", { fullPath: staleHashPath, size: 10 }],
    ["matching.flac", { fullPath: matchingPath, size: "same bytes".length }],
  ]);

  const { toDownload, skipped } = await classify(serverTracks, echoFiles);

  assert.equal(skipped, 1);
  assert.deepEqual(
    toDownload.map((t) => [t.track.path, t.reason]).sort(),
    [
      ["new.flac", "new"],
      ["stale-hash.flac", "changed"],
      ["wrong-size.flac", "changed"],
    ]
  );
});
