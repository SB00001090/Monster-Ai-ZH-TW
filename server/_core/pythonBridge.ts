const PYTHON_API =
  process.env.PYTHON_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:7860";

async function pythonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PYTHON_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Python API ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export type PythonCharacterListItem = {
  id: string;
  name: string;
  file?: string;
  avatar_url?: string;
};

export type PythonCharacter = {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  system_prompt?: string;
  avatar?: string | null;
};

export type PythonImageResult = {
  path?: string;
  url?: string;
  prompt?: string;
  negative?: string;
  warning?: string;
};

export type PythonVideoResult = {
  path?: string;
  url?: string;
  prompt?: string;
};

export async function pythonHealth() {
  return pythonFetch<{ status: string; llm_backend?: string }>("/health");
}

export async function pythonStatus() {
  return pythonFetch<Record<string, unknown>>("/status");
}

export async function listPythonCharacters() {
  return pythonFetch<PythonCharacterListItem[]>("/api/roleplay/characters");
}

export async function getPythonCharacter(characterId: string) {
  return pythonFetch<PythonCharacter>(`/api/roleplay/characters/${characterId}`);
}

export async function importPythonCharacter(card: Record<string, unknown>) {
  return pythonFetch<{ id: string; name: string }>("/api/roleplay/characters/import", {
    method: "POST",
    body: JSON.stringify({ card }),
  });
}

export async function deletePythonCharacter(characterId: string) {
  return pythonFetch<{ success: boolean }>(`/api/roleplay/characters/${characterId}`, {
    method: "DELETE",
  });
}

export async function uploadPythonCharacter(buffer: Buffer, filename: string) {
  const form = new FormData();
  const blob = new Blob([buffer], {
    type: filename.toLowerCase().endsWith(".png") ? "image/png" : "application/json",
  });
  form.append("file", blob, filename);

  const res = await fetch(`${PYTHON_API}/api/roleplay/characters/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Python API upload failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ id: string; name: string }>;
}

export async function createPythonSession(title: string, characterId?: string) {
  return pythonFetch<{ id: string; title: string }>("/api/roleplay/sessions", {
    method: "POST",
    body: JSON.stringify({
      title,
      character_id: characterId ?? null,
    }),
  });
}

export async function sendPythonMessage(
  sessionId: string,
  message: string,
  characterId?: string
) {
  return pythonFetch<{ content: string; role: string; character_name?: string }>(
    `/api/roleplay/sessions/${sessionId}/message`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        character_id: characterId ?? null,
        user_id: "web-ui",
      }),
    }
  );
}

export async function generatePythonPortrait(
  characterId: string,
  body: {
    description?: string;
    width?: number;
    height?: number;
    quality_filter?: boolean;
  }
) {
  return pythonFetch<PythonImageResult>(
    `/api/roleplay/characters/${characterId}/portrait`,
    {
      method: "POST",
      body: JSON.stringify({
        description: body.description,
        width: body.width,
        height: body.height,
        quality_filter: body.quality_filter ?? true,
      }),
    }
  );
}

export async function generatePythonImage(body: {
  prompt: string;
  negative?: string;
  width?: number;
  height?: number;
  style?: string;
  checkpoint?: string;
}) {
  return pythonFetch<PythonImageResult>("/api/generate/image", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function generatePythonVideo(body: {
  prompt: string;
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
}) {
  return pythonFetch<PythonVideoResult>("/api/generate/video", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listPythonCheckpoints() {
  return pythonFetch<{ checkpoints: string[]; active?: string }>(
    "/api/generate/checkpoints"
  );
}

export function toCharacterCard(input: {
  id?: string;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  systemPrompt?: string | null;
}) {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    personality: input.description,
    scenario: input.worldview,
    first_mes: input.openingLine,
    system_prompt: input.systemPrompt ?? undefined,
  };
}