import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { executeGeminiAudioTask } from "./utils/gemini-audio";

/**
 * Transcribes, summarizes, and writes an audio file to Obsidian.
 * @param filePath The local path to the audio file.
 * @param operation The specific operation to perform based on the origin folder.
 */
export async function processAudioFile(filePath: string, operation: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const config = getConfig();
  const vaultPath = config.obsidian.vaultPath;
  
  console.log(`Starting processing for: ${absolutePath}`);

  try {
    const prompt = `这是一段语音记录，忽略背景音和非人声。针对这段音频内容，请${operation}。请直接输出最终结果，不要输出任何多余的解释说明或寒暄。`;
    const resultText = await executeGeminiAudioTask(absolutePath, prompt);

    // Save to Obsidian Vault directly
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];
    
    const tag = operation.includes("灵感") || operation.includes("执行这个操作") ? "idea" : "voice-note";
    
    const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [${tag}]
---

${resultText}
`;

    const noteFileName = `${timestamp}.md`;
    const notePath = path.join(vaultPath, noteFileName);

    fs.writeFileSync(notePath, markdownContent, "utf-8");
    console.log(`Created Obsidian note: ${notePath}`);

  } catch (error: any) {
    console.error(`Processing failed for ${filePath}:`, error);
    throw new Error(`Failed to process audio: ${error.message}`);
  }
}
