async function postJson(url, body, timeoutMs = 600000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || res.statusText);
    }
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Try fewer frames or start ComfyUI.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const IMG_NEGATIVE_KEY = "monster_img_negative";
const IMG_MODEL_KEY = "monster_img_model";
const FALLBACK_DEFAULT_NEGATIVE =
  "deformed, distorted, disfigured, bad anatomy, extra limbs, missing limbs, " +
  "fused fingers, text, watermark, blurry, low quality, oversaturated, " +
  "monochrome noise, jpeg artifacts, black image, white image, ugly, duplicate";

async function initNegativePrompt() {
  const el = document.getElementById("img-negative");
  if (!el) return;
  const stored = localStorage.getItem(IMG_NEGATIVE_KEY);
  if (stored) {
    el.value = stored;
    return;
  }
  let negative = FALLBACK_DEFAULT_NEGATIVE;
  try {
    const defaults = await fetch("/api/generate/defaults").then((r) => r.json());
    if (defaults.default_negative) negative = defaults.default_negative;
  } catch { /* use fallback */ }
  el.value = negative;
  localStorage.setItem(IMG_NEGATIVE_KEY, negative);
}

function saveNegativePrompt() {
  const el = document.getElementById("img-negative");
  if (el) localStorage.setItem(IMG_NEGATIVE_KEY, el.value);
}

function updateModelStatusHint(presets, selectedId) {
  const ckptEl = document.getElementById("ckpt-status");
  if (!ckptEl || !presets?.length) return;
  const selected = presets.find((p) => p.id === selectedId) || presets[0];
  if (!selected) return;
  const ckpt = selected.checkpoint || "auto";
  if (selected.available === false) {
    ckptEl.textContent = `${selected.label_zh}: 缺少對應模型，請下載 checkpoint`;
    return;
  }
  ckptEl.textContent = `${selected.label_zh} → ${ckpt}`;
}

function matchCkpt(checkpoints, hints) {
  for (const hint of hints) {
    const found = checkpoints.find((c) => c.toLowerCase().includes(hint));
    if (found) return found;
  }
  return null;
}

function buildFallbackPresets(checkpoints) {
  const ckpts = checkpoints || [];
  const realistic = matchCkpt(ckpts, ["cyberrealistic", "realistic", "sdxl"]);
  const anime = matchCkpt(ckpts, ["counterfeit", "anime", "anything"]);
  const sd15 = matchCkpt(ckpts, ["v1-5", "sd15", "1.5", "pruned"]);
  return [
    {
      id: "auto",
      label_zh: "自動",
      checkpoint: ckpts[0] || null,
      available: ckpts.length > 0,
    },
    {
      id: "realistic",
      label_zh: "寫實風",
      checkpoint: realistic,
      available: !!realistic,
    },
    {
      id: "anime",
      label_zh: "動漫風",
      checkpoint: anime,
      available: !!anime,
    },
    {
      id: "sd15",
      label_zh: "通用 SD1.5",
      checkpoint: sd15,
      available: !!sd15,
    },
  ];
}

function renderModelPresetOptions(sel, presets) {
  sel.innerHTML = "";
  presets.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    const ckpt = p.checkpoint ? ` · ${p.checkpoint}` : "";
    opt.textContent = `${p.label_zh}${ckpt}`;
    if (p.available === false) {
      opt.textContent += " (未安裝)";
      opt.disabled = true;
    }
    sel.appendChild(opt);
  });
  const saved = localStorage.getItem(IMG_MODEL_KEY);
  if (saved && presets.some((p) => p.id === saved && p.available !== false)) {
    sel.value = saved;
  }
  updateModelStatusHint(presets, sel.value);
}

async function loadModelPresets(checkpointsFromCaller) {
  const sel = document.getElementById("img-model");
  if (!sel) return [];
  let checkpoints = checkpointsFromCaller;
  if (!checkpoints) {
    try {
      const ckpt = await fetch("/api/generate/checkpoints").then((r) => r.json());
      checkpoints = ckpt.checkpoints || [];
    } catch {
      checkpoints = [];
    }
  }
  try {
    const res = await fetch("/api/generate/model-presets");
    if (!res.ok) throw new Error("model-presets unavailable");
    const data = await res.json();
    const presets = data.presets?.length ? data.presets : buildFallbackPresets(checkpoints);
    renderModelPresetOptions(sel, presets);
    return presets;
  } catch {
    const presets = buildFallbackPresets(checkpoints);
    renderModelPresetOptions(sel, presets);
    return presets;
  }
}

async function loadGenerateAssets() {
  const ckptEl = document.getElementById("ckpt-status");
  const loraSelect = document.getElementById("img-lora");
  try {
    await initNegativePrompt();
    const ckpt = await fetch("/api/generate/checkpoints").then((r) => r.json());
    const presets = await loadModelPresets(ckpt.checkpoints || []);
    const modelSel = document.getElementById("img-model");
    if (!modelSel || modelSel.value === "auto") {
      if (ckpt.active) {
        ckptEl.textContent = `Checkpoint: ${ckpt.active} (${ckpt.config})`;
      } else if (ckpt.checkpoints?.length) {
        ckptEl.textContent = `Checkpoints: ${ckpt.checkpoints.join(", ")}`;
      } else {
        ckptEl.textContent = "No checkpoint in ComfyUI — add .safetensors to models/checkpoints/";
      }
    } else {
      updateModelStatusHint(presets, modelSel.value);
    }
    const loras = await fetch("/api/generate/loras").then((r) => r.json());
    loraSelect.innerHTML = '<option value="">— None —</option>';
    let antiDefault = false;
    (loras.loras || []).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      loraSelect.appendChild(opt);
      if (name.toLowerCase().includes("anti_collapse")) antiDefault = name;
    });
    if (antiDefault) loraSelect.value = antiDefault;
  } catch {
    ckptEl.textContent = "Could not load ComfyUI assets";
  }
}

const strengthInput = document.getElementById("img-lora-strength");
const strengthVal = document.getElementById("img-lora-strength-val");
strengthInput.addEventListener("input", () => {
  strengthVal.textContent = strengthInput.value;
});

document.getElementById("img-negative")?.addEventListener("input", saveNegativePrompt);
document.getElementById("img-model")?.addEventListener("change", async (e) => {
  localStorage.setItem(IMG_MODEL_KEY, e.target.value);
  try {
    const presets = await fetch("/api/generate/model-presets").then((r) => r.json());
    updateModelStatusHint(presets.presets || [], e.target.value);
  } catch { /* ignore */ }
});
initNegativePrompt();

async function checkModuleHealth(moduleName) {
  const res = await fetch("/status");
  const data = await res.json();
  const mod = data.modules?.[moduleName];
  if (!mod?.enabled) return `${moduleName} is disabled in config.yaml`;
  if (!mod?.healthy) return mod.message || `Start ${moduleName} backend first`;
  return null;
}

function formatHealthError(moduleName, err) {
  if (!err) return err;
  const lower = err.toLowerCase();
  if (lower.includes("comfyui") && !lower.includes("start")) return err;
  if (moduleName === "video" && lower.includes("ffmpeg")) return err;
  if (lower.includes("start comfyui") || lower.includes("comfyui is not")) {
    return `${err} — http://127.0.0.1:8188`;
  }
  return err;
}

function updateVideoPreviewRatio() {
  const box = document.getElementById("vid-preview");
  const w = parseInt(document.getElementById("vid-width")?.value, 10) || 512;
  const h = parseInt(document.getElementById("vid-height")?.value, 10) || 512;
  if (box) box.style.aspectRatio = `${w} / ${h}`;
}

function clearVideoPreview() {
  const previewBox = document.getElementById("vid-preview");
  const playerEl = document.getElementById("vid-player");
  const actionsEl = document.getElementById("vid-actions");
  const metaEl = document.getElementById("vid-meta");
  if (playerEl) playerEl.innerHTML = "";
  if (actionsEl) {
    actionsEl.innerHTML = "";
    actionsEl.hidden = true;
  }
  if (metaEl) metaEl.textContent = "";
  if (previewBox) {
    previewBox.classList.remove("has-video", "is-generating");
  }
}

function showVideoGenerating() {
  const previewBox = document.getElementById("vid-preview");
  const playerEl = document.getElementById("vid-player");
  if (!previewBox || !playerEl) return;
  previewBox.classList.add("is-generating");
  previewBox.classList.remove("has-video");
  playerEl.innerHTML =
    '<div class="video-gen-overlay"><span class="video-gen-spinner"></span><span>ComfyUI 渲染中…</span></div>';
}

function showVideoResult(data) {
  const previewBox = document.getElementById("vid-preview");
  const playerEl = document.getElementById("vid-player");
  const actionsEl = document.getElementById("vid-actions");
  const metaEl = document.getElementById("vid-meta");
  const statusEl = document.getElementById("vid-status");

  if (!data?.url) {
    if (statusEl) statusEl.textContent = "No video URL in response";
    return;
  }
  if (previewBox) {
    previewBox.classList.remove("is-generating");
    previewBox.classList.add("has-video");
  }
  if (statusEl) statusEl.textContent = "Video ready — click play below";
  if (playerEl) playerEl.innerHTML = "";

  const url = `${data.url}?t=${Date.now()}`;
  const vid = document.createElement("video");
  vid.controls = true;
  vid.playsInline = true;
  vid.preload = "auto";
  vid.setAttribute("playsinline", "");
  const src = document.createElement("source");
  src.src = url;
  src.type = "video/mp4";
  vid.appendChild(src);
  vid.appendChild(document.createTextNode("Your browser cannot play MP4."));
  vid.addEventListener("loadeddata", () => {
    if (statusEl) statusEl.textContent = "Video loaded — ready to play";
  });
  vid.addEventListener("error", () => {
    if (statusEl) {
      statusEl.textContent = "Preview failed — use Open / Download links below";
    }
  });
  playerEl?.appendChild(vid);

  if (actionsEl) {
    actionsEl.innerHTML = "";
    actionsEl.hidden = false;
    const open = document.createElement("a");
    open.href = data.url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open in new tab";
    const dl = document.createElement("a");
    dl.href = data.url;
    dl.download = data.url.split("/").pop() || "video.mp4";
    dl.textContent = "Download .mp4";
    actionsEl.append(open, dl);
  }

  if (data.width && data.height && previewBox) {
    previewBox.style.aspectRatio = `${data.width} / ${data.height}`;
  }

  const meta = [];
  if (data.prompt) meta.push(`Prompt: ${data.prompt.slice(0, 80)}…`);
  if (data.frames) meta.push(`Frames: ${data.frames}`);
  if (data.fps) meta.push(`FPS: ${data.fps}`);
  if (data.width) meta.push(`${data.width}×${data.height}`);
  if (data.mode) meta.push(`Mode: ${data.mode}`);
  if (metaEl) metaEl.textContent = meta.join(" · ");
  vid.load();
}

function showResult(el, data, type) {
  el.innerHTML = "";
  if (type === "video" && data.url) {
    showVideoResult(data);
    return;
  }
  if (type === "image" && data.url) {
    const img = document.createElement("img");
    img.src = data.url;
    img.alt = "Generated";
    el.appendChild(img);
  } else if (type === "audio" && data.url) {
    const audio = document.createElement("audio");
    audio.src = data.url;
    audio.controls = true;
    el.appendChild(audio);
  }
  const meta = [];
  if (data.prompt) meta.push(`Prompt: ${data.prompt}`);
  if (data.negative) {
    const neg =
      data.negative.length > 80 ? `${data.negative.slice(0, 80)}…` : data.negative;
    meta.push(`Negative: ${neg}`);
  }
  if (data.style) meta.push(`Style: ${data.style}`);
  if (data.checkpoint) meta.push(`Model: ${data.checkpoint}`);
  if (data.lora) meta.push(`LoRA: ${data.lora}`);
  if (data.mode) meta.push(`Mode: ${data.mode}`);
  if (data.frames) meta.push(`Frames: ${data.frames}`);
  if (data.fps) meta.push(`FPS: ${data.fps}`);
  if (data.width) meta.push(`${data.width}x${data.height}`);
  if (data.format) meta.push(data.format);
  if (data.warning) meta.push(data.warning);
  if (data.quality) {
    meta.push(`Quality: ${data.quality.score} (${data.quality.attempts} attempts)`);
    if (data.quality.issues?.length) meta.push(`Issues: ${data.quality.issues.join(", ")}`);
    if (data.quality.escalated) meta.push("Escalated to safe workflow");
    if (!data.quality.passed) {
      const warn = document.createElement("p");
      warn.className = "quality-warn";
      warn.textContent =
        "Collapse detected after retries — enable anti_collapse LoRA, lower CFG, or simplify prompt.";
      el.prepend(warn);
      meta.push("Warning: collapse image — retry with anti_collapse LoRA");
    }
  }
  if (meta.length) {
    const p = document.createElement("p");
    p.className = "prompt-used";
    p.textContent = meta.join(" · ");
    el.appendChild(p);
  }
}

function runWithProgress(statusEl, label, fn, pollProgress = false) {
  const start = Date.now();
  if (statusEl) statusEl.textContent = `${label}… 0s`;
  let stopped = false;
  const tick = setInterval(async () => {
    if (stopped || !statusEl) return;
    const sec = Math.floor((Date.now() - start) / 1000);
    let extra = "";
    if (pollProgress) {
      try {
        const p = await fetch("/api/generate/progress").then((r) => r.json());
        if (p.message) extra = ` · ${p.message}`;
        if (p.total) extra += ` (${p.frame || 0}/${p.total})`;
        const overlay = document.querySelector("#vid-player .video-gen-overlay span:last-child");
        if (overlay) {
          let line = p.message || "ComfyUI 渲染中…";
          if (p.total) line += ` (${p.frame || 0}/${p.total})`;
          overlay.textContent = line;
        }
      } catch { /* ignore */ }
    }
    const hint =
      pollProgress && sec < 8 && !extra
        ? " · ComfyUI 運算中，請稍候…"
        : "";
    statusEl.textContent = `${label}… ${sec}s${extra}${hint}`;
  }, 1000);
  return fn().finally(() => {
    stopped = true;
    clearInterval(tick);
  });
}

["vid-width", "vid-height"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", updateVideoPreviewRatio);
});
updateVideoPreviewRatio();

document.getElementById("btn-image").addEventListener("click", async () => {
  const prompt = document.getElementById("img-prompt").value.trim();
  const el = document.getElementById("img-result");
  const statusEl = document.getElementById("img-status");
  if (!prompt) return;
  const err = await checkModuleHealth("image");
  if (err) {
    if (statusEl) statusEl.textContent = "";
    el.textContent = err;
    return;
  }
  const negative = document.getElementById("img-negative")?.value.trim() || null;
  const style = document.getElementById("img-model")?.value || "auto";
  const body = {
    prompt,
    negative,
    style: style === "auto" ? null : style,
    lora: document.getElementById("img-lora").value || null,
    lora_strength: parseFloat(strengthInput.value),
    quality_filter: document.getElementById("img-quality-filter").checked,
    max_quality_retries: parseInt(document.getElementById("img-quality-retries").value, 10),
  };
  try {
    const data = await runWithProgress(statusEl, "Generating image", () =>
      postJson("/api/generate/image", body, 180000)
    );
    if (statusEl) statusEl.textContent = "";
    showResult(el, data, "image");
  } catch (e) {
    if (statusEl) statusEl.textContent = "";
    el.textContent = `Error: ${e.message}`;
  }
});

document.getElementById("btn-video").addEventListener("click", async () => {
  const prompt = document.getElementById("vid-prompt").value.trim();
  const statusEl = document.getElementById("vid-status");
  const btn = document.getElementById("btn-video");
  if (!prompt) return;
  const err = await checkModuleHealth("video");
  if (err) {
    if (statusEl) statusEl.textContent = formatHealthError("video", err);
    return;
  }
  btn.disabled = true;
  clearVideoPreview();
  updateVideoPreviewRatio();
  showVideoGenerating();
  try {
    const data = await runWithProgress(
      statusEl,
      "Generating video",
      () =>
        postJson("/api/generate/video", {
          prompt,
          frames: parseInt(document.getElementById("vid-frames").value, 10),
          width: parseInt(document.getElementById("vid-width").value, 10),
          height: parseInt(document.getElementById("vid-height").value, 10),
          fps: parseInt(document.getElementById("vid-fps").value, 10),
        }, 600000),
      true
    );
    showVideoResult(data);
  } catch (e) {
    clearVideoPreview();
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-tts").addEventListener("click", async () => {
  const text = document.getElementById("tts-text").value.trim();
  const el = document.getElementById("tts-result");
  const statusEl = document.getElementById("tts-status");
  if (!text) return;
  const err = await checkModuleHealth("tts");
  if (err) {
    if (statusEl) statusEl.textContent = "";
    el.textContent = err;
    return;
  }
  try {
    const data = await runWithProgress(statusEl, "Synthesizing", () =>
      postJson("/api/generate/tts", { text }, 60000)
    );
    if (statusEl) statusEl.textContent = "";
    showResult(el, data, "audio");
  } catch (e) {
    if (statusEl) statusEl.textContent = "";
    el.textContent = `Error: ${e.message}`;
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab === "generate") {
      loadGenerateAssets();
      loadHistory();
    }
  });
});

async function loadHistory() {
  const q = document.getElementById("history-q").value.trim();
  const type = document.getElementById("history-type").value;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  params.set("limit", "30");
  const list = document.getElementById("history-list");
  list.innerHTML = "";
  try {
    const data = await fetch(`/api/history?${params}`).then((r) => r.json());
    (data.entries || []).forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${(row.timestamp || "").slice(0, 19)} [${row.type}] ${(row.prompt || "").slice(0, 50)}`;
      list.appendChild(li);
    });
    if (!data.entries?.length) list.innerHTML = "<li>No history yet</li>";
  } catch (e) {
    list.innerHTML = `<li>Error: ${e.message}</li>`;
  }
}

document.getElementById("btn-history-load").addEventListener("click", loadHistory);

loadGenerateAssets();