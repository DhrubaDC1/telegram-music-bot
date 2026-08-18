import fs from "node:fs/promises";
import path from "node:path";

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

/**
 * Writes embedded artwork to <albumDir>/cover.<ext>, preserving the original
 * format (no re-encoding). Skips writing if cover art is already there --
 * first track to land in an album wins, later tracks don't re-touch it.
 */
export async function saveArtwork(picture, albumDir) {
  if (!picture?.data?.length) return null;

  const ext = EXT_BY_MIME[picture.format] || "jpg";
  const dest = path.join(albumDir, `cover.${ext}`);

  const alreadyExists = await fs
    .access(dest)
    .then(() => true)
    .catch(() => false);

  if (alreadyExists) return dest;

  await fs.writeFile(dest, picture.data);
  return dest;
}
