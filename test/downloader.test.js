import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { downloadTelegramFile } from "../src/downloader.js";

test("streams a Telegram file to disk unchanged", async (t) => {
  const expected = Buffer.from("fLaC\x00streamed bytes");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flac-download-"));
  const destination = path.join(directory, "track.flac");
  const server = http.createServer((request, response) => {
    assert.equal(request.url, "/file/botTOKEN/files/track.flac");
    response.write(expected.subarray(0, 5));
    response.end(expected.subarray(5));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const bot = {
    token: "TOKEN",
    api: { getFile: async () => ({ file_path: "files/track.flac" }) },
  };

  const result = await downloadTelegramFile(
    bot,
    "file-id",
    destination,
    `http://127.0.0.1:${port}`
  );

  assert.equal(result.size, expected.length);
  assert.deepEqual(await fs.readFile(destination), expected);
});
