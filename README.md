# Voice to Obsidian

手机录音，自动转为 Obsidian 笔记。

## 工作流程

```
手机按住说话 → 松手自动上传到 Google Drive pending/
                              ↓
            Mac Service 轮询 → 下载音频
                              ↓
                  Whisper API → 语音转文字
                              ↓
                  Claude API → 生成摘要 + 要点
                              ↓
              写入 Obsidian Vault（Markdown + 音频附件）
```

## 项目结构

```
voice-to-obsidian/
├── app/                     # 手机端 Expo App
│   ├── App.tsx              # 主页面（登录 → 录音）
│   ├── components/
│   │   └── RecordButton.tsx # 按住录音按钮
│   └── services/
│       ├── auth.ts          # Google OAuth2 登录
│       ├── drive.ts         # Drive 上传
│       └── queue.ts         # 离线重试队列
│
├── service/                 # Mac 后台服务
│   └── src/
│       ├── index.ts         # 轮询主循环
│       ├── drive-poller.ts  # Drive 下载 + 清理
│       └── config.ts        # 环境变量
│
├── .env.example
└── PLAN.md
```

## 前置准备

### 1. Google Cloud Console 配置

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目（或选择已有项目）
3. 启用 **Google Drive API**
4. 创建 OAuth 2.0 凭据：
   - 应用类型选 **Web application**
   - 添加授权重定向 URI（Expo 的 redirect URI，运行 `npx uri-scheme list` 可查看）
5. 记下 `Client ID` 和 `Client Secret`

### 2. Google Drive 文件夹

在 Google Drive 中创建两个文件夹：

- `voice-to-obsidian/pending/` — 手机上传的音频暂存
- `voice-to-obsidian/processed/` — 处理完成后归档

记下两个文件夹的 ID（浏览器地址栏 `folders/` 后面的字符串）。

### 3. 环境变量

复制 `.env.example` 为 `.env` 并填入：

```bash
cp .env.example .env
```

```ini
# Google Drive
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=              # 首次授权后自动获取
DRIVE_PENDING_FOLDER_ID=xxx        # pending 文件夹 ID
DRIVE_PROCESSED_FOLDER_ID=xxx      # processed 文件夹 ID

# Local
DOWNLOAD_DIR=./downloads
POLL_INTERVAL_MS=30000
```

## 安装与运行

### 手机 App

```bash
cd app
npm install
```

在 `app/` 目录下创建 `.env` 文件来配置环境变量：

```bash
cd app
cp .env.example .env  # 如果有 .env.example 的话，或者直接创建 .env
```

在 `.env` 文件中设置以下值：

```ini
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_PENDING_FOLDER_ID=your_pending_folder_id
```

```bash
# 启动开发服务
npx expo start

# 扫描二维码在手机上打开（需安装 Expo Go）
# 或直接运行：
npx expo run:ios
npx expo run:android
```

### Mac 服务

```bash
cd service
npm install
npm run build
npm start

# 开发模式（热重载）
npm run dev
```

## 使用方式

1. 打开 App → 点击 **Google 登录**
2. **按住**录音按钮说话，**松手**自动上传
3. Mac 服务每 30 秒检查新音频，自动处理写入 Obsidian

如果上传时没有网络，录音会存入本地队列，网络恢复后自动重传。

## 后续计划

- [ ] 接入 Whisper API 语音转文字
- [ ] 接入 Claude API 生成摘要
- [ ] Vault 写入（Markdown + 音频附件）
- [ ] launchd 开机自启配置
- [ ] 可选：mlx-whisper 本地转录（免费 + 隐私）
