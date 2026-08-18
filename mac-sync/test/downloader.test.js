import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

process.env.MUSIC_API_TOKEN = "secret";
process.env.ECHO_MINI_PATH = "/tmp";

const goodBytes = Buffer.from("fLaC fake track bytes");
const goodSha256 = createHash("sha256").update(goodBytes).digest("hex");

const server = http.createServer((request, response) => {
  if (request.url === "/api/tracks/1/download") return response.end(goodBytes);
  if (request.url === "/api/tracks/2/download") return response.end("wrong bytes");
  response.statusCode = 404;
  response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.MUSIC_SERVER_URL = `http://127.0.0.1:${server.address().port}`;

after(() => new Promise((resolve) => server.close(resolve)));

const { downloadAndVerify } = await import("../src/downloader.js");

test("downloads, verifies, and renames into place on a hash match", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echo-mini-dl-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const dest = path.join(dir, "Artist", "Album", "01 - Track.flac");

  await downloadAndVerify(
    { id: 1, sha256: goodSha256, fileSize: goodBytes.length, path: "Artist/Album/01 - Track.flac" },
    dest
  );

  assert.deepEqual(await fs.readFile(dest), goodBytes);
  await assert.rejects(fs.access(`${dest}.part`)); // no leftover partial file
});

test("cleans up the .part file and throws on a hash mismatch", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "echo-mini-dl-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const dest = path.join(dir, "Artist", "Album", "02 - Track.flac");

  await assert.rejects(
    downloadAndVerify(
      { id: 2, sha256: "deadbeef", fileSize: 11, path: "Artist/Album/02 - Track.flac" },
      dest
    ),
    /hash mismatch/
  );

  await assert.rejects(fs.access(dest));
  await assert.rejects(fs.access(`${dest}.part`));
});
