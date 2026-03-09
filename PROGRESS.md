# 进度记录 (PROGRESS.md)

## 2026-03-09: 解决 APK 启动崩溃问题

- **遇到了什么问题**：之前测试生成的 APK 时应用启动会崩溃。
- **如何解决的**：分析代码后发现，`app/services/auth.ts` 中顶层直接调用了 `AuthSession.makeRedirectUri()`，但在 `app.json` 中并没有配置 `scheme` 字段。Expo SDK 55 中，未配置 scheme 会导致该方法在初始化时直接抛出异常，进而导致应用在启动瞬间崩溃。已经在 `app.json` 中加入了 `"scheme": "voice-to-obsidian"` 修复此问题。
- **以后如何避免**：在集成 Auth、OAuth 等需要用到深度链接的模块时，务必先检查官方文档的配置前置要求，确保 `app.json` 或 `app.config.js` 中的 `scheme` 已经被正确声明。
- **Git commit ID**：3390758d06a53aea71b2308fb914c862357c1b96
