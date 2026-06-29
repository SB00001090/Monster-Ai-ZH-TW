const rpChat = document.getElementById("roleplay-chat");
const rpForm = document.getElementById("roleplay-form");
const rpMessage = document.getElementById("roleplay-message");
const charSelect = document.getElementById("character-select");
const sessionSelect = document.getElementById("session-select");
const newSessionBtn = document.getElementById("new-session");
const cardUpload = document.getElementById("card-upload");

let rpWs;
let currentSessionId = null;

function rpBubble(role, content, name) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  if (name && role === "assistant") div.textContent = `${name}: ${content}`;
  else div.textContent = content;
  rpChat.appendChild(div);
  rpChat.scrollTop = rpChat.scrollHeight;
}

async function loadCharacters() {
  const res = await fetch("/api/roleplay/characters");
  const chars = await res.json();
  charSelect.innerHTML = '<option value="">— Character —</option>';
  chars.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    charSelect.appendChild(opt);
  });
}

async function loadSessions() {
  const res = await fetch("/api/roleplay/sessions");
  const sessions = await res.json();
  sessionSelect.innerHTML = '<option value="">— Session —</option>';
  sessions.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.title} (${s.message_count})`;
    sessionSelect.appendChild(opt);
  });
}

async function loadSession(id) {
  const res = await fetch(`/api/roleplay/sessions/${id}`);
  const session = await res.json();
  rpChat.innerHTML = "";
  session.messages.forEach((m) => {
    rpBubble(m.role, m.content, m.character_name);
  });
}

function connectRoleplayWs() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  rpWs = new WebSocket(`${protocol}//${location.host}/ws/chat`);
  rpWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (document.getElementById("panel-roleplay").classList.contains("active")) {
      rpBubble(data.role || "assistant", data.content, data.character_name);
    }
  };
  rpWs.onclose = () => setTimeout(connectRoleplayWs, 2000);
}

newSessionBtn.addEventListener("click", async () => {
  const charId = charSelect.value || null;
  const res = await fetch("/api/roleplay/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Roleplay", character_id: charId }),
  });
  const session = await res.json();
  currentSessionId = session.id;
  await loadSessions();
  sessionSelect.value = session.id;
  await loadSession(session.id);
});

sessionSelect.addEventListener("change", async () => {
  currentSessionId = sessionSelect.value || null;
  if (currentSessionId) await loadSession(currentSessionId);
});

cardUpload.addEventListener("change", async () => {
  const file = cardUpload.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  await fetch("/api/roleplay/characters/upload", { method: "POST", body: fd });
  await loadCharacters();
  cardUpload.value = "";
});

rpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = rpMessage.value.trim();
  if (!text) return;
  if (!currentSessionId) {
    rpBubble("system", "Create or select a session first.");
    return;
  }
  rpBubble("user", text);
  if (rpWs && rpWs.readyState === WebSocket.OPEN) {
    rpWs.send(JSON.stringify({
      message: text,
      session_id: currentSessionId,
      character_id: charSelect.value || undefined,
    }));
  } else {
    const res = await fetch(`/api/roleplay/sessions/${currentSessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, character_id: charSelect.value || null }),
    });
    const data = await res.json();
    rpBubble("assistant", data.content, data.character_name);
  }
  rpMessage.value = "";
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab === "roleplay") {
      loadCharacters();
      loadSessions();
    }
  });
});

let lastPortraitPath = null;

charSelect.addEventListener("change", async () => {
  const id = charSelect.value;
  if (!id) return;
  try {
    const card = await fetch(`/api/roleplay/characters/${id}`).then((r) => r.json());
    document.getElementById("portrait-desc").value = card.description || "";
  } catch { /* ignore */ }
});

document.getElementById("btn-portrait").addEventListener("click", async () => {
  const charId = charSelect.value;
  const el = document.getElementById("portrait-result");
  const setBtn = document.getElementById("btn-set-avatar");
  if (!charId) {
    el.textContent = "Select a character first.";
    return;
  }
  setBtn.disabled = true;
  lastPortraitPath = null;
  el.textContent = "Generating portrait…";
  try {
    const data = await fetch(`/api/roleplay/characters/${charId}/portrait`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: document.getElementById("portrait-desc").value.trim() || null,
        quality_filter: true,
      }),
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
    el.innerHTML = "";
    const img = document.createElement("img");
    img.src = data.url;
    el.appendChild(img);
    lastPortraitPath = data.path;
    setBtn.disabled = false;
  } catch (e) {
    el.textContent = `Error: ${e.message}`;
  }
});

document.getElementById("btn-set-avatar").addEventListener("click", async () => {
  const charId = charSelect.value;
  if (!charId || !lastPortraitPath) return;
  const el = document.getElementById("portrait-result");
  try {
    await fetch(`/api/roleplay/characters/${charId}/avatar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: lastPortraitPath }),
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
    el.appendChild(document.createElement("p")).textContent = "Avatar updated.";
    await loadCharacters();
  } catch (e) {
    el.textContent = `Error: ${e.message}`;
  }
});

connectRoleplayWs();
loadCharacters();
loadSessions();