// Playback engine: one <audio> element, a queue, and a Web Audio analyser that every visual reads from.
import { api } from "./api.js";
import { bus, store } from "./store.js";

const audio = document.getElementById("audio");
const SAVE_KEY = "sonora.session";

let ctx = null, gain = null, analyser = null, freq = null, wave = null;
const levels = { bass: 0, mid: 0, high: 0, level: 0, beat: 0, freq: null, wave: null, live: false };
let lastLevelsFrame = -1, lastBass = 0;

export const engine = {
  audio,
  queue: [],
  order: [],     // indices into queue in play order
  pos: -1,       // position within order
  source: null,  // { label, href }
  shuffle: false,
  repeat: "off", // off | all | one
  playing: false,

  get current() { return this.pos >= 0 ? this.queue[this.order[this.pos]] : null; },

  upNext() { return this.order.slice(this.pos + 1).map((i) => this.queue[i]); },

  async playList(tracks, startIndex = 0, source = null) {
    if (!tracks?.length) return;
    this.queue = tracks.slice();
    this.source = source;
    this.order = tracks.map((_, i) => i);
    if (this.shuffle) shuffleOrder(this, startIndex);
    this.pos = this.order.indexOf(startIndex);
    bus.emit("queue");
    await this.load(true);
  },

  /** Insert a track right after the current one. */
  playNext(track) {
    if (!this.current) return this.playList([track], 0);
    this.queue.push(track);
    this.order.splice(this.pos + 1, 0, this.queue.length - 1);
    bus.emit("queue");
  },

  addToQueue(track) {
    if (!this.current) return this.playList([track], 0);
    this.queue.push(track);
    this.order.push(this.queue.length - 1);
    bus.emit("queue");
  },

  jumpTo(orderPos) { this.pos = orderPos; return this.load(true); },

  async load(autoplay, startAt = 0) {
    const t = this.current;
    if (!t) return;
    const switching = !audio.paused;
    if (switching) await fade(0, 0.22);
    audio.src = t.audioUrl;
    audio.currentTime = 0;
    this._counted = false;
    this._startAt = startAt;
    bus.emit("track", t);
    updateMediaSession(t);
    persist();
    if (autoplay) await this.play();
  },

  async play() {
    if (!this.current) return;
    ensureGraph();
    try { await ctx?.resume(); } catch { /* ignore */ }
    if (gain) gain.gain.value = 0.0001;
    try {
      await audio.play();
    } catch (e) {
      if (e.name !== "AbortError") bus.emit("toast", { message: "Playback was blocked. Press play to start.", error: true });
      return;
    }
    fade(1, store.settings.crossfade === false ? 0.01 : 0.45);
  },

  pause() { audio.pause(); },
  toggle() { audio.paused ? this.play() : this.pause(); },

  next(auto = false) {
    if (!this.current) return;
    if (auto && this.repeat === "one") { audio.currentTime = 0; return this.play(); }
    if (this.pos < this.order.length - 1) { this.pos++; return this.load(true); }
    if (this.repeat === "all" || !auto) { this.pos = 0; return this.load(auto ? true : !audio.paused); }
    audio.pause(); audio.currentTime = 0;
  },

  prev() {
    if (!this.current) return;
    if (audio.currentTime > 3 || this.pos === 0) { audio.currentTime = 0; return; }
    this.pos--; return this.load(true);
  },

  seek(sec) { if (isFinite(sec)) audio.currentTime = Math.max(0, Math.min(sec, audio.duration || sec)); },
  seekFraction(f) { if (audio.duration) this.seek(f * audio.duration); },

  setVolume(v) { audio.volume = Math.max(0, Math.min(1, v)); audio.muted = false; persistVolume(); bus.emit("volume"); },
  toggleMute() { audio.muted = !audio.muted; bus.emit("volume"); },

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    const cur = this.order[this.pos];
    if (this.shuffle) shuffleOrder(this, cur);
    else { this.order = this.queue.map((_, i) => i); this.pos = cur ?? -1; }
    bus.emit("queue"); bus.emit("modes");
  },

  cycleRepeat() {
    this.repeat = { off: "all", all: "one", one: "off" }[this.repeat];
    bus.emit("modes"); persist();
  },

  /** Audio-reactive levels, computed at most once per animation frame. */
  levels(frame = performance.now()) {
    if (frame === lastLevelsFrame) return levels;
    lastLevelsFrame = frame;
    const k = 0.18;
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);
      const n = freq.length;
      const band = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / ((b - a) * 255); };
      const bass = band(1, Math.max(3, n * 0.04 | 0)), mid = band(n * 0.04 | 0, n * 0.25 | 0), high = band(n * 0.25 | 0, n * 0.7 | 0);
      levels.bass += (bass - levels.bass) * 0.5;
      levels.mid += (mid - levels.mid) * 0.35;
      levels.high += (high - levels.high) * 0.35;
      levels.live = true;
    } else if (!audio.paused && this.current) {
      // analyser unavailable: approximate a pulse from the track tempo so visuals still breathe
      const bpm = this.current.bpm || 100, t = audio.currentTime * bpm / 60;
      const pulse = Math.pow(1 - (t % 1), 3);
      levels.bass += (0.25 + pulse * 0.6 - levels.bass) * 0.3;
      levels.mid += (0.3 + 0.1 * Math.sin(t * 3.1) - levels.mid) * 0.2;
      levels.high += (0.2 + 0.1 * Math.sin(t * 7.3) - levels.high) * 0.2;
      levels.live = false;
    } else {
      levels.bass *= 1 - k; levels.mid *= 1 - k; levels.high *= 1 - k;
    }
    levels.level = levels.bass * 0.5 + levels.mid * 0.35 + levels.high * 0.15;
    levels.beat = Math.max(0, levels.bass - lastBass) * 4 + levels.beat * 0.86;
    lastBass = levels.bass;
    levels.freq = freq; levels.wave = wave;
    return levels;
  },

  restore() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      const v = parseFloat(localStorage.getItem("sonora.volume"));
      if (isFinite(v)) audio.volume = v;
      if (!s?.queue?.length) return;
      this.queue = s.queue; this.order = s.order; this.pos = s.pos; this.source = s.source; this.repeat = s.repeat || "off"; this.shuffle = !!s.shuffle;
      if (!this.current) { this.pos = -1; return; }
      bus.emit("queue"); bus.emit("modes");
      this.load(false, s.time || 0);
    } catch { /* corrupt session: ignore */ }
  },
};

function ensureGraph() {
  if (ctx || !(window.AudioContext || window.webkitAudioContext)) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    gain = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    freq = new Uint8Array(analyser.frequencyBinCount);
    wave = new Uint8Array(analyser.fftSize);
    src.connect(gain); gain.connect(analyser); analyser.connect(ctx.destination);
  } catch (e) {
    console.warn("Web Audio unavailable, using tempo-based visuals", e);
    ctx = null; gain = null; analyser = null;
  }
}

function fade(to, seconds) {
  if (!gain || !ctx) return Promise.resolve();
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
  gain.gain.exponentialRampToValueAtTime(Math.max(to, 0.0001), now + seconds);
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

function shuffleOrder(e, keepFirst) {
  const rest = e.queue.map((_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  e.order = keepFirst != null && keepFirst >= 0 ? [keepFirst, ...rest] : rest;
  e.pos = 0;
}

let lastPersist = 0;
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      queue: engine.queue, order: engine.order, pos: engine.pos, source: engine.source,
      repeat: engine.repeat, shuffle: engine.shuffle, time: audio.currentTime || 0,
    }));
  } catch { /* storage full or blocked */ }
}
function persistVolume() { try { localStorage.setItem("sonora.volume", String(audio.volume)); } catch { /* ignore */ } }

function updateMediaSession(t) {
  if (!("mediaSession" in navigator)) return;
  const art = t.album?.coverUrl || t.album?.coverSmallUrl;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist?.name, album: t.album?.title,
    artwork: art ? [{ src: new URL(art, location.href).href, sizes: "1024x1024", type: "image/jpeg" }] : [],
  });
}
if ("mediaSession" in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler("play", () => engine.play());
  ms.setActionHandler("pause", () => engine.pause());
  ms.setActionHandler("nexttrack", () => engine.next());
  ms.setActionHandler("previoustrack", () => engine.prev());
  try { ms.setActionHandler("seekto", (d) => engine.seek(d.seekTime)); } catch { /* unsupported */ }
}

audio.addEventListener("play", () => { engine.playing = true; document.body.classList.remove("paused"); bus.emit("state", true); });
audio.addEventListener("pause", () => { engine.playing = false; document.body.classList.add("paused"); bus.emit("state", false); persist(); });
audio.addEventListener("ended", () => engine.next(true));
audio.addEventListener("timeupdate", () => {
  const t = engine.current;
  if (t && !engine._counted && audio.currentTime > 5) {
    engine._counted = true;
    api.post(`/api/tracks/${t.id}/play`).catch(() => {});
  }
  const now = performance.now();
  if (now - lastPersist > 4000) { lastPersist = now; persist(); }
});
audio.addEventListener("loadedmetadata", () => {
  if (engine._startAt) { audio.currentTime = engine._startAt; engine._startAt = 0; }
  bus.emit("duration", audio.duration);
});
audio.addEventListener("error", () => {
  if (audio.src) bus.emit("toast", { message: "This track couldn't be loaded. Skipping to the next one.", error: true });
  setTimeout(() => engine.pos < engine.order.length - 1 && engine.next(), 900);
});
document.body.classList.add("paused");
