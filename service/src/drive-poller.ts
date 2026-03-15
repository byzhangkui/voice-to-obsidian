import { google, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { processAudioFile } from "./processor";

export interface DriveFile {
  id: string;
  name: string;
  sourceType: "note" | "idea";
  folderId: string;
}

function getDriveClient() {
  const config = getConfig();
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * List files in a specific pending folder
 */
async function listPendingFiles(folderId: string, sourceType: "note" | "idea"): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
    orderBy: "createdTime",
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    sourceType,
    folderId,
  }));
}

/**
 * Download a file from Drive to local directory
 */
async function downloadFile(file: DriveFile): Promise<string> {
  const config = getConfig();
  const drive = getDriveClient();
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
  const config = getConfig();
  const drive = getDriveClient();
  await drive.files.update({
    fileId: file.id,
    addParents: config.google.processedFolderId,
    removeParents: file.folderId,
    fields: "id, parents",
  });

  console.log(`Moved to processed in Drive: ${file.name}`);
}

/**
 * Poll once: list pending files, download, process with Gemini skill, and move to processed
 */
export async function pollOnce(): Promise<void> {
  const config = getConfig();
  const noteFiles = await listPendingFiles(config.google.pendingFolderId, "note");
  const ideaFiles = await listPendingFiles(config.google.ideaPendingFolderId, "idea");
  
  const allFiles = [...noteFiles, ...ideaFiles];

  if (allFiles.length === 0) {
    return;
  }

  console.log(`Found ${allFiles.length} file(s) pending processing...`);

  for (const file of allFiles) {
    let localPath = "";
    try {
      // 1. Download
      localPath = await downloadFile(file);

      // 2. Process completely
      const operation = file.sourceType === "idea" ? "执行这个操作，将结果写入 obsidian 目录。" : "转录成普通笔记，提取关键要点，并写入 Obsidian";
      await processAudioFile(localPath, operation);

      // 3. Move original in Drive
      await moveToProcessed(file);

      // 4. Cleanup local file
      fs.unlinkSync(localPath);
      console.log(`Cleaned up local file: ${localPath}`);
      
      console.log(`Successfully finished processing: ${file.name} (Type: ${file.sourceType})`);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
    }
  }
}
