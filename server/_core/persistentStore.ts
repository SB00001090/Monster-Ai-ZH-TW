import fs from "node:fs/promises";
import path from "node:path";
import { memoryStore } from "./memoryStore";

memoryStore.setMutateHandler(() => schedulePersist());

const DATA_DIR = process.env.MONSTER_DATA_DIR ?? path.join(process.cwd(), ".monster-data");
const STORE_FILE = path.join(DATA_DIR, "memory-store.json");

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function persistenceEnabled() {
  return !process.env.DATABASE_URL;
}

export async function loadPersistentStore() {
  if (!persistenceEnabled()) return;

  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const data = JSON.parse(raw) as unknown;
    memoryStore.hydrate(data);
    console.log(`[Store] Loaded data from ${STORE_FILE}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[Store] Failed to load persistent store:", error);
    }
  }
}

export async function persistStore() {
  if (!persistenceEnabled()) return;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload = JSON.stringify(memoryStore.serialize(), null, 2);
    await fs.writeFile(STORE_FILE, payload, "utf-8");
  } catch (error) {
    console.warn("[Store] Failed to persist store:", error);
  }
}

export function schedulePersist() {
  if (!persistenceEnabled()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persistStore();
  }, 400);
}