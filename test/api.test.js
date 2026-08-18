import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Config reads these from the environment at import time, so they must be
// set before anything under src/ is imported.
process.env.BOT_TOKEN = "test-token";
process.env.ALLOWED_USER_ID = "1";
process.env.MUSIC_API_TOKEN = "secret";
process.env.MUSIC_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "music-api-"));

const { buildApiServer } = await import("../src/api/server.js");
const { insertTrack } = await import("../src/database/database.js");
const { config } = await import("../src/config.js");

test("rejects requests without a valid bearer token", async (t) => {
  const app = buildApiServer();
  t.after(() => app.close());

  const noAuth = await app.inject({ method: "GET", path: "/api/health" });
  assert.equal(noAuth.statusCode, 401);

  const badAuth = await app.inject({
    method: "GET",
    path: "/api/health",
    headers: { authorization: "Bearer wrong" },
  });
  assert.equal(badAuth.statusCode, 401);
});

test("manifest and download expose only relative paths from the real hash/size", async (t) => {
  const app = buildApiServer();
  t.after(() => app.close());

  const trackDir = path.join(config.libraryDir, "Artist", "Album");
  await fs.mkdir(trackDir, { recursive: true });
  const trackPath = path.join(trackDir, "01 - Track.flac");
  const bytes = "fLaC fake bytes";
  await fs.writeFile(trackPath, bytes);

  insertTrack({
    sha256: "abc123",
    path: trackPath,
    filename: "01 - Track.flac",
    artist: "Artist",
    album: "Album",
    albumArtist: "Artist",
    title: "Track",
    trackNumber: 1,
    discNumber: 1,
    year: 2025,
    genre: null,
    duration: 200,
    sampleRate: 96000,
    bitDepth: 24,
    channels: 2,
    fileSize: bytes.length,
  });

  const auth = { authorization: "Bearer secret" };

  const health = await app.inject({ method: "GET", path: "/api/health", headers: auth });
  assert.deepEqual(health.json(), { status: "ok" });

  const manifest = await app.inject({
    method: "GET",
    path: "/api/sync/manifest",
    headers: auth,
  });
  const [track] = manifest.json().tracks;
  assert.equal(track.path, "Artist/Album/01 - Track.flac");
  assert.equal(track.sha256, "abc123");
  assert.equal(track.fileSize, bytes.length);
  assert.equal(track.path.includes(config.libraryDir), false);

  const download = await app.inject({
    method: "GET",
    path: `/api/tracks/${track.id}/download`,
    headers: auth,
  });
  assert.equal(download.statusCode, 200);
  assert.equal(download.headers["content-type"], "audio/flac");
  assert.equal(download.body, bytes);
});

test("download 404s instead of crashing when the DB row has no file on disk", async (t) => {
  const app = buildApiServer();
  t.after(() => app.close());

  insertTrack({
    sha256: "missingfile",
    path: path.join(config.libraryDir, "Ghost", "Album", "01 - Gone.flac"),
    filename: "01 - Gone.flac",
    artist: "Ghost",
    album: "Album",
    albumArtist: "Ghost",
    title: "Gone",
    trackNumber: 1,
    discNumber: 1,
    year: 2025,
    genre: null,
    duration: 1,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    fileSize: 1,
  });

  const res = await app.inject({
    method: "GET",
    path: "/api/sync/manifest",
    headers: { authorization: "Bearer secret" },
  });
  const track = res.json().tracks.find((t) => t.sha256 === "missingfile");

  const download = await app.inject({
    method: "GET",
    path: `/api/tracks/${track.id}/download`,
    headers: { authorization: "Bearer secret" },
  });
  assert.equal(download.statusCode, 404);
});
