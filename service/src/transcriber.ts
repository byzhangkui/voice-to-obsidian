import { exec } from "child_process";
import util from "util";
import path from "path";
import { getConfig } from "./config";

const execPromise = util.promisify(exec);

/**
 * Transcribes, summarizes, and writes an audio file to Obsidian using Gemini CLI and the 'voice-to-obsidian' skill.
 * @param filePath The local path to the audio file.
 * @param operation The specific operation to perform based on the origin folder.
 */
export async function processAudioWithGemini(filePath: string, operation: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const config = getConfig();
  const vaultPath = config.obsidian.vaultPath;
  
  console.log(`Starting processing via Gemini CLI for: ${absolutePath}`);

  try {
    // 构造调用 gemini CLI 的命令
    // -p: 非交互模式
    // --yolo: 自动同意执行工具（绕过确认弹窗）
    const command = `gemini --model gemini-3.1-pro-preview -p "using native multimodal capabilities to listen：@${absolutePath}，忽略背景音，忽略非人声。将结果生成 Markdown 文件并存入下面路径: ${vaultPath}。针对这段音频内容，请${operation}" --yolo`;

    const { stdout, stderr } = await execPromise(command, {
      env: { ...process.env }, // 继承当前环境
      maxBuffer: 10 * 1024 * 1024 // 增加缓冲避免大输出崩溃
    });

    if (stderr) {
      console.warn(`[Gemini CLI Stderr]: ${stderr}`);
    }

    console.log(`Gemini CLI Processing completed.`);
    console.log(`[Gemini CLI Output]:\n${stdout}`);

  } catch (error: any) {
    console.error(`Processing failed for ${filePath}:`, error.message);
    throw new Error(`Failed to process audio via Gemini CLI: ${error.message}`);
  }
}


