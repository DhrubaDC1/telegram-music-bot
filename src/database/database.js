import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { config } from "../config.js";

// ponytail: no separate migrations.js. One schema, no version history needed
// yet. Add real migrations when the schema needs to change under existing data.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  album_artist TEXT,
  title TEXT,
  track_number INTEGER,
  disc_number INTEGER,
  year INTEGER,
  genre TEXT,
  duration REAL,
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
`;

let db = null;

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

  db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  return db;
}

export function findTrackBySha256(sha256) {
  return getDb()
    .prepare("SELECT * FROM tracks WHERE sha256 = ?")
    .get(sha256);
}

export function insertTrack(track) {
  return getDb()
    .prepare(
      `INSERT INTO tracks (
        sha256, path, filename, artist, album, album_artist, title,
        track_number, disc_number, year, genre, duration, sample_rate,
        bit_depth, channels, file_size
      ) VALUES (
        @sha256, @path, @filename, @artist, @album, @albumArtist, @title,
        @trackNumber, @discNumber, @year, @genre, @duration, @sampleRate,
        @bitDepth, @channels, @fileSize
      )`
    )
    .run(track);
}

export function insertJob(sourcePath) {
  const result = getDb()
    .prepare(
      "INSERT INTO processing_jobs (source_path, status) VALUES (?, 'pending')"
    )
    .run(sourcePath);

  return result.lastInsertRowid;
}

export function updateJob(id, { status, error = null }) {
  getDb()
    .prepare(
      `UPDATE processing_jobs
       SET status = ?, error = ?, processed_at = datetime('now')
       WHERE id = ?`
    )
    .run(status, error, id);
}
