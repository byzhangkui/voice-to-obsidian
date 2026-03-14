# 进度记录 (PROGRESS.md)

## 2026-03-09: 解决 APK 启动崩溃问题

- **遇到了什么问题**：之前测试生成的 APK 时应用启动会崩溃。
- **如何解决的**：分析代码后发现，`app/services/auth.ts` 中顶层直接调用了 `AuthSession.makeRedirectUri()`，但在 `app.json` 中并没有配置 `scheme` 字段。Expo SDK 55 中，未配置 scheme 会导致该方法 在初始化时直接抛出异常，进而导致应用在启动瞬间崩溃。已经在 `app.json` 中加入了 `"scheme": "voice-to-obsidian"` 修复此问题。
- **以后如何避免**：在集成 Auth、OAuth 等需要用到深度链接的模块时，务必先检查官方文档的配置前置要求，确保 `app.json` 或 `app.config.js` 中的 `scheme` 已经被正确声明。
- **Git commit ID**：3390758d06a53aea71b2308fb914c862357c1b96

## 2026-03-12: 修复本地 Android 编译报错

- **遇到了什么问题**：本地编译 Android APK 时失败。第一步 `expo prebuild` 报错 `Could not find MIME for Buffer <null>`；第二步 gradle 编译因版本兼容性及网络下载慢问题失败。
- **如何解决的**：
  1. 发现 `splash-icon.png` 是一张 8-bit colormap 图片，导致 expo 的 jimp 库处理报错，将其转换为 RGBA 格式后解决。
  2. 更改生成的 `gradle-wrapper.properties` 版本为 `8.13`，并配置国内镜像源以修复因 Gradle 9.0 导致的插件不兼容和下载慢的问题。
- **以后如何避免**：添加自定义应用图标和启动图时，要确保其图片格式为标准的 RGBA（例如 32-bit PNG）。在进行 Android 构建遇到版本不兼容问题时，要灵活调整 Gradle 版本及使用国内镜像源加速下载。
- **Git commit ID**：efbef13e39b429311b88ffbbfa3e7b8dad9d60c7

## 2026-03-12: 修复独立 Android APK 中 Google 登录 400 invalid_request 问题

- **遇到了什么问题**：在 Android 独立应用（APK）中使用 `expo-auth-session` 拉起 Google 登录时，Google 授权页面报错 `400 invalid_request`。
- **如何解决的**：
  1. 该问题源于 Google 对使用浏览器进行 OAuth 授权的严格限制。Android 原生 Client ID 必须由 Google Play Services 原生 SDK 拉起，而 Web Client ID 则强制要求 redirect URI 必须以 `http` 或 `https` 开头，不允许使用应用包名的自定义 scheme。
  2. **解决方案**：在 Google Cloud Console 中创建一个 **iOS** 类型的 Client ID，并将 `Bundle ID` 填入 Android 的包名（如 `com.voicetoobsidian.app`）。iOS 类型的应用不受该限制，并允许自定义 scheme。
  3. 将该 iOS Client ID 配置在环境变中，并在 `app/services/auth.ts` 中手动固定 `redirectUri` 为 `com.voicetoobsidian.app:/oauth2redirect`。
  4. 同时更新 `app/app.json` 中的 `scheme` 字段，支持该自定义协议头。
- **以后如何避免**：在使用 Expo 和 React Native 实现跨平台 Google OAuth 时，应熟知各平台的跳转限制。对于无后端代理且依赖 Expo 纯网页跳转授权的独立 App，直接使用 iOS Client ID + 自定义 scheme 是绕过 Google Redirect URI 限制的标准实践。
- **Git commit ID**：(Pending)
