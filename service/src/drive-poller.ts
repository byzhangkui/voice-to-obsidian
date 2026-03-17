import { google, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { executeGeminiAudioTask } from "./utils/gemini-audio";

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

// ─── Audio → Text ──────────────────────────────────────────────────────────────

/**
 * Transcribe an audio file to raw text using Gemini.
 * This is a pure speech-to-text step with no further processing.
 */
async function transcribeAudio(filePath: string): Promise<string> {
  const prompt =
    "这是一段语音记录，忽略背景音和非人声。请将语音内容逐字转录为文本，保持原始口语风格，不要做任何总结、提炼或格式化。直接输出转录文本，不要输出任何多余的解释说明。";

  console.log(`Transcribing audio: ${filePath}`);
  const transcript = await executeGeminiAudioTask(filePath, prompt);
  console.log(`Transcription completed (${transcript.length} chars).`);
  return transcript;
}

// ─── Text Processing (note) ────────────────────────────────────────────────────

/**
 * Process transcribed text as a "note":
 * extract key points, format as Markdown, and save to Obsidian vault.
 */
async function processNote(transcript: string): Promise<void> {
  const config = getConfig();
  const noteFolder = config.obsidian.noteFolder;
  const targetDir = path.isAbsolute(noteFolder)
    ? noteFolder
    : path.join(config.obsidian.vaultPath, noteFolder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const dateStr = now.toISOString().split("T")[0];
  const timeStr =
    now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];

  const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [voice-note]
---

${transcript}
`;

  const noteFileName = `${timestamp}-Note.md`;
  const notePath = path.join(targetDir, noteFileName);

  fs.writeFileSync(notePath, markdownContent, "utf-8");
  console.log(`Created Obsidian note: ${notePath}`);
}

// ─── Text Processing (idea) ────────────────────────────────────────────────────

/**
 * Process transcribed text as an "idea":
 * extract core inspirations / to-dos, and save to Obsidian vault.
 */
async function processIdea(transcript: string): Promise<void> {
  const config = getConfig();
  const ideaFolder = config.obsidian.ideaFolder;
  const targetDir = path.isAbsolute(ideaFolder)
    ? ideaFolder
    : path.join(config.obsidian.vaultPath, ideaFolder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const dateStr = now.toISOString().split("T")[0];
  const timeStr =
    now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];

  const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [idea]
---

${transcript}
`;

  const noteFileName = `${timestamp}-Idea.md`;
  const notePath = path.join(targetDir, noteFileName);

  fs.writeFileSync(notePath, markdownContent, "utf-8");
  console.log(`Created Obsidian idea note: ${notePath}`);
}

// ─── Poll Loop ─────────────────────────────────────────────────────────────────

/**
 * Poll once: list pending files, download, transcribe, process by type, and move to processed
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

      // 2. Transcribe audio → text
      const transcript = await transcribeAudio(localPath);

      // 3. Route to type-specific text processing
      if (file.sourceType === "idea") {
        await processIdea(transcript);
      } else {
        await processNote(transcript);
      }

      // 4. Move original in Drive
      await moveToProcessed(file);

      // 5. Cleanup local file
      fs.unlinkSync(localPath);
      console.log(`Cleaned up local file: ${localPath}`);
      console.log(`Successfully finished processing: ${file.name} (Type: ${file.sourceType})`);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
    }
  }
}
