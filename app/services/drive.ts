import { getValidToken, refreshAccessToken } from "./auth";

const DRIVE_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";

// TODO: replace with actual pending folder ID
const PENDING_FOLDER_ID = "YOUR_PENDING_FOLDER_ID";

/**
 * Upload a file to Google Drive pending/ folder
 */
export async function uploadToDrive(
  fileUri: string,
  fileName: string
): Promise<boolean> {
  let token = await getValidToken();
  if (!token) throw new Error("Not authenticated");

  // Create file metadata
  const metadata = {
    name: fileName,
    parents: [PENDING_FOLDER_ID],
  };

  // Read file and upload using multipart upload
  const fileResponse = await fetch(fileUri);
  const fileBlob = await fileResponse.blob();

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", fileBlob);

  let response = await fetch(`${DRIVE_API}?uploadType=multipart`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  // If 401, try refreshing token and retry once
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new Error("Token refresh failed");

    response = await fetch(`${DRIVE_API}?uploadType=multipart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  return true;
}
