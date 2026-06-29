# monster-ai-webui

可 pip 安裝的 Monster AI **Web UI 閘道**：打包 React + HTML 雙介面，一鍵啟動 UI 與後端代理。

## 快速開始

### 1. 建置 UI 資產（在 monster-ai 根目錄）

```bash
npm run build
python monster-ai-webui/scripts/sync_assets.py
```

### 2. 安裝套件

```bash
pip install -e ./monster-ai-webui
```

### 3. 啟動

```bash
monster-ai-webui
```

瀏覽器開啟：`http://127.0.0.1:7860`

## CLI 選項

```bash
monster-ai-webui --help
monster-ai-webui --no-launch          # 僅 UI，後端需已運行
monster-ai-webui --no-browser
monster-ai-webui --port 8080
monster-ai-webui --monster-ai-root C:\MonsterAI\monster-ai
```

## 架構

```
Browser → :7860 (monster-ai-webui)
            ├─ 靜態 UI (react 或 fallback)
            ├─ /api/trpc → :3000 Node
            └─ /api, /ws   → :7861 monster_ai
```

詳見 [I_UNDERSTAND.md](./I_UNDERSTAND.md)。

## 疑難排解

| 問題 | 處理 |
|------|------|
| `No bundled UI found` | 執行 `sync_assets.py` |
| `Monster AI repo not found` | 設定 `MONSTER_AI_ROOT` 或 `--monster-ai-root` |
| `pnpm not found` | 安裝 Node 20+ 與 pnpm |
| 只看到 HTML 舊版 | 先 `npm run build` 再 sync |
| 埠 7860 被占用 | `--port 8080` 或關閉舊進程 |

## 與主專案 launcher 的差異

- `scripts/launcher.py` / `run.bat`：單進程 Monster AI（含 UI）
- `monster-ai-webui`：獨立 UI 閘道 + 分離 API 埠（7861）

兩者擇一使用，避免同時占用 7860。