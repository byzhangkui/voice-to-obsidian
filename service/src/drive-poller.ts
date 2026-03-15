import { google, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { processAudioWithGemini } from "./transcriber";

const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret
);

oauth2Client.setCredentials({
  refresh_token: config.google.refreshToken,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

export interface DriveFile {
  id: string;
  name: string;
}

/**
 * List files in the pending folder
 */
async function listPendingFiles(): Promise<DriveFile[]> {
  const res = await drive.files.list({
    q: `'${config.google.pendingFolderId}' in parents and trashed = false`,
    fields: "files(id, name)",
    orderBy: "createdTime",
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
  }));
}

/**
 * Download a file from Drive to local directory
 */
async function downloadFile(file: DriveFile): Promise<string> {
  const destPath = path.join(config.downloadDir, path.basename(file.name));

  const res = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "stream" }
  );

  await new Promise<void>((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    (res.data as NodeJS.ReadableStream)
      .pipe(dest)
      .on("finish", resolve)
      .on("error", reject);
  });

  console.log(`Downloaded: ${file.name}`);
  return destPath;
}

/**
 * Move a file from pending to processed folder in Drive
 */
async function moveToProcessed(file: DriveFile): Promise<void> {
  await drive.files.update({
    fileId: file.id,
    addParents: config.google.processedFolderId,
    removeParents: config.google.pendingFolderId,
    fields: "id, parents",
  });

  console.log(`Moved to processed in Drive: ${file.name}`);
}

/**
 * Poll once: list pending files, download, process with Gemini skill, and move to processed
 */
export async function pollOnce(): Promise<void> {
  const files = await listPendingFiles();

  if (files.length === 0) {
    return;
  }

  console.log(`Found ${files.length} file(s) in pending/`);

  for (const file of files) {
    let localPath = "";
    try {
      // 1. Download
      localPath = await downloadFile(file);

      // 2. Process completely using Gemini CLI (transcription + summary + vault writing)
      await processAudioWithGemini(localPath);

      // 3. Move original in Drive
      await moveToProcessed(file);

      // 4. Cleanup local file
      fs.unlinkSync(localPath);
      console.log(`Cleaned up local file: ${localPath}`);
      
      console.log(`Successfully finished processing: ${file.name}`);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      // Optional: move to a "failed" folder or just leave it in pending
      // For now, it stays in pending, will retry on next poll.
    }
  }
}

