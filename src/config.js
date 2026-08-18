import path from "node:path";

import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ALLOWED_USER_ID = Number(process.env.ALLOWED_USER_ID);
const BOT_API_ROOT =
  process.env.TELEGRAM_BOT_API_ROOT || "https://api.telegram.org";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing");
}

if (!ALLOWED_USER_ID) {
  throw new Error("ALLOWED_USER_ID is missing or invalid");
}

const MUSIC_DIR = process.env.MUSIC_DIR || "/music";

export const config = {
  botToken: BOT_TOKEN,
  allowedUserId: ALLOWED_USER_ID,
  botApiRoot: BOT_API_ROOT.replace(/\/$/, ""),
  musicDir: MUSIC_DIR,
  inboxDir: path.join(MUSIC_DIR, "inbox"),
  libraryDir: path.join(MUSIC_DIR, "library"),
  problematicDir: path.join(MUSIC_DIR, "problematic"),
  databasePath: path.join(MUSIC_DIR, "database", "library.db"),
  maxFileSizeBytes:
    Number(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024,
};
