import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadToDrive } from "./drive";

const QUEUE_KEY = "upload_queue";

interface QueueItem {
  fileUri: string;
  fileName: string;
  addedAt: number;
}

/**
 * Add a file to the upload queue
 */
export async function enqueue(fileUri: string, fileName: string): Promise<void> {
  const queue = await getQueue();
  queue.push({ fileUri, fileName, addedAt: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get all items in the queue
 */
async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Process all queued uploads, retrying failed ones
 */
export async function processQueue(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const queue = await getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  const remaining: QueueItem[] = [];
  let succeeded = 0;

  for (const item of queue) {
    try {
      await uploadToDrive(item.fileUri, item.fileName);
      succeeded++;
    } catch (error) {
      console.error(`Failed to process queued item ${item.fileName}:`, error);
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { succeeded, failed: remaining.length };
}

/**
 * Get number of items waiting in queue
 */
export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
