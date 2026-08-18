// Manual one-shot inbox scan: `npm run process`. Same code path the watcher
// uses (scanInboxOnce), so it's exactly as idempotent -- reprocessing a
// library that's already up to date inserts nothing new.
import { getDb } from "./database/database.js";
import { scanInboxOnce } from "./music/processor.js";

getDb();

console.log("🎵 Scanning inbox...");
await scanInboxOnce();
console.log("✅ Inbox scan complete.");
