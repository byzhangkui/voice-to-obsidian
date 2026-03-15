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
    const prompt = `这是一段语音记录，忽略背景音和非人声。请直接输出音频的原文转录。不要输出任何多余的解释说明或寒暄。`;

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

    // 4. Save to Obsidian Vault directly
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];
    
    const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [voice-note]
---

${resultText}
`;

    const noteFileName = `${timestamp}.md`;
    const notePath = path.join(vaultPath, noteFileName);

    fs.writeFileSync(notePath, markdownContent, "utf-8");
    console.log(`Created Obsidian note: ${notePath}`);

  } catch (error: any) {
    console.error(`Processing failed for ${filePath}:`, error);
    throw new Error(`Failed to process audio via Gemini API: ${error.message}`);
  }
}
