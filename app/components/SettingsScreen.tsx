import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { FolderIds } from "../services/folders";

interface SettingsScreenProps {
  folderIds: FolderIds;
  onBack: () => void;
}

const FOLDER_ITEMS: {
  key: keyof FolderIds;
  label: string;
  envName: string;
}[] = [
  { key: "pending", label: "Pending 文件夹", envName: "DRIVE_PENDING_FOLDER_ID" },
  { key: "ideaPending", label: "Idea Pending 文件夹", envName: "DRIVE_IDEA_PENDING_FOLDER_ID" },
  { key: "processed", label: "Processed 文件夹", envName: "DRIVE_PROCESSED_FOLDER_ID" },
];

export default function SettingsScreen({ folderIds, onBack }: SettingsScreenProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.sectionTitle}>Google Drive 文件夹 ID</Text>
      <Text style={styles.sectionHint}>
        复制以下 ID 配置到服务端 .env 文件中
      </Text>

      {FOLDER_ITEMS.map(({ key, label, envName }) => (
        <View key={key} style={styles.card}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={styles.envName}>{envName}</Text>
          <View style={styles.idRow}>
            <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">
              {folderIds[key]}
            </Text>
            <TouchableOpacity
              style={[
                styles.copyButton,
                copiedKey === key && styles.copyButtonDone,
              ]}
              onPress={() => handleCopy(key, folderIds[key])}
            >
              <Text
                style={[
                  styles.copyText,
                  copiedKey === key && styles.copyTextDone,
                ]}
              >
                {copiedKey === key ? "已复制" : "复制"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: "#4A90D9",
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionHint: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  envName: {
    fontSize: 12,
    color: "#999",
    fontFamily: "monospace",
    marginTop: 2,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  idText: {
    flex: 1,
    fontSize: 13,
    color: "#555",
    fontFamily: "monospace",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  copyButton: {
    backgroundColor: "#4A90D9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonDone: {
    backgroundColor: "#48BB78",
  },
  copyText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  copyTextDone: {
    color: "#fff",
  },
});
