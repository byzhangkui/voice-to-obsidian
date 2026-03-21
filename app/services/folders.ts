import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidToken, refreshAccessToken } from "./auth";

const FOLDER_IDS_KEY = "drive_folder_ids";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface FolderIds {
  pending: string;
  ideaPending: string;
  processed: string;
}

let ensurePromise: Promise<FolderIds> | null = null;

/**
 * Search for an existing folder or create a new one
 */
async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<string> {
  // Search for existing folder
  let q = `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }

  const searchUrl = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const data = (await searchRes.json()) as { files?: { id: string }[] };
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create new folder
  const body: Record<string, unknown> = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const createRes = await fetch(DRIVE_FILES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`创建文件夹 "${name}" 失败 (${createRes.status}): ${text}`);
  }

  const result = (await createRes.json()) as { id?: string };
  if (!result.id) {
    throw new Error(`创建文件夹 "${name}" 失败：返回数据缺少 id`);
  }

  return result.id;
}

/**
 * Create all required folders in Google Drive
 */
async function createFolderStructure(token: string): Promise<FolderIds> {
  const rootId = await findOrCreateFolder(token, "voice-to-obsidian");
  const [pending, ideaPending, processed] = await Promise.all([
    findOrCreateFolder(token, "pending", rootId),
    findOrCreateFolder(token, "idea_pending", rootId),
    findOrCreateFolder(token, "processed", rootId),
  ]);
  return { pending, ideaPending, processed };
}

/**
 * Get stored folder IDs from AsyncStorage
 */
export async function getFolderIds(): Promise<FolderIds | null> {
  const raw = await AsyncStorage.getItem(FOLDER_IDS_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Ensure Drive folders exist. Returns cached IDs or creates new ones.
 */
export async function ensureFolders(): Promise<FolderIds> {
  // Prevent concurrent calls
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      // Check cache first
      const cached = await getFolderIds();
      if (cached) return cached;

      // Create folders
      let token = await getValidToken();
      if (!token) throw new Error("未登录");

      let ids: FolderIds;
      try {
        ids = await createFolderStructure(token);
      } catch (err) {
        // Retry with refreshed token on auth error
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401")) {
          const newToken = await refreshAccessToken();
          if (!newToken) throw new Error("Token 刷新失败");
          ids = await createFolderStructure(newToken);
        } else {
          throw err;
        }
      }

      await AsyncStorage.setItem(FOLDER_IDS_KEY, JSON.stringify(ids));
      return ids;
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}

/**
 * Clear stored folder IDs (call on sign out)
 */
export async function clearFolderIds(): Promise<void> {
  await AsyncStorage.removeItem(FOLDER_IDS_KEY);
}
