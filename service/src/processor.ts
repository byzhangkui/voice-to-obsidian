import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { executeGeminiAudioTask } from "./utils/gemini-audio";

export type AudioType = "note" | "idea";

/**
 * Transcribes, summarizes, and writes an audio file to Obsidian.
 * @param filePath The local path to the audio file.
 * @param type The type of audio processing ("note" or "idea").
 */
export async function processAudioFile(filePath: string, type: AudioType): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const config = getConfig();
  const vaultPath = config.obsidian.vaultPath;
  
  console.log(`Starting processing for: ${absolutePath} (Type: ${type})`);

  try {
    let prompt = "";
    if (type === "idea") {
      prompt = `这是一段语音记录，忽略背景音和非人声。直接提取并输出语音中的核心灵感、想法或待办事项。请直接输出结果正文，不要输出任何多余的解释说明或寒暄。`;
    } else {
      prompt = `这是一段语音记录，忽略背景音和非人声。转录成普通笔记，提取关键要点，并输出原文。请直接输出最终的 Markdown 格式结果，不要输出任何多余的解释说明或寒暄。`;
    }

    const resultText = await executeGeminiAudioTask(absolutePath, prompt);

    // Determine target directory based on type
    const subFolder = type === "idea" ? config.obsidian.ideaFolder : config.obsidian.noteFolder;
    const targetDir = path.join(vaultPath, subFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(":")[0] + ":" + now.toTimeString().split(":")[1];
    
    const tag = type === "idea" ? "idea" : "voice-note";
    
    const markdownContent = `---
date: ${dateStr} ${timeStr}
tags: [${tag}]
---

${resultText}
`;

    const topic = type === "idea" ? "Idea" : "Note";
    const noteFileName = `${timestamp}-${topic}.md`;
    const notePath = path.join(targetDir, noteFileName);

    fs.writeFileSync(notePath, markdownContent, "utf-8");
    console.log(`Created Obsidian note: ${notePath}`);

  } catch (error: any) {
    console.error(`Processing failed for ${filePath}:`, error);
    throw new Error(`Failed to process audio: ${error.message}`);
  }
}
