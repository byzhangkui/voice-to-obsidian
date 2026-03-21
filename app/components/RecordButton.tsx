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

const RESET_STATUS_DELAY_MS = 2000;

interface RecordButtonProps {
  folderId: string;
  buttonText: string;
  buttonColor?: string;
}

export default function RecordButton({ folderId, buttonText, buttonColor = "#4A90D9" }: RecordButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [duration, setDuration] = useState(0);
  const [statusDetail, setStatusDetail] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const formatError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : JSON.stringify(error);
  };

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
      setStatusDetail("正在录音，再次点击停止");

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Animate button scale
      Animated.spring(scale, {
        toValue: 1.15,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setStatus("error");
      setStatusDetail(`录音失败：${formatError(err)}`);
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
        setStatusDetail("录音文件为空");
        return;
      }

      const now = new Date();
      const fileName = `voice-${now.toISOString().replace(/[:.]/g, "-")}.m4a`;
      setStatus("uploading");
      setStatusDetail("上传中...");

      try {
        await uploadToDrive(uri, fileName, folderId);
        setStatus("done");
        setStatusDetail(`上传成功：${fileName}`);
      } catch (uploadError) {
        // Upload failed, add to offline queue
        await enqueue(uri, fileName, folderId);
        setStatus("done");
        const message = formatError(uploadError);
        setStatusDetail(`已加入队列：${message}`);
        Alert.alert("上传失败，已加入队列", message);
      }

      // Try processing any queued items
      const queueResult = await processQueue();
      if (queueResult.succeeded > 0 || queueResult.failed > 0) {
        setStatusDetail((current) =>
          `${current}\n队列：成功 ${queueResult.succeeded}，失败 ${queueResult.failed}`
        );
      }

      // Reset after 2 seconds
      setTimeout(() => {
        setStatus("idle");
        setStatusDetail("");
      }, RESET_STATUS_DELAY_MS);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setStatus("error");
      setStatusDetail(`结束录音失败：${formatError(err)}`);
      setTimeout(() => {
        setStatus("idle");
        setStatusDetail("");
      }, RESET_STATUS_DELAY_MS);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getActiveColor = () => {
    switch (status) {
      case "idle":
        return buttonColor;
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

  const getStatusLabel = () => {
    switch (status) {
      case "recording":
        return formatDuration(duration);
      case "uploading":
        return "上传中...";
      case "done":
        return "完成 ✓";
      case "error":
        return "失败";
      default:
        return buttonText;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={status === "recording" ? stopRecording : status === "idle" ? startRecording : undefined}
          disabled={status === "uploading" || status === "done" || status === "error"}
          style={[styles.button, { backgroundColor: getActiveColor() }]}
        >
          <Text style={styles.icon}>
            {status === "recording" ? "⏺" : "🎙"}
          </Text>
        </Pressable>
      </Animated.View>
      <Text style={styles.label}>{getStatusLabel()}</Text>
      {statusDetail ? (
        <Text style={styles.detail} numberOfLines={2}>{statusDetail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 160,
  },
  button: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  icon: {
    fontSize: 36,
  },
  label: {
    marginTop: 12,
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  detail: {
    marginTop: 6,
    fontSize: 12,
    color: "#888",
    textAlign: "center",
  },
});
