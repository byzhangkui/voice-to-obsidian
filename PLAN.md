# Voice-to-Obsidian 技术方案

## 项目结构（Monorepo）

```
voice-to-obsidian/
├── app/                          # 移动端 (Expo/React Native)
│   ├── app/                      # Expo Router 页面
│   │   ├── _layout.tsx           # 根布局
│   │   └── index.tsx             # 主页（录音按钮）
│   ├── components/
│   │   └── RecordButton.tsx      # 按住录音按钮组件
│   ├── services/
│   │   ├── auth.ts               # Google OAuth2 登录
│   │   ├── drive.ts              # Google Drive 上传
│   │   └── queue.ts              # 离线重试队列
│   ├── app.json                  # Expo 配置
│   ├── package.json
│   └── tsconfig.json
│
├── service/                      # Mac 后端服务 (Node.js + TS)
│   ├── src/
│   │   ├── index.ts              # 入口 + 轮询主循环
│   │   ├── drive-poller.ts       # Google Drive 轮询 & 下载
│   │   ├── transcriber.ts        # Whisper API 语音转文字
│   │   ├── summarizer.ts         # Claude API 摘要生成
│   │   ├── vault-writer.ts       # Markdown 生成 & 写入 Vault
│   │   └── config.ts             # 环境变量配置
│   ├── com.voice-to-obsidian.plist  # launchd 自启配置
│   ├── package.json
│   └── tsconfig.json
│
├── .env.example                  # 环境变量模板
├── .gitignore
├── README.md
└── Voice-to-Obsidian-方案文档-1.docx
```

## 核心流程

```
用户按住说话 → 松手 → App 自动上传 .m4a 到 Google Drive pending/
                                    ↓
              Mac Service 每 30s 轮询 → 发现新文件 → 下载
                                    ↓
                        Whisper API → 语音转文字
                                    ↓
                        Claude API → 生成摘要 + 要点
                                    ↓
                    写入 Obsidian Vault（Markdown + 音频附件）
                                    ↓
                        从 Google Drive 删除源文件
```

## Phase 1: Mac 服务 (service/)

### 技术栈
- Node.js + TypeScript
- googleapis SDK — Google Drive 轮询/下载/删除
- OpenAI SDK — Whisper API 语音转文字
- Anthropic SDK — Claude claude-sonnet-4-20250514 摘要
- dotenv — 环境变量管理

### 核心模块

**1. config.ts** — 读取 .env 配置
- GOOGLE_SERVICE_ACCOUNT_KEY 或 OAuth2 credentials
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- OBSIDIAN_VAULT_PATH
- DRIVE_FOLDER_ID (pending 文件夹)
- POLL_INTERVAL_MS (默认 30000)

**2. drive-poller.ts** — Google Drive 轮询
- 每 30s 列出 pending/ 文件夹中的 .m4a 文件
- 下载到本地临时目录
- 处理完成后从 Drive 删除

**3. transcriber.ts** — Whisper 转录
- 调用 OpenAI Whisper API
- 输入 .m4a，输出转录文本
- 支持中英文

**4. summarizer.ts** — Claude 摘要
- 调用 Claude API
- Prompt: 生成摘要 + 关键要点
- 输出结构化内容

**5. vault-writer.ts** — Vault 写入
- 生成 Markdown（frontmatter + 摘要 + 要点 + 原始转录）
- 音频复制到 Attachments/
- Markdown 写入 Voice Notes/

### 生成的笔记格式
```markdown
---
date: 2026-03-09 14:30
tags: [voice-note]
audio: "[[Attachments/audio-20260309-1430.m4a]]"
duration: 2m 34s
---

## 📋 AI 摘要
[摘要内容]

## 💡 关键要点
- 要点 1
- 要点 2

## 📝 原始转录
[完整转录文本]
```

## Phase 2: 移动端 App (app/)

### 技术栈
- Expo SDK 52 + React Native
- Expo Router — 文件路由
- expo-av — 音频录制 (.m4a)
- expo-auth-session — Google OAuth2
- expo-secure-store — Token 安全存储
- AsyncStorage — 离线上传队列

### 核心模块

**1. RecordButton.tsx** — 一键录音
- 长按开始录音，松手结束
- 录音状态动画反馈
- 录完自动触发上传

**2. auth.ts** — Google 登录
- OAuth2 登录，scope: drive.file
- Token 存 expo-secure-store
- 自动刷新 token

**3. drive.ts** — Drive 上传
- 上传 .m4a 到 pending/ 文件夹
- 上传成功后清理本地临时文件

**4. queue.ts** — 离线队列
- 上传失败时存入 AsyncStorage
- 网络恢复后自动重试

## Phase 3: 优化
- Claude prompt 调优
- Markdown 模板迭代
- 错误通知（可选推送）

## Phase 4: 可选
- mlx-whisper 本地替代（免费 + 隐私）
