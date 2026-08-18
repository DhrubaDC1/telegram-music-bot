import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export async function downloadTelegramFile(
  bot,
  fileId,
  destination,
  botApiRoot
) {
  const file = await bot.api.getFile(fileId);

  if (!file.file_path) {
    throw new Error("Telegram did not return a file path");
  }

  let source;

  if (path.isAbsolute(file.file_path)) {
    source = createReadStream(file.file_path);
  } else {
    const fileUrl = `${botApiRoot}/file/bot${bot.token}/${file.file_path}`;
    const response = await fetch(fileUrl);

    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download file: ${response.status} ${response.statusText}`
      );
    }

    source = response.body;
  }

  await fs.mkdir(path.dirname(destination), {
    recursive: true,
  });

  let destinationCreated = false;
  const output = createWriteStream(destination, { flags: "wx" });
  output.once("open", () => {
    destinationCreated = true;
  });

  try {
    await pipeline(source, output);
  } catch (error) {
    if (destinationCreated) {
      await fs.unlink(destination).catch(() => {});
    }

    throw error;
  }

  const { size } = await fs.stat(destination);

  return {
    size,
    filePath: destination,
  };
}
