import "dotenv/config";

const SERVER_URL = process.env.MUSIC_SERVER_URL;
const API_TOKEN = process.env.MUSIC_API_TOKEN;
const ECHO_MINI_PATH = process.env.ECHO_MINI_PATH;

if (!SERVER_URL) throw new Error("MUSIC_SERVER_URL is missing (see .env.example)");
if (!API_TOKEN) throw new Error("MUSIC_API_TOKEN is missing (see .env.example)");
if (!ECHO_MINI_PATH) throw new Error("ECHO_MINI_PATH is missing (see .env.example)");

export const config = {
  serverUrl: SERVER_URL.replace(/\/$/, ""),
  apiToken: API_TOKEN,
  echoMiniPath: ECHO_MINI_PATH,
  debug: Boolean(process.env.DEBUG),
};
