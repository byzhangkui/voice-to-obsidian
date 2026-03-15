import dotenv from "dotenv";
import path from "path";

export const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export function requireEnv(name: string, optional = false): string {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || "";
}

export function getConfig() {
  return {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refreshToken: requireEnv("GOOGLE_REFRESH_TOKEN", true), // Make optional for initial load
      pendingFolderId: requireEnv("DRIVE_PENDING_FOLDER_ID"),
      ideaPendingFolderId: requireEnv("DRIVE_IDEA_PENDING_FOLDER_ID"),
      processedFolderId: requireEnv("DRIVE_PROCESSED_FOLDER_ID"),
    },
    gemini: {
      apiKey: requireEnv("GEMINI_API_KEY"),
    },
    obsidian: {
      vaultPath: requireEnv("OBSIDIAN_VAULT_PATH"),
    },
    downloadDir: process.env.DOWNLOAD_DIR || path.resolve(__dirname, "../downloads"),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "30000", 10),
  };
}

