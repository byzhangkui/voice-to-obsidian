import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

/**
 * Transcribes, summarizes, and writes an audio file to Obsidian using Gemini CLI and the 'voice-to-obsidian' skill.
 * @param filePath The local path to the audio file.
 */
export async function processAudioWithGemini(filePath: string): Promise<void> {
  console.log(`Starting processing via Gemini CLI for: ${filePath}`);

  try {
    // 构造调用 gemini CLI 的命令
    // -p: 非交互模式
    // --yolo: 自动同意执行工具（绕过确认弹窗）
    const command = `gemini -p "请使用 voice-to-obsidian 技能处理这个音频文件：${filePath}。" --yolo`;

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


