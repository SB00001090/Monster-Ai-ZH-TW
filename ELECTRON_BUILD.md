# MonsterAi Electron 應用構建指南

## 系統要求

- Node.js 18+
- pnpm 10+
- Python 3.8+ (用於 node-gyp)
- 構建工具（根據平台不同）

### Windows
- Visual Studio Build Tools 或 Visual Studio Community
- Windows SDK

### macOS
- Xcode Command Line Tools
- `xcode-select --install`

### Linux
- build-essential
- libx11-dev
- libxext-dev

## 本地構建

### 1. 安裝依賴
```bash
pnpm install
```

### 2. 開發模式
```bash
pnpm electron-dev
```

### 3. 構建應用

#### Windows
```bash
pnpm electron-build:win
```

#### macOS
```bash
pnpm electron-build:mac
```

#### Linux
```bash
pnpm electron-build:linux
```

#### 全平台
```bash
pnpm electron-build:all
```

## 輸出文件

構建完成後，可執行文件位於 `dist/` 目錄：

- **Windows**: `MonsterAi-x.x.x.exe` (安裝程序)
- **Windows**: `MonsterAi-x.x.x-portable.exe` (便攜版)
- **macOS**: `MonsterAi-x.x.x.dmg` (磁盤映像)
- **Linux**: `MonsterAi-x.x.x.AppImage` (AppImage)

## GitHub Actions 自動構建

推送到 `main` 分支或創建標籤時，GitHub Actions 會自動構建所有平台的應用。

### 發布新版本

1. 更新 `package.json` 中的版本號
2. 創建 Git 標籤：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 會自動構建並創建 Release

## 代碼簽名

### Windows 簽名
在 `electron-builder.json` 中配置：
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

### macOS 簽名
設置環境變量：
```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=password
```

## 故障排除

### 構建失敗
1. 清除緩存：`pnpm clean && pnpm install`
2. 檢查 Node.js 版本：`node --version`
3. 檢查依賴：`pnpm list`

### 應用無法啟動
1. 檢查日誌：應用數據目錄中的 `logs/` 文件夾
2. 檢查開發工具：`Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS)

## 自動更新

應用支持自動更新。更新服務器配置在 `electron-builder.json` 中：

```json
"publish": {
  "provider": "generic",
  "url": "https://releases.monsterai.app/"
}
```

## 離線使用

應用支持離線模式。所有數據存儲在本地：
- Windows: `%APPDATA%/MonsterAi/offline-data.json`
- macOS: `~/Library/Application Support/MonsterAi/offline-data.json`
- Linux: `~/.config/MonsterAi/offline-data.json`
