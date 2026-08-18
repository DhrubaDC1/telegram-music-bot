import { createBot } from "./bot.js";
import { config } from "./config.js";
import { getDb } from "./database/database.js";
import { events as processorEvents, scanInboxOnce, watchInbox } from "./music/processor.js";
import { formatNotification } from "./music/notify.js";

const bot = createBot();

getDb(); // creates /music/database/library.db + schema if missing

for (const event of ["added", "duplicate", "problematic", "failed"]) {
  processorEvents.on(event, (payload) => {
    const text = formatNotification(event, payload);
    if (!text) return;

    bot.api
      .sendMessage(config.allowedUserId, text)
      .catch((error) => console.error("❌ Failed to send notification:", error));
  });
}

console.log("🎵 Telegram Music Bot starting...");

bot.start({
  onStart: (botInfo) => {
    console.log(`Connected as @${botInfo.username}`);
  },
});

// Catch anything dropped in the inbox before this process was running, then
// watch for new arrivals.
scanInboxOnce().catch((error) => console.error("❌ Initial inbox scan failed:", error));
watchInbox();
