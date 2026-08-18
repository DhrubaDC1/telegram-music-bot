import { AuthError, getHealth } from "./api.js";
import { config } from "./config.js";

async function main() {
  console.log("🎵 Music Server\n");

  let body;
  try {
    body = await getHealth(); // one round trip exercises connect + auth + health
  } catch (error) {
    if (error instanceof AuthError) {
      console.log("✓ Connected");
      console.log(`❌ ${error.message}`);
    } else {
      console.log(
        `❌ Cannot connect to music server.\n\nServer:\n${config.serverUrl}\n\n` +
          "Check that the server is running and reachable."
      );
    }
    if (config.debug) console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log("✓ Connected");
  console.log("✓ API authentication successful");
  console.log(body.status === "ok" ? "✓ Server healthy" : `❌ Server reported: ${body.status}`);
  if (body.status !== "ok") process.exitCode = 1;
}

main();
