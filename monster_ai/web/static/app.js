const chatEl = document.getElementById("chat");
const form = document.getElementById("form");
const messageInput = document.getElementById("message");
const personaInput = document.getElementById("persona");
const personaModeSelect = document.getElementById("persona-mode");
const statusEl = document.getElementById("status");
const securityToasts = document.getElementById("security-toasts");
const monsterlockDot = document.getElementById("monsterlock-dot");
const monsterlockLabel = document.getElementById("monsterlock-label");
const monsterlockEvents = document.getElementById("monsterlock-events");
const crimeguardDot = document.getElementById("crimeguard-dot");
const crimeguardLabel = document.getElementById("crimeguard-label");
const crimeguardEvents = document.getElementById("crimeguard-events");
const guardianDot = document.getElementById("guardian-dot");
const guardianLabel = document.getElementById("guardian-label");
const guardianEvents = document.getElementById("guardian-events");
const hardwareTierEl = document.getElementById("hardware-tier");

const PERSONA_KEY = "monster_ai_persona";
const PERSONA_MODE_KEY = "monster_ai_persona_mode";

let ws;
let securityWs;
let connected = false;

function addBubble(role, content) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setStatus(text, level = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${level}`;
}

async function fetchHealth() {
  try {
    const res = await fetch("/status");
    const data = await res.json();
    const backend = data.repair?.active_backend || "unknown";
    const ok = data.repair?.primary_ok;
    const tier = data.hardware?.tier || "unknown";
    if (hardwareTierEl) hardwareTierEl.textContent = `tier: ${tier}`;
    setStatus(
      ok ? `Online · ${backend} · ${tier}` : `Fallback · ${backend} · ${tier}`,
      ok ? "ok" : "warn"
    );
  } catch {
    setStatus("Server unreachable", "warn");
  }
}

function updateMonsterLockUI(ml) {
  if (!monsterlockDot || !ml) return;
  const protected_ = ml.green_dot && ml.armed;
  monsterlockDot.className = "monsterlock-dot";
  if (!ml.enabled) {
    monsterlockDot.classList.add("off");
    if (monsterlockLabel) monsterlockLabel.textContent = "MonsterLock 關閉";
  } else if (protected_) {
    monsterlockDot.classList.add("on");
    if (monsterlockLabel) monsterlockLabel.textContent = "MonsterLock 保護中";
  } else {
    monsterlockDot.classList.add("warn");
    if (monsterlockLabel) monsterlockLabel.textContent = "MonsterLock 警示";
  }
  if (!monsterlockEvents) return;
  const events = ml.events || [];
  monsterlockEvents.innerHTML = events
    .map((ev) => {
      const t = new Date((ev.ts || 0) * 1000).toLocaleTimeString();
      const lvl = ev.level || "ok";
      return `<li class="${lvl}">[${t}] ${ev.message || ""}</li>`;
    })
    .join("") || "<li>尚無事件</li>";
}

async function fetchMonsterLock() {
  try {
    const res = await fetch("/api/security/monsterlock");
    const data = await res.json();
    updateMonsterLockUI(data);
  } catch {
    if (monsterlockDot) monsterlockDot.className = "monsterlock-dot off";
  }
}

function updateCrimeGuardUI(cg) {
  if (!crimeguardDot || !cg) return;
  crimeguardDot.className = "crimeguard-dot";
  if (!cg.enabled) {
    crimeguardDot.classList.add("off");
    if (crimeguardLabel) crimeguardLabel.textContent = "CrimeGuard 關閉";
  } else if (cg.network_locked || cg.red_dot) {
    crimeguardDot.classList.add("locked");
    const extra = cg.device_contact_type || cg.vpn_type || "";
    const tag = extra ? ` · ${extra}` : "";
    if (crimeguardLabel) crimeguardLabel.textContent = `已鎖定${tag}`;
  } else if (cg.device_contact_detected || cg.vpn_detected) {
    crimeguardDot.classList.add("alert");
    if (cg.device_contact_detected && crimeguardLabel) {
      crimeguardLabel.textContent = `設備聯繫 · ${cg.device_contact_type || "偵測中"}`;
    } else if (crimeguardLabel) {
      crimeguardLabel.textContent = "VPN 偵測中";
    }
  } else {
    crimeguardDot.classList.add("ok");
    if (crimeguardLabel) crimeguardLabel.textContent = "CrimeGuard 正常";
  }
  if (!crimeguardEvents) return;
  const events = cg.events || [];
  crimeguardEvents.innerHTML = events
    .map((ev) => {
      const t = new Date((ev.ts || 0) * 1000).toLocaleTimeString();
      const tag = ev.device_contact?.contact_type || ev.vpn_type || "";
      const tagStr = tag ? ` [${tag}]` : "";
      const preview = ev.prompt_preview ? ` — ${ev.prompt_preview}` : "";
      return `<li class="${ev.level || "ok"}">[${t}]${tagStr} ${ev.message || ""}${preview}</li>`;
    })
    .join("") || "<li>尚無事件</li>";
}

async function fetchCrimeGuard() {
  try {
    const res = await fetch("/api/security/crimeguard");
    const data = await res.json();
    updateCrimeGuardUI(data);
  } catch {
    if (crimeguardDot) crimeguardDot.className = "crimeguard-dot off";
  }
}

function updateGuardianUI(g) {
  if (!guardianDot || !g) return;
  guardianDot.className = "guardian-dot";
  if (!g.enabled) {
    guardianDot.classList.add("off");
    if (guardianLabel) guardianLabel.textContent = "Guardian 關閉";
  } else {
    guardianDot.classList.add("ok");
    if (guardianLabel) guardianLabel.textContent = "Guardian 就緒";
  }
  if (!guardianEvents) return;
  const notes = [];
  if (g.no_tailscale) notes.push("Tunnel only · 無 Tailscale");
  if (g.no_qr_code) notes.push("無 QR Code");
  if (g.character_share) notes.push("角色分享已啟用");
  guardianEvents.innerHTML = notes.map((n) => `<li class="ok">${n}</li>`).join("")
    || "<li>Guardian Ai 平台運作中</li>";
}

async function fetchGuardian() {
  try {
    const res = await fetch("/api/guardian/status");
    const data = await res.json();
    updateGuardianUI(data);
  } catch {
    if (guardianDot) guardianDot.className = "guardian-dot off";
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws/chat`);

  ws.onopen = () => {
    connected = true;
    fetchHealth();
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    addBubble(data.role || "assistant", data.content);
    if (data.backend) {
      fetchHealth();
    }
  };

  ws.onclose = () => {
    connected = false;
    setStatus("Disconnected — reconnecting…", "warn");
    setTimeout(connect, 2000);
  };

  ws.onerror = () => ws.close();
}

function getPersonaMode() {
  return personaModeSelect?.value || "grok";
}

function getPersona() {
  if (getPersonaMode() !== "custom") return undefined;
  const text = personaInput.value.trim();
  return text || undefined;
}

function updatePersonaUi() {
  const mode = getPersonaMode();
  if (personaInput) {
    personaInput.disabled = mode !== "custom";
    personaInput.placeholder =
      mode === "custom"
        ? "Custom system prompt…"
        : mode === "grok"
          ? "Grok persona active (server-side)"
          : "No system prompt";
  }
}

function showSecurityToast(alert) {
  if (!securityToasts) return;
  const div = document.createElement("div");
  div.className = `security-toast ${alert.level || "warn"}`;
  const ip = alert.ip ? ` · ${alert.ip}` : "";
  div.textContent = `${alert.message || "Security alert"}${ip}`;
  securityToasts.appendChild(div);
  setTimeout(() => div.remove(), 8000);
}

function connectSecurityAlerts() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  securityWs = new WebSocket(`${protocol}//${location.host}/api/security/ws/alerts`);

  securityWs.onmessage = (event) => {
    try {
      showSecurityToast(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };

  securityWs.onclose = () => setTimeout(connectSecurityAlerts, 5000);
  securityWs.onerror = () => securityWs.close();
}

personaInput.addEventListener("input", () => {
  localStorage.setItem(PERSONA_KEY, personaInput.value);
});

personaModeSelect?.addEventListener("change", () => {
  localStorage.setItem(PERSONA_MODE_KEY, getPersonaMode());
  updatePersonaUi();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !connected) return;

  const payload = { message: text, persona_mode: getPersonaMode() };
  const system = getPersona();
  if (system) payload.system = system;

  addBubble("user", text);
  ws.send(JSON.stringify(payload));
  messageInput.value = "";
});

const savedPersona = localStorage.getItem(PERSONA_KEY);
if (savedPersona) personaInput.value = savedPersona;

const savedMode = localStorage.getItem(PERSONA_MODE_KEY);
if (savedMode && personaModeSelect) personaModeSelect.value = savedMode;

async function loadServerPersonaDefaults() {
  try {
    const res = await fetch("/config");
    const data = await res.json();
    const mode = data.persona?.default_mode;
    if (mode && personaModeSelect && !localStorage.getItem(PERSONA_MODE_KEY)) {
      personaModeSelect.value = mode;
    }
  } catch {
    /* ignore */
  }
  updatePersonaUi();
}

loadServerPersonaDefaults();

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

addBubble("system", "Welcome to Guardian Ai. All processing stays on your machine.");
connect();
connectSecurityAlerts();
fetchMonsterLock();
fetchCrimeGuard();
fetchGuardian();
setInterval(fetchHealth, 15000);
setInterval(fetchMonsterLock, 1000);
setInterval(fetchCrimeGuard, 1000);
setInterval(fetchGuardian, 5000);