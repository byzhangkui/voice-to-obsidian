import { getConfig } from "../config";
import { GoogleGenAI } from "@google/genai";

/**
 * Uploads an audio file to Gemini, applies a prompt, and returns the generated text.
 * Cleans up the uploaded file automatically.
 * 
 * @param absolutePath The absolute local path to the audio file.
 * @param prompt The prompt to apply to the audio content.
 * @returns The resulting text from the model.
 */
export async function executeGeminiAudioTask(absolutePath: string, prompt: string): Promise<string> {
  const config = getConfig();
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  let uploadName = "";

  try {
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
    uploadName = uploadResult.name;
    
    console.log(`File uploaded successfully: ${uploadName}`);

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
    
    return resultText;

  } catch (error: any) {
    throw new Error(`Failed to execute Gemini task: ${error.message}`);
  } finally {
    if (uploadName) {
      try {
        await ai.files.delete({ name: uploadName });
        console.log(`Cleaned up remote file: ${uploadName}`);
      } catch (cleanupError) {
        console.error(`Failed to clean up remote file ${uploadName}:`, cleanupError);
      }
    }
  }
}
