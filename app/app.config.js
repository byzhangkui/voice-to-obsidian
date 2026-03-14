const deriveGoogleRedirectScheme = (clientId) => {
  if (!clientId) return null;
  const suffix = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
};

const googleSchemes = [
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
].map(deriveGoogleRedirectScheme)
  .filter(Boolean);

module.exports = {
  expo: {
    name: "Voice to Obsidian",
    slug: "voice-to-obsidian",
    scheme: [
      "voice-to-obsidian",
      "com.voicetoobsidian.app",
      ...new Set(googleSchemes),
    ],
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.voicetoobsidian.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      permissions: ["RECORD_AUDIO"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-secure-store",
      "@react-native-google-signin/google-signin",
    ],
  },
};
