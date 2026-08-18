import { parseFile } from "music-metadata";

function firstOf(value) {
  return Array.isArray(value) ? value[0] : value;
}

function commentText(comment) {
  const first = firstOf(comment);
  if (!first) return null;
  return typeof first === "string" ? first : first.text ?? null;
}

function yearFrom(common) {
  if (common.year) return common.year;
  if (common.date) {
    const year = Number(String(common.date).slice(0, 4));
    return Number.isNaN(year) ? null : year;
  }
  return null;
}

/**
 * Reads Vorbis comments + technical properties from a FLAC file via
 * music-metadata's streaming tokenizer (never loads the audio into memory).
 */
export async function readFlacMetadata(filePath) {
  const { common, format } = await parseFile(filePath, { duration: true });
  const picture = firstOf(common.picture) ?? null;

  return {
    title: common.title?.trim() || null,
    artist: common.artist?.trim() || null,
    albumArtist: common.albumartist?.trim() || common.artist?.trim() || null,
    album: common.album?.trim() || null,
    trackNumber: common.track?.no ?? null,
    discNumber: common.disk?.no ?? null,
    discTotal: common.disk?.of ?? null,
    year: yearFrom(common),
    genre: firstOf(common.genre) ?? null,
    composer: firstOf(common.composer) ?? null,
    comment: commentText(common.comment),
    duration: format.duration ?? null,
    sampleRate: format.sampleRate ?? null,
    bitsPerSample: format.bitsPerSample ?? null,
    channels: format.numberOfChannels ?? null,
    codec: format.codec ?? format.container ?? "FLAC",
    picture: picture ? { data: picture.data, format: picture.format } : null,
  };
}
