import fs from "node:fs/promises";
import path from "node:path";

/**
 * Recursively lists .flac files under `root`, keyed by path relative to
 * root (matching the server manifest's path format).
 */
export async function scanDirectory(root) {
  const files = new Map();

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".flac")) {
        const stat = await fs.stat(full);
        files.set(path.relative(root, full), { fullPath: full, size: stat.size });
      }
    }
  }

  await walk(root);
  return files;
}
