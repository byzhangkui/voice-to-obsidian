import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { uploadToDrive } from "../services/drive";
import { enqueue, processQueue } from "../services/queue";

type Status = "idle" | "recording" | "uploading" | "done" | "error";

export default function RecordButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("需要麦克风权限", "请在设置中允许录音权限");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setStatus("recording");
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Animate button scale
      Animated.spring(scale, {
        toValue: 1.3,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setStatus("error");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    // Stop timer and animation
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setStatus("error");
        return;
      }

      setStatus("uploading");

      const now = new Date();
      const fileName = `voice-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.m4a`;

      try {
        await uploadToDrive(uri, fileName);
        setStatus("done");
      } catch {
        // Upload failed, add to offline queue
        await enqueue(uri, fileName);
        setStatus("done");
        Alert.alert("已加入队列", "网络恢复后将自动上传");
      }

      // Try processing any queued items
      await processQueue();

      // Reset after 2 seconds
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (status) {
      case "idle":
        return "按住说话";
      case "recording":
        return formatDuration(duration);
      case "uploading":
        return "上传中...";
      case "done":
        return "完成 ✓";
      case "error":
        return "失败";
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case "idle":
        return "#4A90D9";
      case "recording":
        return "#E53E3E";
      case "uploading":
        return "#ED8936";
      case "done":
        return "#48BB78";
      case "error":
        return "#E53E3E";
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={status === "uploading"}
          style={[styles.button, { backgroundColor: getButtonColor() }]}
        >
          <Text style={styles.icon}>
            {status === "recording" ? "⏺" : "🎙"}
          </Text>
        </Pressable>
      </Animated.View>
      <Text style={styles.statusText}>{getStatusText()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 48,
  },
  statusText: {
    marginTop: 24,
    fontSize: 18,
    color: "#666",
    fontWeight: "500",
  },
});
