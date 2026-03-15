import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "google_access_token";
const REFRESH_TOKEN_KEY = "google_refresh_token";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

function getGoogleClientId(): string {
  const clientId =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      `Missing Google OAuth client ID for platform: ${Platform.OS}`
    );
  }

  return clientId;
}

function getGoogleRedirectUri(clientId: string): string {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffix)) {
    throw new Error(`Invalid Google OAuth client ID: ${clientId}`);
  }

  const scheme = `com.googleusercontent.apps.${clientId.slice(
    0,
    -suffix.length
  )}`;

  return AuthSession.makeRedirectUri({
    native: `${scheme}:/oauthredirect`,
  });
}

/**
 * Start Google OAuth2 login flow
 */
export async function signIn(): Promise<string | null> {
  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri(clientId);

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success" || !result.params.code) {
    return null;
  }

  // Exchange code for tokens
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
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
    const clientId = getGoogleClientId();
    const tokenResult = await AuthSession.refreshAsync(
      {
        clientId,
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
