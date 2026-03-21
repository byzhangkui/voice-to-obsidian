import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import RecordButton from "./components/RecordButton";
import { signIn, isSignedIn, signOut } from "./services/auth";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isSignedIn().then((signed) => {
      setLoggedIn(signed);
      setLoading(false);
    });
  }, []);

  const handleSignIn = async () => {
    const token = await signIn();
    if (token) setLoggedIn(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setLoggedIn(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Voice to Obsidian</Text>
      <View style={styles.recordArea}>
        <RecordButton
          folderId={process.env.EXPO_PUBLIC_PENDING_FOLDER_ID || ""}
          buttonText="普通笔记"
          buttonColor="#4A90D9"
        />
        <RecordButton
          folderId={process.env.EXPO_PUBLIC_IDEA_PENDING_FOLDER_ID || ""}
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
    marginTop: 40,
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
