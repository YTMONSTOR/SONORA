// Player UI: dock, queue drawer, full-screen cinematic player and synchronized lyrics.
import { engine } from "./audio.js";
import { bus, store } from "./store.js";
import { api } from "./api.js";
import { $, fmtTime, html, el, coverArt, isMobile } from "./util.js";
import { parseLRC, LyricsView } from "./lyrics.js";
import { reducedMotion } from "./motion.js";
import { navigate } from "./router.js";

const audio = engine.audio;
const q = (id) => document.getElementById(id);
const dock = q("dock"), np = q("np"), drawer = q("queue");
const lyricsCache = new Map();
let stage = null, stagePending = false, lyricsView, npOpen = false, seeking = false;

export function initPlayer() {
  lyricsView = new LyricsView(q("np-lyrics"), { onSeek: (t) => { engine.seek(t); if (audio.paused) engine.play(); } });

  // transport
  for (const id of ["btn-play", "np-play"]) q(id).onclick = () => engine.current ? engine.toggle() : bus.emit("toast", { message: "Pick a track to start listening" });
  for (const id of ["btn-next", "np-next"]) q(id).onclick = () => engine.next();
  for (const id of ["btn-prev", "np-prev"]) q(id).onclick = () => engine.prev();
  for (const id of ["btn-shuffle", "np-shuffle"]) q(id).onclick = () => engine.toggleShuffle();
  for (const id of ["btn-repeat", "np-repeat"]) q(id).onclick = () => engine.cycleRepeat();
  q("btn-mute").onclick = () => engine.toggleMute();
  q("volume").oninput = (e) => engine.setVolume(e.target.value / 100);
  for (const id of ["dock-like", "np-like"]) q(id).onclick = async () => {
    const t = engine.current; if (!t) return;
    try { await store.toggleLike(t.id); } catch (e) { bus.emit("toast", { message: e.message, error: true }); }
  };

  // seek bars: preview while dragging, commit on release
  for (const [id, cur] of [["seek", "t-cur"], ["np-seek", "np-cur"]]) {
    const r = q(id);
    r.addEventListener("input", () => { seeking = true; const s = (r.value / 1000) * (audio.duration || 0); q(cur).textContent = fmtTime(s); paintRange(r); });
    r.addEventListener("change", () => { engine.seekFraction(r.value / 1000); seeking = false; });
  }

  // open / close
  q("dock-expand").onclick = q("btn-full").onclick = () => openNP();
  q("btn-lyrics").onclick = () => openNP({ lyrics: true });
  q("np-close").onclick = () => closeNP();
  q("np-lyrics-toggle").onclick = () => setLyricsMode(!np.classList.contains("show-lyrics"));
  q("btn-queue").onclick = () => toggleQueue();
  q("np-queue").onclick = () => toggleQueue(true);
  q("queue-close").onclick = () => toggleQueue(false);
  q("queue-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pos]");
    if (b) engine.jumpTo(+b.dataset.pos);
  });
  q("np-source").addEventListener("click", (e) => {
    const a = e.target.closest("a"); if (a) closeNP();
  });
  q("np-artist").addEventListener("click", (e) => { if (e.target.closest("a")) closeNP(); });

  bus.on("track", onTrack);
  bus.on("state", onState);
  bus.on("queue", renderQueue);
  bus.on("modes", renderModes);
  bus.on("volume", renderVolume);
  bus.on("likes", renderLike);
  bus.on("duration", (d) => { q("t-dur").textContent = q("np-dur").textContent = fmtTime(d); });
  audio.addEventListener("timeupdate", renderProgress);

  initShortcuts();
  renderModes(); renderVolume(); onState(false);
  requestAnimationFrame(frame);
  setTimeout(() => dock.classList.add("is-ready"), 400);
}

// ---------------------------------------------------------------------------
function onTrack(t) {
  if (!t) return;
  const cover = t.album?.coverUrl || "/assets/placeholder.svg";
  swapCover(q("dock-cover"), t.album?.coverSmallUrl || cover);
  q("dock-title").textContent = t.title;
  q("dock-artist").replaceChildren(el(html`<a href="/artist/${t.artist.slug}">${t.artist.name}</a>`));
  q("np-title").textContent = t.title;
  q("np-artist").replaceChildren(el(html`<a href="/artist/${t.artist.slug}">${t.artist.name}</a>`));
  q("np-bg").style.backgroundImage = `url("${cover}")`;
  const src = engine.source;
  q("np-source").replaceChildren(el(src?.href ? html`<a href="${src.href}">Playing from ${src.label}</a>` : html`<span>${t.album?.title || ""}</span>`));
  q("t-dur").textContent = q("np-dur").textContent = fmtTime(t.durationSec);
  renderLike(); renderQueue();
  stage?.setTrack(t);
  if (npOpen) loadLyrics(t);
  document.body.style.setProperty("--accent", t.album?.palette?.[1] || "#8b5cf6");
}

function swapCover(img, src) {
  if (img.getAttribute("src") === src) return;
  if (reducedMotion()) { img.src = src; return; }
  const box = img.parentElement;
  box.animate([{ transform: "rotateY(0deg) scale(1)", opacity: 1 }, { transform: "rotateY(90deg) scale(.9)", opacity: .2 }], { duration: 220, easing: "ease-in" })
    .finished.then(() => {
      img.src = src;
      box.animate([{ transform: "rotateY(-90deg) scale(.9)", opacity: .2 }, { transform: "rotateY(0deg) scale(1)", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.22,.9,.24,1)" });
    });
}

function onState(playing) {
  const icon = playing ? "pause" : "play";
  for (const id of ["btn-play", "np-play"]) {
    const b = q(id);
    b.querySelector("use").setAttribute("href", `#i-${icon}`);
    b.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  document.querySelectorAll(".tracks").forEach((t) => t.classList.toggle("is-paused", !playing));
}

function renderModes() {
  for (const id of ["btn-shuffle", "np-shuffle"]) { q(id).classList.toggle("is-on", engine.shuffle); q(id).setAttribute("aria-pressed", String(engine.shuffle)); }
  for (const id of ["btn-repeat", "np-repeat"]) {
    const b = q(id);
    b.classList.toggle("is-on", engine.repeat !== "off");
    b.querySelector("use").setAttribute("href", engine.repeat === "one" ? "#i-repeat-one" : "#i-repeat");
    b.setAttribute("aria-label", `Repeat: ${engine.repeat === "one" ? "this track" : engine.repeat === "all" ? "queue" : "off"}`);
  }
}

function renderVolume() {
  const r = q("volume");
  r.value = Math.round((audio.muted ? 0 : audio.volume) * 100); paintRange(r, r.value);
  q("btn-mute").querySelector("use").setAttribute("href", audio.muted || audio.volume === 0 ? "#i-mute" : "#i-volume");
  q("btn-mute").setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
}

function renderLike() {
  const t = engine.current, on = !!t && store.isLiked(t.id);
  for (const id of ["dock-like", "np-like"]) {
    const b = q(id);
    if (t) b.dataset.likeState = on;
    b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Remove from liked songs" : "Save to liked songs");
  }
}

function renderProgress() {
  if (seeking) return;
  const d = audio.duration || engine.current?.durationSec || 0, c = audio.currentTime || 0;
  const v = d ? Math.round((c / d) * 1000) : 0;
  for (const [id, cur] of [["seek", "t-cur"], ["np-seek", "np-cur"]]) {
    const r = q(id); r.value = v; paintRange(r); q(cur).textContent = fmtTime(c);
  }
}
function paintRange(r, pct) { r.style.setProperty("--p", `${pct ?? (r.value / r.max) * 100}%`); }

// ---------------------------------------------------------------------------
function renderQueue() {
  const body = q("queue-body");
  const cur = engine.current;
  if (!cur) { body.innerHTML = `<p class="drawer__label">Your queue is empty. Play an album or playlist to fill it.</p>`; return; }
  const item = (t, pos, current) => html`<button class="queue-item${current ? " is-current" : ""} enter" data-pos="${pos}" style="animation-delay:${Math.min(pos - engine.pos, 12) * 40}ms">
    ${t.album?.coverSmallUrl ? html`<img src="${t.album.coverSmallUrl}" alt="" loading="lazy">` : coverArt(null, 270)}
    <span class="queue-item__main"><b>${t.title}</b><span>${t.artist.name}</span></span>
    <span class="meta">${fmtTime(t.durationSec)}</span></button>`;
  const next = engine.order.slice(engine.pos + 1, engine.pos + 51);
  body.innerHTML = html`<div class="drawer__label">Now playing</div>${item(cur, engine.pos, true)}
    <div class="drawer__label">${next.length ? `Next${engine.source?.label ? " from " + engine.source.label : ""}` : "Nothing queued after this"}</div>
    ${next.map((qi, k) => item(engine.queue[qi], engine.pos + 1 + k, false))}`.toString();
}

function toggleQueue(force) {
  const open = force ?? !drawer.classList.contains("is-open");
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", String(!open));
  q("btn-queue").setAttribute("aria-expanded", String(open));
  q("btn-queue").classList.toggle("is-on", open);
  if (open) { renderQueue(); setTimeout(() => q("queue-close").focus(), 50); }
}

// ---------------------------------------------------------------------------
export async function openNP({ lyrics = false } = {}) {
  if (!engine.current) { bus.emit("toast", { message: "Pick a track to start listening" }); return false; }
  npOpen = true;
  np.classList.add("is-open"); np.setAttribute("aria-hidden", "false");
  document.documentElement.style.overflow = "hidden";
  setLyricsMode(lyrics || !isMobile());
  loadLyrics(engine.current);
  setTimeout(() => q("np-play").focus(), 60);
  if (!stage && !stagePending) {
    stagePending = true;
    const { createStage } = await import("./three/stage.js");
    stage = await createStage(q("np-stage"));
    stagePending = false;
    if (stage) stage.setTrack(engine.current);
    else fallbackStage();
  }
  return true;
}

function fallbackStage() {
  const s = q("np-stage");
  if (s.querySelector(".fallback-stage")) return;
  const wrap = el(`<div class="fallback-stage"><div class="vinyl-css"></div></div>`);
  s.appendChild(wrap);
  const upd = (t) => wrap.firstElementChild.style.setProperty("--label", t?.album?.coverUrl ? `url("${t.album.coverUrl}")` : "");
  upd(engine.current); bus.on("track", upd);
  bus.on("state", (p) => (wrap.firstElementChild.style.animationPlayState = p ? "running" : "paused"));
  wrap.firstElementChild.style.animationPlayState = engine.playing ? "running" : "paused";
}

export function closeNP() {
  if (!npOpen) return;
  npOpen = false;
  np.classList.remove("is-open"); np.setAttribute("aria-hidden", "true");
  document.documentElement.style.overflow = "";
  toggleQueue(false);
  if (/^\/(now-playing|lyrics)\/?$/.test(location.pathname)) navigate("/", { replace: true });
  q("dock-expand").focus({ preventScroll: true });
}
export const isNPOpen = () => npOpen;

function setLyricsMode(on) {
  np.classList.toggle("show-lyrics", on);
  q("np-lyrics-toggle").setAttribute("aria-pressed", String(on));
  q("np-lyrics-toggle").classList.toggle("is-on", on);
  if (on) requestAnimationFrame(() => lyricsView.position(true));
}

async function loadLyrics(t) {
  if (!t) return;
  if (!t.hasLyrics) return lyricsView.setEmpty(t.title);
  let lines = lyricsCache.get(t.id);
  if (!lines) {
    lyricsView.setLoading();
    try {
      const d = await api.get(`/api/tracks/${t.id}/lyrics`);
      lines = parseLRC(d.lrc);
      lyricsCache.set(t.id, lines);
    } catch { lines = []; }
    if (engine.current?.id !== t.id) return;
  }
  lines.length ? lyricsView.setLines(lines) : lyricsView.setEmpty(t.title);
  lyricsView.sync(audio.currentTime, true);
}

// ---------------------------------------------------------------------------
// one rAF for everything the player draws: smooth progress, waveforms, cover tilt, lyric sync
const dockWave = q("dock-wave"), npWave = q("np-wave");
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const L = engine.levels(now);
  if (engine.playing) renderProgress();
  if (npOpen) {
    lyricsView.sync(audio.currentTime);
    drawWave(npWave, L, { bars: 64, gap: 3 });
  }
  if (!isMobile()) drawWave(dockWave, L, { bars: 120, gap: 1, line: true });
  const art = q("dock-art").firstElementChild;
  if (!reducedMotion()) {
    art.style.setProperty("--ry", `${engine.playing ? Math.sin(now / 1400) * 10 + L.bass * 6 : 0}deg`);
    art.style.setProperty("--rx", `${engine.playing ? Math.cos(now / 1900) * 6 : 0}deg`);
  }
}

function drawWave(canvas, L, { bars, gap, line = false }) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const f = L.freq;
  if (line) {
    // thin glowing spectrum line along the top edge of the dock
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(139,92,246,0)"); grad.addColorStop(0.3, "rgba(177,151,252,.9)"); grad.addColorStop(0.7, "rgba(182,255,74,.8)"); grad.addColorStop(1, "rgba(139,92,246,0)");
    g.fillStyle = grad;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const v = f && L.live ? f[Math.floor(i / bars * f.length * 0.6)] / 255 : L.level * (0.5 + 0.5 * Math.sin(i * 0.4 + performance.now() / 300));
      g.globalAlpha = 0.25 + v * 0.75;
      g.fillRect(i * bw, 0, bw - gap, h);
    }
    g.globalAlpha = 1;
    return;
  }
  const bw = (w - gap * (bars - 1)) / bars;
  const t = performance.now() / 1000;
  for (let i = 0; i < bars; i++) {
    const mirrored = i < bars / 2 ? bars / 2 - i : i - bars / 2;
    let v;
    if (f && L.live) v = f[Math.floor(mirrored / (bars / 2) * f.length * 0.5) + 1] / 255;
    else v = engine.playing ? L.level * (0.4 + 0.6 * Math.abs(Math.sin(i * 0.37 + t * 2.2))) : 0.04;
    const bh = Math.max(2, v * h);
    const x = i * (bw + gap), y = (h - bh) / 2;
    const grad = g.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, v > 0.7 ? "#b6ff4a" : "#b197fc"); grad.addColorStop(1, "#6d28d9");
    g.fillStyle = grad;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, bw, bh, bw / 2) : g.rect(x, y, bw, bh); g.fill();
  }
}

// ---------------------------------------------------------------------------
function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
    if (document.getElementById("modal-root").classList.contains("is-open")) return;
    switch (e.key) {
      case " ": if (tag === "BUTTON" || tag === "A") return; e.preventDefault(); engine.toggle(); break;
      case "ArrowRight": if (e.shiftKey) engine.next(); else engine.seek(audio.currentTime + 5); break;
      case "ArrowLeft": if (e.shiftKey) engine.prev(); else engine.seek(audio.currentTime - 5); break;
      case "m": case "M": engine.toggleMute(); break;
      case "f": case "F": npOpen ? closeNP() : openNP(); break;
      case "l": case "L": npOpen ? setLyricsMode(!np.classList.contains("show-lyrics")) : openNP({ lyrics: true }); break;
      case "q": case "Q": toggleQueue(); break;
      case "Escape": if (drawer.classList.contains("is-open")) toggleQueue(false); else if (npOpen) closeNP(); break;
      default: return;
    }
  });
}
