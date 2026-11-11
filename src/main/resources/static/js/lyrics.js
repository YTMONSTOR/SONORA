// Synchronized lyrics: LRC parsing + a cinematic, frame-accurate view.
import { esc } from "./util.js";

const TS = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

export function parseLRC(text) {
  if (!text) return [];
  let offset = 0;
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const off = rawLine.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (off) { offset = parseInt(off[1], 10) / 1000; continue; }
    const stamps = [...rawLine.matchAll(TS)];
    if (!stamps.length) continue;
    const words = rawLine.replace(TS, "").trim();
    for (const m of stamps) {
      const t = parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(":", "."));
      out.push({ t, text: words });
    }
  }
  out.sort((a, b) => a.t - b.t);
  // offset in LRC is positive = lyrics appear earlier
  return out.map((l) => ({ t: Math.max(0, l.t - offset), text: l.text, instrumental: !l.text || /^[♪♫\s.]*$/.test(l.text) }));
}

/** Index of the last line whose timestamp is <= time (binary search). */
export function activeIndex(lines, time) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export class LyricsView {
  constructor(container, { onSeek } = {}) {
    this.root = container;
    this.onSeek = onSeek;
    this.lines = [];
    this.active = -2;
    this.els = [];
    this.root.addEventListener("click", (e) => {
      const b = e.target.closest(".lyrics__line");
      if (b && this.onSeek) this.onSeek(this.lines[+b.dataset.i].t);
    });
    new ResizeObserver(() => this.position(true)).observe(this.root);
  }

  setLoading() {
    this.lines = []; this.active = -2;
    this.root.innerHTML = `<div class="lyrics__empty"><span>Loading lyrics…</span></div>`;
  }

  setEmpty(title) {
    this.lines = []; this.active = -2;
    this.root.innerHTML = `<div class="lyrics__empty"><b class="h3">No lyrics for this track yet</b><span>Enjoy ${esc(title || "the music")} as it is.</span></div>`;
  }

  setLines(lines) {
    this.lines = lines;
    this.active = -2;
    if (!lines.length) return this.setEmpty();
    this.root.innerHTML = `<div class="lyrics__scroll">${lines.map((l, i) =>
      `<button class="lyrics__line${l.instrumental ? " is-instrumental" : ""}" data-i="${i}" tabindex="-1">${l.instrumental ? "♪ ♪ ♪" : esc(l.text)}</button>`).join("")}</div>`;
    this.scroll = this.root.firstElementChild;
    this.els = [...this.scroll.children];
    this.sync(0, true);
  }

  sync(time, force = false) {
    if (!this.lines.length) return;
    const i = activeIndex(this.lines, time);
    if (i !== this.active || force) {
      this.active = i;
      this.els.forEach((e, k) => {
        const d = Math.abs(k - Math.max(i, 0));
        e.classList.toggle("is-active", k === i);
        e.classList.toggle("is-past", k < i);
        e.style.setProperty("--blur", k === i ? "0px" : `${Math.min(d * 0.7, 2.6)}px`);
        e.setAttribute("aria-current", k === i ? "true" : "false");
      });
      this.position();
    }
    if (i >= 0) {
      const cur = this.lines[i], next = this.lines[i + 1];
      const span = (next ? next.t : cur.t + 5) - cur.t;
      this.els[i].style.setProperty("--lp", `${Math.min(100, ((time - cur.t) / span) * 100)}%`);
    }
  }

  position(instant = false) {
    if (!this.scroll || !this.els.length) return;
    const target = this.els[Math.max(this.active, 0)];
    const h = this.root.clientHeight;
    const y = h * 0.4 - (target.offsetTop + target.offsetHeight / 2);
    if (instant) this.scroll.style.transition = "none";
    this.scroll.style.transform = `translate3d(0, ${y}px, 0)`;
    if (instant) { this.scroll.offsetHeight; this.scroll.style.transition = ""; }
  }
}
