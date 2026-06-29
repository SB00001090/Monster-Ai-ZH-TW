import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type IncidentStatus = "open" | "fixing" | "resolved" | "failed";
export type IncidentSource = "ui" | "trpc" | "api" | "global";

export type ErrorIncident = {
  id: number;
  fingerprint: string;
  source: IncidentSource;
  errorType: string;
  message: string;
  stack?: string | null;
  url?: string | null;
  context?: string | null;
  count: number;
  status: IncidentStatus;
  fixAction?: string | null;
  fixResult?: string | null;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = process.env.MONSTER_DATA_DIR ?? path.join(process.cwd(), ".monster-data");
const STORE_FILE = path.join(DATA_DIR, "error-incidents.json");

let incidents: ErrorIncident[] = [];
let nextId = 1;
let loaded = false;

export function fingerprintError(
  errorType: string,
  message: string,
  stack?: string | null
): string {
  const firstLine =
    stack
      ?.split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return crypto
    .createHash("sha256")
    .update(`${errorType}|${message}|${firstLine}`)
    .digest("hex")
    .slice(0, 16);
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      incidents?: ErrorIncident[];
      nextId?: number;
    };
    incidents = data.incidents ?? [];
    nextId = data.nextId ?? incidents.length + 1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[ErrorIncidents] Failed to load store:", error);
    }
  }
}

async function persist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify({ incidents, nextId }, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.warn("[ErrorIncidents] Failed to persist:", error);
  }
}

export async function upsertIncident(input: {
  source: IncidentSource;
  errorType: string;
  message: string;
  stack?: string | null;
  url?: string | null;
  context?: string | null;
}): Promise<ErrorIncident> {
  await ensureLoaded();
  const fingerprint = fingerprintError(input.errorType, input.message, input.stack);
  const now = new Date().toISOString();
  const existing = incidents.find((i) => i.fingerprint === fingerprint);
  if (existing) {
    existing.count += 1;
    existing.updatedAt = now;
    existing.url = input.url ?? existing.url;
    existing.context = input.context ?? existing.context;
    existing.stack = input.stack ?? existing.stack;
    await persist();
    return existing;
  }
  const entry: ErrorIncident = {
    id: nextId++,
    fingerprint,
    source: input.source,
    errorType: input.errorType,
    message: input.message,
    stack: input.stack ?? null,
    url: input.url ?? null,
    context: input.context ?? null,
    count: 1,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  incidents.unshift(entry);
  await persist();
  return entry;
}

export async function updateIncident(
  id: number,
  patch: Partial<
    Pick<ErrorIncident, "status" | "fixAction" | "fixResult">
  >
): Promise<ErrorIncident | undefined> {
  await ensureLoaded();
  const entry = incidents.find((i) => i.id === id);
  if (!entry) return undefined;
  Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  await persist();
  return entry;
}

export async function getAllIncidents(): Promise<ErrorIncident[]> {
  await ensureLoaded();
  return [...incidents].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getIncidentStats() {
  const all = await getAllIncidents();
  const fixed = all.filter((i) => i.status === "resolved");
  const recurring = all.filter((i) => i.count > 1);
  return {
    totalErrors: all.length,
    fixedErrors: fixed.length,
    recurringErrors: recurring.length,
    fixRate: all.length > 0 ? fixed.length / all.length : 0,
    errors: all,
  };
}

export async function resetIncidentStoreForTests() {
  incidents = [];
  nextId = 1;
  loaded = true;
}