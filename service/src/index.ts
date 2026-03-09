import fs from "fs";
import { config } from "./config";
import { pollOnce } from "./drive-poller";

// Ensure download directory exists
if (!fs.existsSync(config.downloadDir)) {
  fs.mkdirSync(config.downloadDir, { recursive: true });
}

console.log("Voice-to-Obsidian service started");
console.log(`Poll interval: ${config.pollIntervalMs}ms`);
console.log(`Download dir: ${config.downloadDir}`);

async function run() {
  while (true) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("Poll error:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

run();
