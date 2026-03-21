import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import RecordButton from "./components/RecordButton";
import SettingsScreen from "./components/SettingsScreen";
import { signIn, isSignedIn, signOut } from "./services/auth";
import {
  ensureFolders,
  clearFolderIds,
  type FolderIds,
} from "./services/folders";

type Screen = "main" | "settings";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [folderIds, setFolderIds] = useState<FolderIds | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("main");

  const initFolders = async () => {
    try {
      setInitError(null);
      const ids = await ensureFolders();
      setFolderIds(ids);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    isSignedIn().then(async (signed) => {
      setLoggedIn(signed);
      if (signed) {
        await initFolders();
      }
      setLoading(false);
    });
  }, []);

  const handleSignIn = async () => {
    const token = await signIn();
    if (token) {
      setLoggedIn(true);
      await initFolders();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    await clearFolderIds();
    setFolderIds(null);
    setLoggedIn(false);
    setScreen("main");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Voice to Obsidian</Text>
        <Text style={styles.subtitle}>语音录制，自动转笔记</Text>
        <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
          <Text style={styles.signInText}>Google 登录</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // Folder initialization in progress or failed
  if (!folderIds) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Voice to Obsidian</Text>
        {initError ? (
          <>
            <Text style={styles.errorText}>初始化文件夹失败</Text>
            <Text style={styles.errorDetail}>{initError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={initFolders}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#4A90D9" />
            <Text style={styles.initText}>正在初始化文件夹...</Text>
          </>
        )}
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        folderIds={folderIds}
        onBack={() => setScreen("main")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Voice to Obsidian</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setScreen("settings")}
        >
          <Text style={styles.settingsIcon}>&#9881;</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.recordArea}>
        <RecordButton
          folderId={folderIds.pending}
          buttonText="普通笔记"
          buttonColor="#4A90D9"
        />
        <RecordButton
          folderId={folderIds.ideaPending}
          buttonText="灵感"
          buttonColor="#9B51E0"
        />
      </View>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>退出登录</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 48,
  },
  loadingText: {
    fontSize: 16,
    color: "#999",
  },
  initText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E53E3E",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
    marginHorizontal: 32,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#4A90D9",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsButton: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  settingsIcon: {
    fontSize: 24,
    color: "#999",
  },
  recordArea: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
    width: "100%",
  },
  signInButton: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  signInText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    marginBottom: 40,
    padding: 12,
  },
  signOutText: {
    color: "#999",
    fontSize: 14,
  },
});
