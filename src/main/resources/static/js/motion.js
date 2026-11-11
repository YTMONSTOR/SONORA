// Motion system: GSAP when available, Web Animations API otherwise. Honors reduced-motion.
import { store, bus } from "./store.js";
import { isTouch, $$ } from "./util.js";

const mq = matchMedia("(prefers-reduced-motion: reduce)");
export function reducedMotion() {
  const pref = store.settings.motion;
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return mq.matches;
}
function applyMotionClass() { document.body.classList.toggle("reduce-motion", store.settings.motion === "reduced"); }
bus.on("settings", applyMotionClass);

const gsap = () => window.gsap;

/** Animate from → to. Returns a promise that resolves when done. */
export function tween(target, from, to, { duration = 0.8, ease = "expo.out", delay = 0, stagger = 0 } = {}) {
  const els = target instanceof Element ? [target] : [...target];
  if (!els.length) return Promise.resolve();
  if (reducedMotion()) { els.forEach((e) => Object.assign(e.style, styleOf(to))); return Promise.resolve(); }
  if (gsap()) return new Promise((done) => gsap().fromTo(els, from, { ...to, duration, ease, delay, stagger, onComplete: done }));
  const kf = [styleOf(from), styleOf(to)];
  return Promise.all(els.map((e, i) => e.animate(kf, {
    duration: duration * 1000, delay: (delay + i * stagger) * 1000, easing: "cubic-bezier(.22,.9,.24,1)", fill: "both",
  }).finished)).then(() => {});
}

function styleOf(p) {
  const s = {}; const t = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === "y") t.push(`translateY(${typeof v === "number" ? v + "px" : v})`);
    else if (k === "x") t.push(`translateX(${typeof v === "number" ? v + "px" : v})`);
    else if (k === "scale") t.push(`scale(${v})`);
    else if (k === "rotate") t.push(`rotate(${v}deg)`);
    else if (k === "filter" || k === "opacity" || k === "clipPath") s[k] = String(v);
  }
  if (t.length) s.transform = t.join(" ");
  return s;
}

// ---- reveal on scroll -------------------------------------------------
let revealIO;
export function observeReveals(root) {
  const els = $$(".reveal", root);
  if (reducedMotion() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  revealIO ??= new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealIO.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  els.forEach((e) => revealIO.observe(e));
}

// ---- page transitions -------------------------------------------------
export async function pageOut(view) {
  if (reducedMotion() || !view.firstElementChild) return;
  view.classList.add("leaving");
  await tween(view.children, { opacity: 1, y: 0, filter: "blur(0px)" }, { opacity: 0, y: -12, filter: "blur(10px)" }, { duration: 0.32, ease: "power2.in" });
}
export async function pageIn(view) {
  view.classList.remove("leaving");
  if (reducedMotion()) return;
  await tween(view.children, { opacity: 0, y: 18, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)" }, { duration: 0.75 });
  [...view.children].forEach((c) => { c.style.transform = ""; c.style.filter = ""; c.style.opacity = ""; });
}

// ---- pointer effects: magnetic buttons, card tilt, custom cursor --------
export function initPointerFx() {
  applyMotionClass();
  if (isTouch()) return;
  const cursor = document.getElementById("cursor");
  const dot = cursor.querySelector(".cursor__dot"), ring = cursor.querySelector(".cursor__ring");
  let mx = -100, my = -100, rx = -100, ry = -100;
  const enableCursor = () => document.body.classList.toggle("has-cursor", store.settings.cursor !== false && !reducedMotion());
  enableCursor(); bus.on("settings", enableCursor);

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
  }, { passive: true });
  (function loop() {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
  addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  addEventListener("pointerup", () => cursor.classList.remove("is-down"));
  document.addEventListener("pointerover", (e) => {
    cursor.classList.toggle("is-hover", !!e.target.closest("a, button, [role=button], input[type=range], .card, label.switch"));
  });

  // magnetic buttons
  document.addEventListener("pointermove", (e) => {
    const m = e.target.closest?.(".magnetic");
    if (!m || reducedMotion()) return;
    const r = m.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    m.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
    m.onpointerleave ??= () => { m.style.transform = ""; };
  }, { passive: true });

  // 3D tilt + light sweep for cover art
  document.addEventListener("pointermove", (e) => {
    const art = e.target.closest?.(".card__art, .collection__art");
    if (!art || reducedMotion()) return;
    const r = art.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const max = art.classList.contains("collection__art") ? 7 : 10;
    art.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    art.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    art.style.setProperty("--gx", `${px * 100}%`);
    art.style.setProperty("--gy", `${py * 100}%`);
    art.onpointerleave ??= () => { art.style.setProperty("--rx", "0deg"); art.style.setProperty("--ry", "0deg"); };
  }, { passive: true });
}

/** FLIP: fly an image from its current rect to a target element (used when an album moves into the player). */
export function flyTo(fromRect, src, targetEl) {
  if (reducedMotion() || !fromRect || !targetEl) return Promise.resolve();
  const to = targetEl.getBoundingClientRect();
  const img = document.createElement("img");
  img.src = src; img.alt = "";
  Object.assign(img.style, {
    position: "fixed", left: fromRect.left + "px", top: fromRect.top + "px", width: fromRect.width + "px", height: fromRect.height + "px",
    borderRadius: "18px", zIndex: 70, transformOrigin: "0 0", pointerEvents: "none", objectFit: "cover", boxShadow: "0 30px 60px -20px rgba(139,92,246,.8)",
  });
  document.body.appendChild(img);
  const dx = to.left - fromRect.left, dy = to.top - fromRect.top, s = to.width / fromRect.width;
  return img.animate([
    { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.35}px) scale(${(1 + s) / 2}) rotate(-6deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0)`, opacity: 0.2 },
  ], { duration: 900, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }).finished.then(() => img.remove());
}
