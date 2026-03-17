import fs from "fs";
import { getConfig, envPath } from "./config";
import { pollOnce } from "./drive-poller";
import { ensureAuthenticated } from "./auth-helper";

async function run() {
  // Try to load initial config to get client credentials
  // This will throw if GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET are missing
  const initialConfig = getConfig();

  try {
    // This will either return the existing token or start the interactive flow
    await ensureAuthenticated(
      initialConfig.google.clientId,
      initialConfig.google.clientSecret,
      envPath
    );
  } catch (err) {
    console.error("Authentication failed. Please check your credentials and try again.", err);
    process.exit(1);
  }

  // Reload config now that we are sure we have a refresh token
  const config = getConfig();

  // Ensure download directory exists
  if (!fs.existsSync(config.downloadDir)) {
    fs.mkdirSync(config.downloadDir, { recursive: true });
  }

  console.log("==================================================");
  console.log("🚀 Voice-to-Obsidian service started successfully!");
  console.log(`⏱️  Poll interval: ${config.pollIntervalMs}ms`);
  console.log(`📂 Download dir: ${config.downloadDir}`);
  console.log("==================================================\n");

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
