import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // TODO: replace with actual client ID
const TOKEN_KEY = "google_access_token";
const REFRESH_TOKEN_KEY = "google_refresh_token";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const redirectUri = AuthSession.makeRedirectUri();

/**
 * Start Google OAuth2 login flow
 */
export async function signIn(): Promise<string | null> {
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success" || !result.params.code) {
    return null;
  }

  // Exchange code for tokens
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier || "",
      },
    },
    discovery
  );

  const accessToken = tokenResult.accessToken;
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);

  if (tokenResult.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
  }

  return accessToken;
}

/**
 * Get stored access token
 */
export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * Refresh access token using stored refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const tokenResult = await AuthSession.refreshAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        refreshToken,
      },
      discovery
    );

    const accessToken = tokenResult.accessToken;
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (token) return token;
  return await refreshAccessToken();
}

/**
 * Sign out and clear stored tokens
 */
export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is signed in
 */
export async function isSignedIn(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
