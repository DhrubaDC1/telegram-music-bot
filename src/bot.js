import path from "node:path";

import { Bot } from "grammy";

import { config } from "./config.js";
import { downloadTelegramFile } from "./downloader.js";

export function createBot() {
  const bot = new Bot(config.botToken, {
    client: { apiRoot: config.botApiRoot },
  });

  // Log every update
  bot.use(async (ctx, next) => {
    console.log("\n========== TELEGRAM UPDATE ==========");

    console.log("Update ID:", ctx.update.update_id);
    console.log("User:", ctx.from?.id, ctx.from?.username);

    if (ctx.message) {
      console.log("Message ID:", ctx.message.message_id);
      console.log(
        "Message type:",
        Object.keys(ctx.message)
          .filter((key) =>
            ["audio", "document", "video", "photo", "text"].includes(key)
          )
          .join(", ") || "unknown"
      );
    }

    console.log("======================================");

    await next();
  });

  // Only allow your Telegram account
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.id !== config.allowedUserId) {
      console.log(
        `🔒 Unauthorized request from ${
          ctx.from?.id ?? "unknown"
        }`
      );

      return;
    }

    console.log(`🔓 Authorized user: ${ctx.from.id}`);

    await next();
  });

  bot.command("start", async (ctx) => {
    console.log("▶️ /start command received");

    await ctx.reply(
      "🎵 Music bot is ready.\n\nSend or forward a FLAC file."
    );
  });

  // Log incoming messages
  bot.on("message", async (ctx, next) => {
    console.log("\n📨 MESSAGE RECEIVED");

    if (ctx.message.audio) {
      console.log("🎵 Audio detected");
      console.log("Title:", ctx.message.audio.title);
      console.log("Filename:", ctx.message.audio.file_name);
      console.log("MIME:", ctx.message.audio.mime_type);
      console.log("File ID:", ctx.message.audio.file_id);
      console.log("File size:", ctx.message.audio.file_size);
    }

    if (ctx.message.document) {
      console.log("📄 Document detected");
      console.log("Filename:", ctx.message.document.file_name);
      console.log("MIME:", ctx.message.document.mime_type);
      console.log("File ID:", ctx.message.document.file_id);
      console.log("File size:", ctx.message.document.file_size);
    }

    if (ctx.message.text) {
      console.log("💬 Text:", ctx.message.text);
    }

    console.log("📨 END MESSAGE\n");

    await next();
  });

  /**
   * Handle both Telegram audio and documents.
   */
  async function handleFile(ctx, file) {
    const filename = file.file_name || "unknown.flac";

    console.log("\n🎯 FILE HANDLER TRIGGERED");

    console.log("Filename:", filename);
    console.log("MIME type:", file.mime_type);
    console.log("File ID:", file.file_id);
    console.log("File size:", file.file_size);

    // Check file size
    if (
      file.file_size &&
      file.file_size > config.maxFileSizeBytes
    ) {
      const maxMb =
        config.maxFileSizeBytes / 1024 / 1024;

      console.log(
        `❌ File exceeds maximum size: ${maxMb} MB`
      );

      await ctx.reply(
        `❌ File is too large.\nMaximum allowed: ${maxMb} MB`
      );

      return;
    }

    // Only accept FLAC
    if (
      path.extname(filename).toLowerCase() !== ".flac"
    ) {
      console.log(
        `❌ Not a FLAC file: ${filename}`
      );

      await ctx.reply(
        "❌ Please send a FLAC file."
      );

      return;
    }

    const safeFilename = path.basename(filename).replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    );

    const destination = path.join(
      config.inboxDir,
      safeFilename
    );

    console.log("📁 Destination:", destination);

    try {
      await ctx.reply("⏬ Downloading...");

      console.log(
        "⏬ Starting Telegram download..."
      );

      const result =
        await downloadTelegramFile(
          bot,
          file.file_id,
          destination,
          config.botApiRoot
        );

      const sizeMb = (
        result.size /
        1024 /
        1024
      ).toFixed(2);

      console.log(
        `✅ Download complete: ${safeFilename}`
      );

      console.log(`💾 Size: ${sizeMb} MB`);
      console.log(`📍 Saved to: ${destination}`);

      await ctx.reply(
        `✅ Downloaded\n\n` +
        `🎵 ${safeFilename}\n` +
        `💾 ${sizeMb} MB`
      );
    } catch (error) {
      console.error(
        "❌ DOWNLOAD FAILED"
      );

      console.error(error);

      await ctx.reply(
        "❌ Failed to download the file.\nCheck server logs."
      );
    }
  }

  // Telegram recognized it as audio
  bot.on("message:audio", async (ctx) => {
    console.log(
      "🎵 Handling Telegram audio..."
    );

    await handleFile(
      ctx,
      ctx.message.audio
    );
  });

  // Telegram recognized it as generic document
  bot.on("message:document", async (ctx) => {
    console.log(
      "📄 Handling Telegram document..."
    );

    await handleFile(
      ctx,
      ctx.message.document
    );
  });

  bot.catch((error) => {
    console.error("\n🔥 BOT ERROR");
    console.error(error);
  });

  return bot;
}
