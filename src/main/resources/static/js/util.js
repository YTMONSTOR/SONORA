// Small DOM + formatting helpers shared across SONORA.
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped with raw(). */
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += render(vals[i]);
  });
  return new Raw(out);
}
class Raw { constructor(v) { this.v = v; } toString() { return this.v; } }
export const raw = (s) => new Raw(s);
function render(v) {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.v;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

export function el(markup) {
  const t = document.createElement("template");
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}
export function frag(markup) {
  const t = document.createElement("template");
  t.innerHTML = String(markup).trim();
  return t.content;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const icon = (name, cls = "") => raw(`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`);

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtLong(sec) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}
export const fmtNum = (n) => new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
export const plural = (n, one, many = one + "s") => `${fmtNum(n)} ${n === 1 ? one : many}`;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const isTouch = () => matchMedia("(hover: none), (pointer: coarse)").matches;
export const isMobile = () => matchMedia("(max-width: 760px)").matches;

/** Palette fallback for albums without uploaded colours. */
export function paletteOf(album) {
  return album?.palette?.length === 3 ? album.palette : ["#120a24", "#8b5cf6", "#b6ff4a"];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cover art markup: real image, or a generated gradient tile. */
export function coverArt(url, seed = 270, alt = "") {
  if (url) return html`<img src="${url}" alt="${alt}" loading="lazy" decoding="async">`;
  const h = Number(seed) || 270;
  return html`<div class="gen-art" style="background:radial-gradient(120% 120% at 20% 10%, hsl(${h} 80% 55%), hsl(${(h + 40) % 360} 70% 18%) 60%, #07060a)">${icon("note")}</div>`;
}

export function avatar(user, size = 40) {
  const initial = (user?.displayName || user?.username || "?").trim().charAt(0).toUpperCase();
  return html`<span class="avatar" style="--h:${user?.avatarHue ?? 270};width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px">${initial}</span>`;
}

/** Extract a small palette from an image (used for uploaded covers). */
export async function samplePalette(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); c.width = c.height = 24;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let best = [139, 92, 246], bestScore = -1, second = [182, 255, 74], secondScore = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const score = (max - min) * (max / 255);
      if (score > bestScore) { second = best; secondScore = bestScore; best = [r, g, b]; bestScore = score; }
      else if (score > secondScore && Math.abs(r - best[0]) + Math.abs(g - best[1]) + Math.abs(b - best[2]) > 90) { second = [r, g, b]; secondScore = score; }
    }
    const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    return { main: hex(best), accent: hex(second) };
  } finally { URL.revokeObjectURL(url); }
}

export function audioDuration(file) {
  return new Promise((res) => {
    const a = new Audio(); const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => { res(Math.round(a.duration || 0)); URL.revokeObjectURL(url); };
    a.onerror = () => { res(0); URL.revokeObjectURL(url); };
    a.src = url;
  });
}
