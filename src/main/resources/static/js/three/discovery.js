// 3D album discovery: sleeves on a curved arc. Hover lights a sleeve and slides its record out;
// clicking the centred album pulls the record free and hands it to the player.
import { loadThree, quality, createRenderer, studioEnvironment, runLoop, disposeScene, textureLoader, damp } from "./core.js";
import { makeSleeve, vinylTexture, loadImage, makeParticles } from "./objects.js";
import { engine } from "../audio.js";

export async function createDiscovery(container, { albums, onFocus, onSelect }) {
  const THREE = await loadThree();
  if (!THREE || !container.isConnected || !albums.length) return null;
  const q = quality();
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  let renderer;
  try { renderer = createRenderer(THREE, canvas, q); } catch { canvas.remove(); return null; }
  const env = studioEnvironment(THREE, renderer);
  const textures = textureLoader(THREE);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050407, 6, 15);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.4);

  scene.add(new THREE.AmbientLight(0x241a3d, 0.9));
  const top = new THREE.DirectionalLight(0xffffff, 1.2); top.position.set(0, 5, 5); scene.add(top);
  const spot = new THREE.SpotLight(0xb197fc, 0, 12, Math.PI / 9, 0.5, 1.2);
  spot.position.set(0, 3.2, 3.2); scene.add(spot, spot.target);
  const under = new THREE.PointLight(0x8b5cf6, 14, 8, 1.6); under.position.set(0, -1.6, 1.5); scene.add(under);
  const voltGlint = new THREE.PointLight(0xb6ff4a, 0, 4, 2); scene.add(voltGlint);

  const particles = makeParticles(THREE, { count: Math.round(q.particles * 0.35), radius: 8 });
  scene.add(particles);

  // build sleeves
  const items = await Promise.all(albums.map(async (a, i) => {
    const [tex, img] = await Promise.all([textures.load(a.coverSmallUrl || a.coverUrl), loadImage(a.coverSmallUrl)]);
    const vTex = vinylTexture(THREE, { image: img, palette: a.palette, size: 512 });
    const g = makeSleeve(THREE, { texture: tex || vTex, env, size: 1.6, vinylTex: vTex });
    g.userData.index = i; g.userData.album = a; g.userData.out = 0; g.userData.glow = 0;
    g.userData.sleeve.userData.index = i;
    scene.add(g);
    return g;
  }));
  if (!container.isConnected) { disposeScene(scene, [env]); renderer.dispose(); return null; }

  // ---- state
  let focus = 0, target = 0, hovered = -1, selecting = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-5, -5);
  const clampIdx = (v) => Math.max(0, Math.min(items.length - 1, v));
  const setTarget = (i) => { target = clampIdx(i); onFocus?.(albums[Math.round(target)], Math.round(target)); };
  setTarget(Math.min(1, items.length - 1));

  // ---- input: drag / swipe, wheel, hover, click
  let down = null, moved = 0;
  const onDown = (e) => { down = { x: e.clientX, t: target }; moved = 0; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (down) {
      const dx = e.clientX - down.x; moved = Math.max(moved, Math.abs(dx));
      target = clampIdx(down.t - dx / Math.max(160, r.width * 0.18));
    }
  };
  const onUp = (e) => {
    if (!down) return;
    const wasDrag = moved > 8;
    down = null;
    if (wasDrag) { setTarget(Math.round(target)); return; }
    // click
    const hit = pick();
    if (hit < 0) return;
    if (hit !== Math.round(target)) setTarget(hit);
    else select(hit);
  };
  const onLeave = () => { ndc.set(-5, -5); };
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || selecting) return;
    e.preventDefault();
    target = clampIdx(target + e.deltaX * 0.004);
    clearTimeout(onWheel.t); onWheel.t = setTimeout(() => setTarget(Math.round(target)), 140);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  function pick() {
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(items.map((g) => g.userData.sleeve), false);
    return hits.length ? hits[0].object.userData.index : -1;
  }

  function select(i) {
    if (selecting) return;
    selecting = { i, t: 0 };
  }

  // project a sleeve's bounds to screen for the DOM hand-off animation
  const v = new THREE.Vector3();
  function screenRect(g) {
    const r = canvas.getBoundingClientRect();
    const pts = [[-0.8, 0.8], [0.8, -0.8]].map(([x, y]) => {
      v.set(x, y, 0.02).applyMatrix4(g.matrixWorld).project(camera);
      return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
    });
    return new DOMRect(pts[0][0], pts[0][1], pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  }

  const loop = runLoop({
    renderer, camera, container,
    onResize: (w, h) => { camera.position.z = w / h < 1 ? 8.4 : 6.4; },
    frame: (t, dt, now) => {
      const L = engine.levels(now);
      if (!down) focus = damp(focus, target, 6, dt); else focus = damp(focus, target, 14, dt);

      hovered = down || selecting ? hovered : pick();
      canvas.style.cursor = hovered >= 0 ? "pointer" : "grab";

      items.forEach((g, i) => {
        const d = i - focus;
        const ad = Math.abs(d);
        const angle = d * 0.42;
        const R = 5.2;
        g.position.set(Math.sin(angle) * R * 0.92, -0.1 + Math.sin(t * 0.6 + i) * 0.03, Math.cos(angle) * R - R - Math.min(ad, 3) * 0.25);
        g.rotation.y = -angle * 1.25 + Math.sign(d) * Math.min(ad, 1) * -0.25;
        const isHover = i === hovered, isFocus = Math.round(focus) === i;
        const isSel = selecting?.i === i;
        g.userData.out = damp(g.userData.out, isSel ? 1.2 : isHover ? 0.55 : isFocus ? 0.18 : 0, 7, dt);
        g.userData.glow = damp(g.userData.glow, isHover || isSel ? 1 : 0, 8, dt);
        const { vinyl, front } = g.userData;
        vinyl.position.x = g.userData.out * 0.95;
        vinyl.rotation.y += dt * (isSel ? 6 : isFocus && engine.playing ? 0.8 + L.bass * 2 : isHover ? 1.2 : 0.05);
        front.emissive.setRGB(0.25 * g.userData.glow, 0.15 * g.userData.glow, 0.45 * g.userData.glow);
        front.emissiveIntensity = 1;
        front.envMapIntensity = 0.5 + g.userData.glow * 0.9;
        const s = (isFocus ? 1.05 : 0.92) * (isSel ? 1 + selecting.t * 0.12 : 1);
        g.scale.setScalar(damp(g.scale.x, s, 6, dt));
      });

      // hover lighting follows the hovered (or focused) sleeve
      const lit = items[hovered >= 0 ? hovered : Math.round(focus)];
      if (lit) {
        spot.target.position.copy(lit.position);
        spot.position.set(lit.position.x, 3.2, lit.position.z + 3.2);
        spot.intensity = damp(spot.intensity, hovered >= 0 ? 55 : 22, 6, dt);
        voltGlint.position.set(lit.position.x + 1.1, lit.position.y + 0.9, lit.position.z + 0.8);
        voltGlint.intensity = damp(voltGlint.intensity, hovered >= 0 ? 4 : 0.6 + L.high * 6, 6, dt);
      }
      under.intensity = 10 + L.bass * 40;

      // cinematic select: dolly in, record slides out and spins, then hand off
      if (selecting) {
        selecting.t = Math.min(1, selecting.t + dt / 0.85);
        const g = items[selecting.i];
        camera.position.x = damp(camera.position.x, g.position.x * 0.6, 4, dt);
        camera.fov = damp(camera.fov, 24, 4, dt); camera.updateProjectionMatrix();
        if (selecting.t >= 1 && !selecting.done) {
          selecting.done = true;
          const rect = screenRect(g);
          onSelect?.(albums[selecting.i], rect);
          setTimeout(() => { selecting = null; }, 600);
        }
      } else {
        camera.position.x = damp(camera.position.x, 0, 3, dt);
        camera.fov = damp(camera.fov, 30, 3, dt); camera.updateProjectionMatrix();
      }

      particles.material.uniforms.uTime.value = t;
      particles.material.uniforms.uLevel.value = L.level * 0.6;
      renderer.render(scene, camera);
    },
  });

  return {
    go(i) { setTarget(i); },
    step(dir) { setTarget(Math.round(target) + dir); },
    selectFocused() { select(Math.round(target)); },
    get index() { return Math.round(target); },
    dispose() {
      loop.dispose();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      disposeScene(scene, [env]); textures.dispose();
      renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove();
    },
  };
}
