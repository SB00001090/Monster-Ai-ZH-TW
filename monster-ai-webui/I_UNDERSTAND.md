# 我明白的事（I Understand）

## 這個套件是什麼

- `monster-ai-webui` 是 **Web UI 閘道**，不是完整的 AI 引擎。
- 它負責：
  1. 提供瀏覽器可開的靜態 UI（React 優先，否則 HTML fallback）
  2. 把 `/api/trpc` 等請求轉發到 Node tRPC（`:3000`）
  3. 把 `/api`、`/ws`、`/downloads` 轉發到 Monster AI Python API（`:7861`）
  4. 可選：自動拉起上述兩個後端

## 這個套件不是什麼

- 不包含 LLM、ComfyUI、Discord bot、安全引擎本體——那些仍在 `monster_ai/`。
- 不會在 pip 安裝時自動執行 `npm run build`。
- 不能脫離 Monster AI 原始碼目錄獨立完成「一鍵啟動後端」（需 `MONSTER_AI_ROOT` 或從 repo 內執行）。

## 預設埠

| 服務 | 埠 | 說明 |
|------|-----|------|
| Web UI 閘道 | 7860 | 使用者瀏覽器開這個 |
| Monster AI API | 7861 | 內部 Python API，由閘道代理 |
| Node tRPC | 3000 | 角色/聊天等 React 功能需要 |

## UI 模式

1. **React**：`web/react/` 有 `index.html`（來自 `dist/public`）
2. **HTML fallback**：`web/fallback/`（來自 `monster_ai/web/static`）

建置前請執行：

```bash
# 在 monster-ai 根目錄
npm run build
python monster-ai-webui/scripts/sync_assets.py
```

## 依賴環境

- Python 3.11+
- 若要自動啟動後端：
  - 可寫入的 `monster-ai` repo（含 `main.py`、`monster_ai/`、`server/`）
  - Node.js 20+ 與 **pnpm**
  - 已安裝的 Python 依賴（`requirements.txt` 於 repo 根目錄）

## 與 `run.bat` / `launcher.py` 的關係

- `run.bat` 仍啟動**整合版** Monster AI（UI 掛在 `:7860` 同一進程）。
- `monster-ai-webui` 是**分離 UI 閘道**：UI 在 7860，API 在 7861，適合 pip 分發與獨立升級 UI。

## 環境變數

| 變數 | 用途 |
|------|------|
| `MONSTER_AI_ROOT` | Monster AI repo 根目錄 |
| `MONSTER_API_URL` | Python API 基底 URL |
| `NODE_API_URL` | Node tRPC 基底 URL |
| `MONSTER_WEBUI_ROOT` | 覆寫靜態檔目錄 |
| `MONSTER_PORT` | 啟動 Python API 時使用的埠（launcher 設為 7861） |