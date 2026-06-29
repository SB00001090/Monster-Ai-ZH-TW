# Monster AI Web UI (React)

Full-featured React interface from `monsterai (1).zip`, integrated at the project root.

> **Note:** The `monsterai/` subfolder is a **reference copy only**. `run.bat` builds and serves UI from **`client/`** at `dist/public/` on **http://127.0.0.1:7860**. Do not run `pnpm dev` inside `monsterai/` alongside `run.bat` (port conflicts).

## Structure

| Path | Purpose |
|------|---------|
| `client/` | React + Vite frontend |
| `server/` | Node.js + tRPC API (incomplete — missing `routers.ts`, `drizzle/schema.ts`) |
| `shared/` | Shared TypeScript constants |
| `drizzle/` | Database migrations |
| `dist/public/` | Production frontend build (served by Python backend) |

## Development

**One-click (Windows):** double-click `run-dev.bat` — starts Python (`run.bat`) then `pnpm dev`.

```bash
cp .env.example .env   # first time
pnpm install
pnpm dev               # Vite (:5173) + tRPC API (:3000), proxies Python at :7860
```

Or start Python backend separately (`run.bat`) for chat, roleplay, and image generation.

## Build

```bash
pnpm exec vite build
```

Python backend (`monster_ai/app.py`) serves `dist/public/` when present.

## Notes

- Manus AI branding and dependencies have been removed.
- Guest mode works without login; data persists to `.monster-data/memory-store.json` when MySQL is not configured.
- Character chats bind `characterId` to conversations, show opening lines, and restore history on reload.
- Chat UI displays character avatars (image or initials fallback).