import path from "node:path";

// Path separators + control chars (incl. null byte). Stripping these means
// no metadata segment can ever contain a directory separator, which is the
// real defense against path traversal -- ".." alone can't escape anywhere
// without a "/" next to it.
const UNSAFE_CHARS = /[/\\\x00-\x1F]/g;

export function sanitizeSegment(value, fallback = "Unknown") {
  if (typeof value !== "string") return fallback;

  const cleaned = value
    .replace(UNSAFE_CHARS, "_")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 180)
    .trim();

  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

export function missingRequiredFields(meta) {
  const missing = [];
  if (!meta.albumArtist) missing.push("Artist");
  if (!meta.album) missing.push("Album");
  if (!meta.title) missing.push("Title");
  return missing;
}

/**
 * Builds the sanitized library path for a track. Assumes
 * missingRequiredFields() has already been checked -- this still asserts the
 * final path can't escape libraryRoot as a second, independent guard.
 */
export function buildDestination(meta, libraryRoot) {
  const artistSegment = sanitizeSegment(meta.albumArtist);
  const albumSegment = sanitizeSegment(meta.album);
  const titleSegment = sanitizeSegment(meta.title);

  const trackPrefix = meta.trackNumber
    ? `${String(meta.trackNumber).padStart(2, "0")} - `
    : "";
  const filename = `${trackPrefix}${titleSegment}.flac`;

  const albumDir = path.join(libraryRoot, artistSegment, albumSegment);
  const dir =
    meta.discTotal > 1
      ? path.join(albumDir, `Disc ${meta.discNumber || 1}`)
      : albumDir;
  const filePath = path.join(dir, filename);

  const resolvedRoot = path.resolve(libraryRoot) + path.sep;
  if (!path.resolve(filePath).startsWith(resolvedRoot)) {
    throw new Error("Generated library path escapes the library root");
  }

  // albumDir separate from dir: artwork is shared across discs and always
  // lives at the album root, not duplicated into each Disc N folder.
  return { dir, albumDir, filePath, artistSegment, albumSegment };
}
