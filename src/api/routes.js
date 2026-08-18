import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";
import {
  countAlbums,
  countTracks,
  getAllTracks,
  getTrackById,
  getTracksPage,
} from "../database/database.js";

const ARTWORK_NAMES = ["cover.jpg", "cover.png"];

function toRelativePath(absolutePath) {
  return path.relative(config.libraryDir, absolutePath);
}

// Full detail shape, reused for every list/detail endpoint. Only
// /api/sync/manifest gets its own leaner shape -- that one is fetched on
// every sync run and has no reason to carry fields the client never reads.
function serializeTrack(track) {
  return {
    id: track.id,
    artist: track.artist,
    album: track.album,
    albumArtist: track.album_artist,
    title: track.title,
    trackNumber: track.track_number,
    discNumber: track.disc_number,
    year: track.year,
    genre: track.genre,
    duration: track.duration,
    sampleRate: track.sample_rate,
    bitDepth: track.bit_depth,
    channels: track.channels,
    fileSize: track.file_size,
    sha256: track.sha256,
    path: toRelativePath(track.path),
  };
}

function parseTrackId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) ? id : null;
}

async function findArtwork(trackPath) {
  const albumDir = path.dirname(trackPath);
  for (const name of ARTWORK_NAMES) {
    const candidate = path.join(albumDir, name);
    if (await fs.access(candidate).then(() => true).catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

export function registerRoutes(app) {
  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/library", async () => ({
    totalTracks: countTracks(),
    totalAlbums: countAlbums(),
    tracks: getAllTracks().map(serializeTrack),
  }));

  app.get("/api/tracks", async (request) => {
    const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(request.query.limit, 10) || 100)
    );

    return {
      page,
      limit,
      total: countTracks(),
      tracks: getTracksPage(limit, (page - 1) * limit).map(serializeTrack),
    };
  });

  app.get("/api/tracks/:id", async (request, reply) => {
    const id = parseTrackId(request.params.id);
    const track = id !== null && getTrackById(id);
    if (!track) return reply.code(404).send({ error: "Track not found" });

    return serializeTrack(track);
  });

  app.get("/api/tracks/:id/download", async (request, reply) => {
    const id = parseTrackId(request.params.id);
    const track = id !== null && getTrackById(id);
    if (!track) return reply.code(404).send({ error: "Track not found" });

    const stat = await fs.stat(track.path).catch(() => null);
    if (!stat) {
      console.error(
        `⚠️ Track ${track.id} (${track.path}) is in the database but missing on disk`
      );
      return reply.code(404).send({ error: "File missing on disk" });
    }

    reply.header("Content-Length", stat.size);
    reply.header(
      "Content-Disposition",
      `attachment; filename="${track.filename}"`
    );
    return reply.type("audio/flac").send(createReadStream(track.path));
  });

  app.get("/api/tracks/:id/artwork", async (request, reply) => {
    const id = parseTrackId(request.params.id);
    const track = id !== null && getTrackById(id);
    if (!track) return reply.code(404).send({ error: "Track not found" });

    const artworkPath = await findArtwork(track.path);
    if (!artworkPath) return reply.code(404).send({ error: "No artwork" });

    const type = artworkPath.endsWith(".png") ? "image/png" : "image/jpeg";
    return reply.type(type).send(createReadStream(artworkPath));
  });

  app.get("/api/sync/manifest", async () => ({
    generatedAt: new Date().toISOString(),
    tracks: getAllTracks().map((track) => ({
      id: track.id,
      path: toRelativePath(track.path),
      sha256: track.sha256,
      fileSize: track.file_size,
    })),
  }));
}
