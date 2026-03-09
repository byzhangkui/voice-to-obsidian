import { getValidToken, refreshAccessToken } from "./auth";

const DRIVE_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";

const PENDING_FOLDER_ID = process.env.EXPO_PUBLIC_PENDING_FOLDER_ID as string;

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

  const doUpload = (authToken: string) =>
    fetch(`${DRIVE_API}?uploadType=multipart`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });

  let response = await doUpload(token);

  // If 401, try refreshing token and retry once
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error("Token refresh failed");
    response = await doUpload(newToken);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  return true;
}
