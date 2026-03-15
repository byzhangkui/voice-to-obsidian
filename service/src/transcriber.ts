import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { GoogleGenAI } from "@google/genai";

/**
 * Transcribes, summarizes, and writes an audio file to Obsidian using the Gemini API.
 * @param filePath The local path to the audio file.
 * @param operation The specific operation to perform based on the origin folder.
 */
export async function processAudioWithGemini(filePath: string, operation: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const config = getConfig();
  const vaultPath = config.obsidian.vaultPath;
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  
  console.log(`Starting processing via Gemini API for: ${absolutePath}`);

  try {
    // 1. Upload audio to Gemini
    console.log("Uploading file to Gemini...");
    const uploadResult = await ai.files.upload({
      file: absolutePath,
      config: {
        mimeType: "audio/mp4", // m4a is supported as audio/mp4
      },
    });
    
    if (!uploadResult.name) {
      throw new Error("Upload failed: missing file name in response");
    }
    
    console.log(`File uploaded successfully: ${uploadResult.name}`);

    // 2. Process with Gemini
    const prompt = `这是一段语音记录，忽略背景音和非人声。针对这段音频内容，请${operation}。
请将最终结果直接输出为 Markdown 格式。如果是普通笔记，请提取关键要点（Points）和摘要总结（Summary），以及原始转录。如果是灵感，直接输出正文。无论何种情况，都不要输出除了 Markdown 正文以外的任何多余解释说明或寒暄。`;

    console.log("Generating content with Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        uploadResult,
        prompt
      ],
    });

    const resultText = response.text || "";
    console.log("Gemini processing completed.");

    // 3. Clean up the file from Gemini
    await ai.files.delete({ name: uploadResult.name });
    console.log(`Cleaned up remote file: ${uploadResult.name}`);

    // 4. Save to Obsidian Vault
    const attachmentsDir = path.join(vaultPath, "Attachments");
    const notesDir = path.join(vaultPath, "00_Inbox");

    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];

    const audioFileName = path.basename(absolutePath);
    const destAudioPath = path.join(attachmentsDir, audioFileName);

    fs.copyFileSync(absolutePath, destAudioPath);
    console.log(`Copied audio to: ${destAudioPath}`);
    
    const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [voice-note]
audio: "[[Attachments/${audioFileName}]]"
---

${resultText}
`;

    const topic = operation.includes("灵感") ? "Idea" : "Note";
    const noteFileName = `${timestamp}-${topic}.md`;
    const notePath = path.join(notesDir, noteFileName);

    fs.writeFileSync(notePath, markdownContent, "utf-8");
    console.log(`Created Obsidian note: ${notePath}`);

  } catch (error: any) {
    console.error(`Processing failed for ${filePath}:`, error);
    throw new Error(`Failed to process audio via Gemini API: ${error.message}`);
  }
}
