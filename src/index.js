import { createBot } from "./bot.js";

const bot = createBot();

console.log("🎵 Telegram Music Bot starting...");

bot.start({
  onStart: (botInfo) => {
    console.log(`Connected as @${botInfo.username}`);
  },
});
