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

export default function RecordButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [duration, setDuration] = useState(0);
  const [statusDetail, setStatusDetail] = useState("准备录音");
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
      setStatusDetail("正在录音，松开后开始上传");

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
      setStatusDetail(`开始录音失败：${formatError(err)}`);
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
        setStatusDetail("录音文件为空，未拿到本地 URI");
        return;
      }

      const now = new Date();
      const fileName = `voice-${now.toISOString().replace(/[:.]/g, "-")}.m4a`;
      setStatus("uploading");
      setStatusDetail(`录音完成，准备上传 ${fileName}`);

      try {
        await uploadToDrive(uri, fileName);
        setStatus("done");
        setStatusDetail(`上传成功：${fileName}`);
      } catch (uploadError) {
        // Upload failed, add to offline queue
        await enqueue(uri, fileName);
        setStatus("done");
        const message = formatError(uploadError);
        setStatusDetail(`上传失败，已加入队列：${message}`);
        Alert.alert("上传失败，已加入队列", message);
      }

      // Try processing any queued items
      const queueResult = await processQueue();
      if (queueResult.succeeded > 0 || queueResult.failed > 0) {
        setStatusDetail((current) =>
          `${current}\n队列处理结果：成功 ${queueResult.succeeded}，失败 ${queueResult.failed}`
        );
      }

      // Reset after 2 seconds
      setTimeout(() => setStatus("idle"), RESET_STATUS_DELAY_MS);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setStatus("error");
      setStatusDetail(`结束录音失败：${formatError(err)}`);
      setTimeout(() => setStatus("idle"), RESET_STATUS_DELAY_MS);
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
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>上传状态</Text>
        <Text style={styles.detailText}>{statusDetail}</Text>
      </View>
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
  detailCard: {
    marginTop: 20,
    width: 280,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4B5563",
  },
});
