import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  google: {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    refreshToken: requireEnv("GOOGLE_REFRESH_TOKEN"),
    pendingFolderId: requireEnv("DRIVE_PENDING_FOLDER_ID"),
    processedFolderId: requireEnv("DRIVE_PROCESSED_FOLDER_ID"),
  },
  downloadDir: process.env.DOWNLOAD_DIR || path.resolve(__dirname, "../downloads"),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "30000", 10),
};
