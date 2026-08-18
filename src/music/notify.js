import { config } from "../config.js";

function formatDuration(seconds) {
  if (!seconds) return "";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

// Pure formatter, kept separate from the EventEmitter wiring so bot.js/index.js
// decide *when* to notify while this only decides *what the message says*.
export function formatNotification(event, payload) {
  if (event === "added") {
    const { meta, artistSegment, albumSegment } = payload;
    const quality = [
      meta.bitsPerSample ? `${meta.bitsPerSample}-bit` : null,
      meta.sampleRate ? `${(meta.sampleRate / 1000).toFixed(1)} kHz` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    return (
      `✅ Added to library\n\n` +
      `🎵 ${meta.title}\n\n` +
      `Artist: ${meta.artist ?? meta.albumArtist}\n` +
      `Album: ${meta.album}\n\n` +
      (quality ? `${quality}\n` : "") +
      `FLAC\n` +
      (meta.duration ? `${formatDuration(meta.duration)}\n` : "") +
      `\n📁 ${artistSegment}/\n   ${albumSegment}/`
    );
  }

  if (event === "duplicate") {
    const { meta } = payload;
    return (
      `ℹ️ Already in library\n\n` +
      `🎵 ${meta.title ?? payload.filename}\n\n` +
      `This exact file already exists in the library.`
    );
  }

  if (event === "problematic") {
    const { missing } = payload;
    return (
      `⚠️ Could not organize file\n\n` +
      `Missing metadata:\n${missing.join(", ")}\n\n` +
      `The original file was moved to:\n\n${config.problematicDir}/`
    );
  }

  if (event === "failed") {
    const { filename, error } = payload;
    return `❌ Failed to process file\n\n🎵 ${filename}\n\nError: ${error.message}`;
  }

  return null;
}
