import { api } from "../api.js";
import { html, el, icon, fmtNum, fmtTime, coverArt, samplePalette, audioDuration, raw } from "../util.js";
import { modal, confirmDialog, toast, trackList } from "../components.js";
import { store } from "../store.js";
import { observeReveals } from "../motion.js";
import { engine } from "../audio.js";

const TABS = [["overview", "Overview"], ["upload", "Upload"], ["tracks", "Tracks"], ["users", "Users"]];

export default async function admin({ query }) {
  let tab = TABS.some(([k]) => k === query.get("tab")) ? query.get("tab") : "overview";
  const root = el(html`<div class="page">
    <div class="page-head"><h1 class="h1">Admin</h1></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`)}</div>
    <div id="admin-panel"></div>
  </div>`);
  const panel = root.querySelector("#admin-panel");
  const views = { overview, upload, tracks, users };
  let cleanup = null;

  async function draw() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    cleanup?.(); cleanup = null;
    panel.replaceChildren(el(`<div class="skeleton" style="height:240px"></div>`));
    try {
      const v = await views[tab]();
      panel.replaceChildren(v.el); cleanup = v.destroy || null;
      observeReveals(panel);
    } catch (e) { panel.replaceChildren(el(html`<div class="empty"><p class="meta">${e.message}</p></div>`)); }
  }
  root.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab; history.replaceState({}, "", `/admin?tab=${tab}`); draw();
  });
  draw();
  return { el: root, title: "Admin", destroy: () => cleanup?.() };
}

// ---------------------------------------------------------------------------
async function overview() {
  const s = await api.get("/api/admin/stats");
  const box = el(html`<div>
    <div class="stats reveal">
      <div class="stat"><b>${fmtNum(s.totalPlays)}</b><span>Total plays</span></div>
      <div class="stat"><b>${fmtNum(s.users)}</b><span>Users</span></div>
      <div class="stat"><b>${fmtNum(s.tracks)}</b><span>Tracks</span></div>
      <div class="stat"><b>${fmtNum(s.albums)}</b><span>Albums</span></div>
      <div class="stat"><b>${fmtNum(s.artists)}</b><span>Artists</span></div>
      <div class="stat"><b>${fmtNum(s.playlists)}</b><span>Playlists</span></div>
    </div>
    <div class="two-col" style="margin-top:28px">
      <section class="panel reveal"><div class="panel__head"><h2 class="h2">Plays per day</h2><span class="meta">Last 14 days</span></div>
        <canvas class="chart" id="chart" role="img" aria-label="Bar chart of plays per day for the last 14 days"></canvas>
        <table class="sr-only"><tbody>${s.playsByDay.map((d) => html`<tr><td>${d.day}</td><td>${d.plays}</td></tr>`)}</tbody></table></section>
      <section class="panel reveal"><div class="panel__head"><h2 class="h2">Most played</h2></div><div id="top"></div></section>
    </div></div>`);
  box.querySelector("#top").appendChild(trackList(s.topTracks, { label: "Most played", href: "/admin" }, { compact: true, ranked: true }));
  const canvas = box.querySelector("#chart");
  let hover = -1;
  const drawChart = () => chart(canvas, s.playsByDay, hover);
  const ro = new ResizeObserver(drawChart); ro.observe(canvas);
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    hover = Math.floor(((e.clientX - r.left) / r.width) * s.playsByDay.length); drawChart();
  });
  canvas.addEventListener("pointerleave", () => { hover = -1; drawChart(); });
  return { el: box, destroy: () => ro.disconnect() };
}

function chart(canvas, data, hover) {
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  if (!w) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const max = Math.max(1, ...data.map((d) => d.plays));
  const padB = 26, padT = 24, n = data.length, gap = 8, bw = (w - gap * (n - 1)) / n;
  g.font = "500 11px 'Instrument Sans', system-ui"; g.textAlign = "center";
  data.forEach((d, i) => {
    const bh = Math.max(3, (d.plays / max) * (h - padB - padT));
    const x = i * (bw + gap), y = h - padB - bh;
    const grad = g.createLinearGradient(0, y, 0, h - padB);
    const on = i === hover || (hover < 0 && i === n - 1);
    grad.addColorStop(0, on ? "#b6ff4a" : "#b197fc"); grad.addColorStop(1, on ? "rgba(182,255,74,.15)" : "rgba(109,40,217,.25)");
    g.fillStyle = grad;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, bw, bh, [6, 6, 2, 2]) : g.rect(x, y, bw, bh); g.fill();
    g.fillStyle = "#8f8aa1";
    if (i % 2 === (n - 1) % 2) g.fillText(d.day.slice(5).replace("-", "/"), x + bw / 2, h - 8);
    if (on) { g.fillStyle = "#f4f1fb"; g.fillText(String(d.plays), x + bw / 2, y - 8); }
  });
}

// ---------------------------------------------------------------------------
// AI lyrics (OpenAI speech-to-text)
let aiStatus = null;
const getAiStatus = async () => (aiStatus ??= await api.get("/api/admin/ai/status").catch(() => ({ enabled: false })));
const LANGS = [["auto", "Detect language"], ["ru", "Russian"], ["uz", "Uzbek"], ["en", "English"], ["kk", "Kazakh"], ["tr", "Turkish"]];
const langSelect = (id) => html`<select class="select" id="${id}" style="min-height:40px;padding:6px 12px;width:auto" aria-label="Language of the vocals">
  ${LANGS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>`;
const aiHelp = raw(`Paste plain lyrics (no timestamps) and the AI only adds the timing, keeping your text exactly. Leave it empty and the AI writes down the words itself.`);
const aiOff = raw(`AI lyrics are off. Add your OpenAI key as <b>OPENAI_API_KEY</b> and restart SONORA.`);

async function upload() {
  const box = el(html`<form class="panel form reveal" style="max-width:820px" novalidate>
    <div class="panel__head"><h2 class="h2">Upload a track</h2><span class="meta">MP3, M4A, OGG, WAV or FLAC up to 60 MB</span></div>
    <div class="form-row">
      <label class="dropzone" id="dz-audio">${icon("upload")}<b id="dz-audio-label">Choose an audio file</b><span class="hint">or drop it here</span>
        <input type="file" name="audio" accept="audio/*" class="sr-only" required></label>
      <label class="dropzone" id="dz-cover">${icon("note")}<b id="dz-cover-label">Add cover art</b><span class="hint">Square JPG, PNG or WebP. Colours for the 3D lighting are taken from it.</span>
        <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" class="sr-only"></label>
    </div>
    <div class="form-row">
      <div class="field"><label for="u-title">Track title</label><input class="input" id="u-title" name="title" required maxlength="160"></div>
      <div class="field"><label for="u-artist">Artist</label><input class="input" id="u-artist" name="artistName" required maxlength="120"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="u-album">Album</label><input class="input" id="u-album" name="albumTitle" maxlength="140" placeholder="Leave empty for a single"></div>
      <div class="form-row">
        <div class="field"><label for="u-year">Year</label><input class="input" id="u-year" name="year" type="number" min="1900" max="2100" value="${new Date().getFullYear()}"></div>
        <div class="field"><label for="u-no">Track number</label><input class="input" id="u-no" name="trackNo" type="number" min="1" max="999" placeholder="Auto"></div>
      </div>
    </div>
    <div class="field"><label for="u-genre">Genre</label><input class="input" id="u-genre" name="genre" maxlength="80" placeholder="Used when the artist is new"></div>
    <div class="field"><label for="u-lyrics">Synchronized lyrics (LRC)</label>
      <textarea class="textarea" id="u-lyrics" name="lyrics" rows="8" placeholder="[00:12.50]First line of the song&#10;[00:16.80]Next line"></textarea>
      <span class="hint" id="u-lyrics-hint">One line per lyric, each starting with its [minutes:seconds] timestamp.</span></div>
    <div class="ai-row" id="u-ai">
      <label class="switch"><input type="checkbox" id="u-ai-on"><span class="switch__track"></span><span><b>Generate synced lyrics with AI</b></span></label>
      ${langSelect("u-ai-lang")}
      <span class="hint ai-row__hint" id="u-ai-hint"></span>
    </div>
    <div class="error-text" id="u-err" role="alert"></div>
    <div style="display:flex;gap:12px;align-items:center"><button class="btn btn--primary" type="submit">${icon("upload")}Upload track</button><span class="meta" id="u-status"></span></div>
  </form>`);
  const palette = {}; let duration = 0;
  const ai = await getAiStatus();
  const aiOn = box.querySelector("#u-ai-on"), aiHint = box.querySelector("#u-ai-hint");
  aiOn.disabled = !ai.enabled;
  box.querySelector("#u-ai-lang").disabled = !ai.enabled;
  aiHint.innerHTML = String(ai.enabled ? aiHelp : aiOff);
  aiOn.checked = ai.enabled;
  const syncHint = () => {
    box.querySelector("#u-lyrics").placeholder = aiOn.checked
      ? "Optional: paste the plain lyrics here, one line per row"
      : "[00:12.50]First line of the song\n[00:16.80]Next line";
    box.querySelector("#u-lyrics-hint").textContent = aiOn.checked
      ? "Optional. Plain lyrics give the most accurate result."
      : "One line per lyric, each starting with its [minutes:seconds] timestamp.";
  };
  aiOn.onchange = syncHint; syncHint();
  const audioIn = box.querySelector('[name=audio]'), coverIn = box.querySelector('[name=cover]');
  audioIn.onchange = async () => {
    const f = audioIn.files[0]; if (!f) return;
    box.querySelector("#dz-audio-label").textContent = f.name;
    duration = await audioDuration(f);
    const t = box.querySelector("#u-title");
    if (!t.value) t.value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  };
  coverIn.onchange = async () => {
    const f = coverIn.files[0]; if (!f) return;
    box.querySelector("#dz-cover-label").textContent = f.name;
    try { Object.assign(palette, await samplePalette(f)); } catch { /* keep defaults */ }
  };
  for (const [id, input] of [["#dz-audio", audioIn], ["#dz-cover", coverIn]]) {
    const dz = box.querySelector(id);
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("is-over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-over"));
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("is-over"); if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; input.onchange(); } });
  }
  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = box.querySelector("#u-err"), status = box.querySelector("#u-status"), btn = box.querySelector("button[type=submit]");
    err.textContent = "";
    const fd = new FormData(box);
    if (!audioIn.files[0]) { err.textContent = "Choose an audio file to upload."; return; }
    if (!fd.get("title")?.trim() || !fd.get("artistName")?.trim()) { err.textContent = "Add a track title and an artist."; return; }
    if (!coverIn.files[0]) fd.delete("cover");
    for (const k of ["trackNo", "year"]) if (!fd.get(k)) fd.delete(k);
    if (duration) fd.set("durationSec", duration);
    if (palette.main) { fd.set("colorMain", palette.main); fd.set("colorAccent", palette.accent); }
    const useAi = aiOn.checked && ai.enabled;
    const aiText = fd.get("lyrics") || "", aiLang = box.querySelector("#u-ai-lang").value;
    if (useAi) fd.delete("lyrics");
    btn.disabled = true; status.textContent = "Uploading…";
    try {
      const t = await api.upload("/api/admin/tracks", fd);
      if (useAi) {
        status.textContent = "Listening to the track with AI… usually 10–40 seconds";
        try {
          const r = await api.post(`/api/admin/tracks/${t.id}/lyrics/ai`, { language: aiLang, text: aiText, save: true });
          toast(`Uploaded ${t.title} with ${r.lines} synced lines`);
        } catch (ex) {
          toast(`Uploaded ${t.title}, but AI lyrics failed: ${ex.message}`, { error: true });
        }
      } else toast(`Uploaded ${t.title}`);
      box.reset(); aiOn.checked = ai.enabled; syncHint(); status.textContent = "";
      box.querySelector("#dz-audio-label").textContent = "Choose an audio file";
      box.querySelector("#dz-cover-label").textContent = "Add cover art";
    } catch (ex) { err.textContent = ex.message; status.textContent = ""; }
    finally { btn.disabled = false; }
  });
  return { el: box };
}

// ---------------------------------------------------------------------------
async function tracks() {
  const list = await api.get("/api/admin/tracks");
  const box = el(html`<section class="panel reveal"><div class="panel__head"><h2 class="h2">Tracks</h2><span class="meta">${list.length} in the catalogue</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th></th><th>Title</th><th>Artist</th><th>Album</th><th>Length</th><th>Plays</th><th>Lyrics</th><th><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${list.map((t) => html`<tr data-id="${t.id}">
      <td><div style="width:40px;height:40px;border-radius:8px;overflow:hidden">${coverArt(t.album.coverSmallUrl, t.album.id * 47)}</div></td>
      <td><b>${t.title}</b></td><td>${t.artist.name}</td><td>${t.album.title}</td><td>${fmtTime(t.durationSec)}</td><td>${fmtNum(t.plays)}</td>
      <td>${t.hasLyrics ? html`<span class="badge badge--admin">Synced</span>` : html`<span class="badge">None</span>`}</td>
      <td style="white-space:nowrap"><button class="icon-btn icon-btn--sm" data-edit aria-label="Edit ${t.title}">${icon("edit")}</button><button class="icon-btn icon-btn--sm" data-del aria-label="Delete ${t.title}">${icon("trash")}</button></td>
    </tr>`)}</tbody></table></div></section>`);
  box.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]"); if (!row) return;
    const t = list.find((x) => x.id === +row.dataset.id);
    if (e.target.closest("[data-del]")) {
      if (!(await confirmDialog(`Delete “${t.title}”?`, "It will be removed from every playlist and library. This can't be undone."))) return;
      try { await api.del(`/api/admin/tracks/${t.id}`); row.remove(); toast("Track deleted"); } catch (ex) { toast(ex.message, { error: true }); }
    }
    if (e.target.closest("[data-edit]")) {
      let lrc = "";
      try { lrc = (await api.get(`/api/tracks/${t.id}/lyrics`)).lrc; } catch { /* empty */ }
      const ai = await getAiStatus();
      modal({ title: "Edit track", wide: true,
        body: el(html`<form class="form"><div class="form-row"><div class="field"><label for="e-t">Title</label><input class="input" id="e-t" name="title" value="${t.title}" maxlength="160"></div>
          <div class="field"><label for="e-n">Track number</label><input class="input" id="e-n" name="trackNo" type="number" min="1" value="${t.trackNo}"></div></div>
          <div class="field"><label for="e-l">Synchronized lyrics (LRC)</label><textarea class="textarea" id="e-l" name="lyrics" rows="12" style="font-family:ui-monospace,monospace;font-size:.85rem">${lrc}</textarea></div>
          <div class="ai-row">
            <button class="btn btn--sm" type="button" id="e-ai" ${ai.enabled ? "" : raw("disabled")}>${icon("lyrics")}Generate with AI</button>
            ${langSelect("e-ai-lang")}
            <span class="hint ai-row__hint" id="e-ai-hint">${ai.enabled ? aiHelp : aiOff}</span>
          </div>
          ${syncToolsMarkup(t)}</form>`),
        onOpen: (b) => {
          mountSyncTools(b, t);
          const btn = b.querySelector("#e-ai"), ta = b.querySelector("#e-l"), hint = b.querySelector("#e-ai-hint");
          btn.addEventListener("click", async () => {
            const save = b.closest(".modal").querySelector(".btn--primary");
            btn.disabled = true; if (save) save.disabled = true; ta.readOnly = true;
            hint.textContent = "Listening to the track with AI… usually 10–40 seconds";
            try {
              const r = await api.post(`/api/admin/tracks/${t.id}/lyrics/ai`, { language: b.querySelector("#e-ai-lang").value, text: ta.value, save: false });
              ta.value = r.lrc;
              hint.textContent = r.mode === "align"
                ? `Done: your ${r.lines} lines now have timestamps. Check them, then save.`
                : `Done: the AI wrote ${r.lines} lines. Fix any misheard words, then save.`;
            } catch (ex) { hint.textContent = ex.message; }
            finally { btn.disabled = false; if (save) save.disabled = false; ta.readOnly = false; }
          });
        },
        actions: [{ label: "Cancel" }, { label: "Save changes", primary: true, onClick: async (b) => {
          const f = b.querySelector("form");
          await api.patch(`/api/admin/tracks/${t.id}`, { title: f.title.value, lyrics: f.lyrics.value, trackNo: +f.trackNo.value || null });
          toast("Track saved");
          t.hasLyrics = !!f.lyrics.value.trim();
          row.children[6].innerHTML = t.hasLyrics ? `<span class="badge badge--admin">Synced</span>` : `<span class="badge">None</span>`;
        } }] });
    }
  });
  return { el: box };
}

// ---------------------------------------------------------------------------
// Manual timing tools: shift everything, or set each line by tapping along with the track.
const TS_RE = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const toSec = (m, s) => +m * 60 + parseFloat(String(s).replace(":", "."));
const fmtTs = (sec) => { const cs = Math.round(Math.max(0, sec) * 100); return `${String(Math.floor(cs / 6000)).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`; };

function readLines(text) {
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (/^\s*\[[a-z]+:/i.test(rawLine)) continue;            // [ti:...], [re:...] metadata
    const stamps = [...rawLine.matchAll(TS_RE)];
    const words = rawLine.replace(TS_RE, "").trim();
    if (!words || /^[♪♫\s.]+$/.test(words)) continue;
    out.push({ t: stamps.length ? toSec(stamps[0][1], stamps[0][2]) : null, text: words });
  }
  return out;
}
function writeLines(lines) {
  const timed = lines.filter((l) => l.t != null);
  let out = "", prev = -1;
  if (timed.length && timed[0].t > 5) out += "[00:00.00]♪\n";
  for (const l of lines) {
    const t = l.t != null ? Math.max(l.t, prev + 0.05) : prev + 2;
    out += `[${fmtTs(t)}]${l.text}\n`; prev = t;
  }
  return out;
}

function syncToolsMarkup(t) {
  return html`<div class="sync-tools">
      <span class="meta">Shift every line</span>
      ${[-1, -0.5, 0.5, 1].map((d) => html`<button class="btn btn--sm btn--ghost" type="button" data-shift="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)} s</button>`)}
      <button class="btn btn--sm" type="button" id="e-tap-open">${icon("play")}Sync by tapping</button>
    </div>
    <div class="tapper hidden" id="e-tapper">
      <div class="tapper__bar">
        <audio controls preload="auto" src="${t.audioUrl}"></audio>
        <select class="select" id="e-tap-rate" aria-label="Playback speed" style="min-height:40px;padding:6px 12px;width:auto">
          <option value="1">1×</option><option value="0.75">0.75×</option><option value="0.5">0.5×</option></select>
      </div>
      <p class="hint" style="margin:0">Press play, then press <b>Space</b> (or the button) the moment each highlighted line starts. Backspace steps back. Click a line to redo it from there.</p>
      <ol class="tapper__lines" id="e-tap-lines"></ol>
      <div class="tapper__actions">
        <button class="btn btn--primary" type="button" id="e-tap-hit">Line starts now</button>
        <button class="btn btn--ghost" type="button" id="e-tap-undo">Step back</button>
        <span class="tapper__spacer"></span>
        <button class="btn" type="button" id="e-tap-done">${icon("check")}Use these timings</button>
      </div>
    </div>`;
}

function mountSyncTools(b, t) {
  const ta = b.querySelector("#e-l"), tapper = b.querySelector("#e-tapper"), list = b.querySelector("#e-tap-lines");
  const audio = tapper.querySelector("audio"), field = ta.closest(".field");
  b.querySelectorAll("[data-shift]").forEach((btn) => btn.addEventListener("click", () => {
    const d = +btn.dataset.shift;
    ta.value = ta.value.replace(TS_RE, (_, m, sec) => `[${fmtTs(toSec(m, sec) + d)}]`);
    toast(`Moved every line ${d > 0 ? "later" : "earlier"} by ${Math.abs(d)} s`);
  }));

  let lines = [], next = 0;
  const REACTION = 0.15; // people tap slightly after they hear the line
  const draw = () => {
    list.innerHTML = lines.map((l, i) => `<li data-i="${i}" class="${i === next ? "is-next" : ""}"><span class="tapper__t">${l.t == null ? "--:--" : fmtTs(l.t)}</span><span>${l.text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</span></li>`).join("");
    list.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  };
  const hit = () => {
    if (next >= lines.length) return;
    lines[next].t = Math.max(0, audio.currentTime - REACTION);
    next++; draw();
    if (next >= lines.length) toast("Every line has a time. Check them, then choose Use these timings.");
  };
  const undo = () => { if (next > 0) { next--; audio.currentTime = Math.max(0, (lines[next].t ?? audio.currentTime) - 2); draw(); } };

  b.querySelector("#e-tap-open").addEventListener("click", () => {
    lines = readLines(ta.value);
    if (!lines.length) return toast("Paste the lyrics into the box first, one line per row", { error: true });
    engine.pause();
    next = 0; draw();
    field.classList.add("hidden"); tapper.classList.remove("hidden");
  });
  b.querySelector("#e-tap-hit").addEventListener("click", hit);
  b.querySelector("#e-tap-undo").addEventListener("click", undo);
  b.querySelector("#e-tap-done").addEventListener("click", () => {
    audio.pause(); ta.value = writeLines(lines);
    tapper.classList.add("hidden"); field.classList.remove("hidden");
  });
  b.querySelector("#e-tap-rate").addEventListener("change", (e) => { audio.playbackRate = +e.target.value; });
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    next = +li.dataset.i;
    if (lines[next].t != null) audio.currentTime = Math.max(0, lines[next].t - 2);
    draw();
  });
  audio.addEventListener("timeupdate", () => {
    let cur = -1;
    lines.forEach((l, i) => { if (l.t != null && l.t <= audio.currentTime) cur = i; });
    list.querySelectorAll("li").forEach((li, i) => li.classList.toggle("is-playing", i === cur));
  });

  const onKey = (e) => {
    if (!tapper.isConnected) return cleanup();
    if (tapper.classList.contains("hidden")) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === " " && !e.target.closest("#e-tap-hit")) { e.preventDefault(); hit(); }
    if (e.key === "Backspace") { e.preventDefault(); undo(); }
  };
  document.addEventListener("keydown", onKey, true);
  const mo = new MutationObserver(() => { if (!tapper.isConnected) cleanup(); });
  mo.observe(document.getElementById("modal-root"), { childList: true });
  function cleanup() { audio.pause(); document.removeEventListener("keydown", onKey, true); mo.disconnect(); }
}

// ---------------------------------------------------------------------------
async function users() {
  const list = await api.get("/api/admin/users");
  const me = store.user?.id;
  const box = el(html`<section class="panel reveal"><div class="panel__head"><h2 class="h2">Users</h2><span class="meta">${list.length} accounts</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Playlists</th><th>Likes</th><th>Role</th><th>Access</th></tr></thead>
    <tbody>${list.map((u) => html`<tr data-id="${u.id}">
      <td><b>${u.displayName}</b><div class="meta">@${u.username}</div></td><td>${u.email}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>${u.playlists}</td><td>${u.likes}</td>
      <td>${u.id === me ? html`<span class="badge badge--admin">You</span>` : html`<select class="select" data-role style="min-height:36px;padding:4px 10px" aria-label="Role for ${u.username}">
        <option value="USER" ${u.role === "USER" ? raw("selected") : ""}>Listener</option><option value="ADMIN" ${u.role === "ADMIN" ? raw("selected") : ""}>Admin</option></select>`}</td>
      <td>${u.id === me ? "" : html`<label class="switch"><input type="checkbox" data-enabled ${u.enabled ? raw("checked") : ""}><span class="switch__track"></span><span class="sr-only">Account enabled for ${u.username}</span></label>`}</td>
    </tr>`)}</tbody></table></div></section>`);
  box.addEventListener("change", async (e) => {
    const row = e.target.closest("tr[data-id]"); if (!row) return;
    const body = e.target.matches("[data-role]") ? { role: e.target.value } : { enabled: e.target.checked };
    try { await api.patch(`/api/admin/users/${row.dataset.id}`, body); toast("User updated"); }
    catch (ex) { toast(ex.message, { error: true }); }
  });
  return { el: box };
}
