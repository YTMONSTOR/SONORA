// Three.js bootstrap: lazy loading, quality tiers, environment lighting, render loop, disposal.
import { store } from "../store.js";
import { reducedMotion } from "../motion.js";

let threePromise = null;

/** Loads Three.js from the CDN once. Resolves to the module, or null if WebGL/Three is unavailable. */
export function loadThree() {
  if (!webglAvailable()) return Promise.resolve(null);
  threePromise ??= Promise.race([
    import("three").catch((e) => { console.warn("Three.js failed to load", e); return null; }),
    new Promise((r) => setTimeout(() => r(null), 9000)),
  ]);
  return threePromise;
}

let glOk;
export function webglAvailable() {
  if (store.settings.quality === "off") return false;
  if (glOk !== undefined) return glOk;
  try {
    const c = document.createElement("canvas");
    glOk = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { glOk = false; }
  return glOk;
}

/** Device-aware quality settings. */
export function quality() {
  const pref = store.settings.quality;
  const mobile = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  let tier = pref === "high" || pref === "medium" || pref === "low" ? pref
    : mobile ? (cores >= 8 && mem >= 6 ? "medium" : "low")
    : cores <= 4 || mem <= 4 ? "medium" : "high";
  const dpr = window.devicePixelRatio || 1;
  const t = {
    high: { tier, pixelRatio: Math.min(dpr, 2), particles: 2600, shadows: true, transmission: true, segments: 128, antialias: true },
    medium: { tier, pixelRatio: Math.min(dpr, 1.5), particles: 1300, shadows: false, transmission: false, segments: 96, antialias: true },
    low: { tier, pixelRatio: Math.min(dpr, 1.25), particles: 600, shadows: false, transmission: false, segments: 64, antialias: false },
  }[tier];
  t.reduced = reducedMotion();
  return t;
}

export function createRenderer(THREE, canvas, q, { alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, alpha, powerPreference: "high-performance" });
  renderer.setPixelRatio(q.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  if (q.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  return renderer;
}

/** A procedural "studio" (softboxes in the SONORA palette) baked into a PMREM env map for metal + glass reflections. */
export function studioEnvironment(THREE, renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x07060b, side: THREE.BackSide }));
  scene.add(room);
  const box = (w, h, color, intensity, pos, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); m.lookAt(0, 0, 0); scene.add(m);
  };
  box(10, 4, 0xffffff, 3.2, [0, 9, 3]);          // top softbox
  box(6, 10, 0x8b5cf6, 2.6, [-10, 1, -2]);       // left iris wall
  box(4, 8, 0xb197fc, 1.6, [9, 2, -6]);          // right lilac
  box(9, 0.6, 0xb6ff4a, 2.2, [4, -3, 9]);        // thin volt strip (subtle green glints)
  box(6, 3, 0xffffff, 1.4, [-4, 3, 10]);         // front fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return env;
}

/**
 * Visibility-aware animation loop. Calls frame(t, dt) only while the canvas is on screen and the tab is visible,
 * and handles resizing. Returns a controller with dispose().
 */
export function runLoop({ renderer, camera, container, frame, onResize }) {
  let raf = 0, visible = true, last = performance.now(), running = true, elapsed = 0;
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    onResize?.(w, h);
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: 0 });
  io.observe(container);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener("visibilitychange", onVis);

  function tick(now) {
    raf = 0;
    if (!running || !visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now; elapsed += dt;
    frame(elapsed, dt, now);
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && running) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  kick();

  return {
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

/** Free GPU memory for everything in a scene. */
export function disposeScene(scene, extra = []) {
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
      m.dispose?.();
    });
  });
  extra.forEach((x) => x?.dispose?.());
}

export function textureLoader(THREE) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  return {
    load(url) {
      if (!url) return Promise.resolve(null);
      if (cache.has(url)) return cache.get(url);
      const p = new Promise((res) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
      cache.set(url, p);
      return p;
    },
    async dispose() { for (const p of cache.values()) (await p)?.dispose(); cache.clear(); },
  };
}

export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/**
 * Optional GLB/GLTF support: if the page declares <meta name="sonora-model-headphones" content="/assets/models/x.glb">,
 * that model replaces the procedural headphones. Returns null when no model is configured or it fails to load.
 */
export async function loadModel(THREE, name, env) {
  const url = document.querySelector(`meta[name="sonora-model-${name}"]`)?.content;
  if (!url) return null;
  try {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    root.position.sub(box.getCenter(new THREE.Vector3()));
    const wrap = new THREE.Group(); wrap.add(root);
    wrap.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z, 0.001));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && "envMap" in o.material) { o.material.envMap = env; o.material.needsUpdate = true; } } });
    const outer = new THREE.Group(); outer.add(wrap); // scenes scale the outer group; the inner one stays normalised
    return outer;
  } catch (e) {
    console.warn(`Model "${name}" could not be loaded; using the built-in one`, e);
    return null;
  }
}
