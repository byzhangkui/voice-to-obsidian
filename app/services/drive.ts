import * as FileSystem from "expo/node_modules/expo-file-system/legacy";
import { getValidToken, refreshAccessToken } from "./auth";

const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";

const PENDING_FOLDER_ID = process.env.EXPO_PUBLIC_PENDING_FOLDER_ID as string;

async function createDriveFile(
  authToken: string,
  fileName: string
): Promise<string> {
  const response = await fetch(DRIVE_FILES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fileName,
      parents: [PENDING_FOLDER_ID],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create Drive file failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Create Drive file failed: missing file id");
  }

  return data.id;
}

async function deleteDriveFile(authToken: string, fileId: string): Promise<void> {
  try {
    await fetch(`${DRIVE_FILES_API}/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (error) {
    console.error(`Failed to delete incomplete Drive file ${fileId}:`, error);
  }
}

async function uploadDriveFileContent(
  authToken: string,
  fileUri: string,
  fileId: string
): Promise<void> {
  const response = await FileSystem.uploadAsync(
    `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`,
    fileUri,
    {
      httpMethod: "PATCH",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "audio/mp4",
      },
    }
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed (${response.status}): ${response.body}`);
  }
}

/**
 * Upload a file to Google Drive pending/ folder
 */
export async function uploadToDrive(
  fileUri: string,
  fileName: string
): Promise<boolean> {
  if (!PENDING_FOLDER_ID) {
    throw new Error("Missing EXPO_PUBLIC_PENDING_FOLDER_ID");
  }

  let token = await getValidToken();
  if (!token) throw new Error("Not authenticated");

  let fileId: string | null = null;

  try {
    fileId = await createDriveFile(token, fileName);
    await uploadDriveFileContent(token, fileUri, fileId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("(401)")) {
      const newToken = await refreshAccessToken();
      if (!newToken) throw new Error("Token refresh failed");
      token = newToken;

      if (fileId) {
        await deleteDriveFile(token, fileId);
      }

      fileId = await createDriveFile(token, fileName);
      await uploadDriveFileContent(token, fileUri, fileId);
    } else {
      if (fileId) {
        await deleteDriveFile(token, fileId);
      }
      throw error;
    }
  }

  return true;
}
