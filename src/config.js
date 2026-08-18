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

export const config = {
  botToken: BOT_TOKEN,
  allowedUserId: ALLOWED_USER_ID,
  botApiRoot: BOT_API_ROOT.replace(/\/$/, ""),
  musicDir: process.env.MUSIC_DIR || "/music",
  maxFileSizeBytes:
    Number(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024,
};
