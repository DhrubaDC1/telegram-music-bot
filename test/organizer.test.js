import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildDestination,
  missingRequiredFields,
  sanitizeSegment,
} from "../src/music/organizer.js";

test("sanitizeSegment strips path separators and null bytes", () => {
  assert.equal(sanitizeSegment("../../etc/passwd"), ".._.._etc_passwd");
  assert.equal(sanitizeSegment("a\x00b"), "a_b");
  assert.equal(sanitizeSegment(".."), "Unknown");
  assert.equal(sanitizeSegment("."), "Unknown");
  assert.equal(sanitizeSegment(""), "Unknown");
  assert.equal(sanitizeSegment("Pink Floyd"), "Pink Floyd");
});

test("missingRequiredFields flags absent artist/album/title", () => {
  assert.deepEqual(
    missingRequiredFields({ albumArtist: null, album: "A", title: "T" }),
    ["Artist"]
  );
  assert.deepEqual(
    missingRequiredFields({ albumArtist: "X", album: "A", title: "T" }),
    []
  );
});

test("buildDestination never escapes the library root, even from hostile tags", () => {
  const libraryRoot = "/music/library";
  const { filePath } = buildDestination(
    {
      albumArtist: "../../../etc",
      album: "../../passwd",
      title: "pwn",
      trackNumber: 1,
      discTotal: 1,
    },
    libraryRoot
  );

  assert.ok(filePath.startsWith(path.resolve(libraryRoot) + path.sep));
});

test("buildDestination adds a Disc folder only when discTotal > 1", () => {
  const single = buildDestination(
    { albumArtist: "A", album: "B", title: "T", trackNumber: 1, discTotal: 1 },
    "/music/library"
  );
  assert.ok(!single.dir.includes("Disc"));

  const multi = buildDestination(
    { albumArtist: "A", album: "B", title: "T", trackNumber: 1, discNumber: 2, discTotal: 2 },
    "/music/library"
  );
  assert.ok(multi.dir.endsWith(path.join("A", "B", "Disc 2")));
});

test("buildDestination filename has no leading number when trackNumber is missing", () => {
  const { filePath } = buildDestination(
    { albumArtist: "A", album: "B", title: "T", trackNumber: null, discTotal: 1 },
    "/music/library"
  );
  assert.equal(path.basename(filePath), "T.flac");
});
