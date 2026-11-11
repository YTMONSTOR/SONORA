// Home hero: a chrome vinyl monolith inside a ring of live frequency bars, with glass sculpture,
// floating records, headphones, particles and moving coloured light. Reacts to the music and the pointer.
import { loadThree, quality, createRenderer, studioEnvironment, runLoop, disposeScene, damp, loadModel } from "./core.js";
import { vinylTexture, makeVinyl, makeChromeDisc, makeSculpture, makeHeadphones, makeParticles, makeWaveRing, makeRipples, loadImage, setVinylLabel } from "./objects.js";
import { engine } from "../audio.js";
import { bus } from "../store.js";

export async function createHero(container, { album } = {}) {
  const THREE = await loadThree();
  if (!THREE || !container.isConnected) return null;
  const q = quality();
  const canvas = document.createElement("canvas");
  canvas.className = "hero__canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);

  let renderer;
  try { renderer = createRenderer(THREE, canvas, q); } catch (e) { canvas.remove(); return null; }
  const env = studioEnvironment(THREE, renderer);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050407, 0.055);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 0.2, 9);

  // ---- lights
  scene.add(new THREE.AmbientLight(0x2a1f45, 0.6));
  const key = new THREE.SpotLight(0xffffff, 60, 30, Math.PI / 6, 0.6, 1.6);
  key.position.set(3, 6, 6); key.castShadow = q.shadows;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004;
  scene.add(key);
  const iris = new THREE.PointLight(0x8b5cf6, 40, 18, 1.6); scene.add(iris);
  const volt = new THREE.PointLight(0xb6ff4a, 6, 9, 2); scene.add(volt);
  const rim = new THREE.DirectionalLight(0xb197fc, 1.4); rim.position.set(-6, 2, -4); scene.add(rim);

  // ---- centerpiece
  const rig = new THREE.Group(); scene.add(rig);
  const monolith = new THREE.Group(); rig.add(monolith);
  const img = await loadImage(album?.coverUrl);
  const vTex = vinylTexture(THREE, { image: img, palette: album?.palette });
  const vinyl = makeVinyl(THREE, { texture: vTex, radius: 1.55, thickness: 0.035, segments: q.segments, env });
  vinyl.rotation.x = Math.PI / 2;                   // face the camera
  const spinner = new THREE.Group(); spinner.add(vinyl); monolith.add(spinner);

  const disc = makeChromeDisc(THREE, { radius: 1.2, env, segments: q.segments });
  disc.position.set(0.9, 0.45, -1.1); monolith.add(disc);

  const ring = makeWaveRing(THREE, { count: q.tier === "low" ? 64 : 112, radius: 1.75, env });
  monolith.add(ring);
  const ripples = makeRipples(THREE, { radius: 1.75 }); monolith.add(ripples);

  const sculpture = makeSculpture(THREE, { env, transmission: q.transmission, segments: q.segments });
  sculpture.scale.setScalar(0.75); scene.add(sculpture);

  let phones = makeHeadphones(THREE, { env });
  phones.scale.setScalar(0.62); scene.add(phones);
  loadModel(THREE, "headphones", env).then((m) => {
    if (!m || !container.isConnected) return;
    scene.remove(phones); disposeScene(phones); phones = m; scene.add(m);
  });

  // small floating records sharing one geometry/material
  const minis = [];
  const miniTex = vinylTexture(THREE, { palette: album?.palette, size: 512 });
  const miniProto = makeVinyl(THREE, { texture: miniTex, radius: 0.42, thickness: 0.015, segments: 48, env });
  const miniCount = q.tier === "low" ? 3 : 6;
  for (let i = 0; i < miniCount; i++) {
    const m = miniProto.clone();
    m.userData = { a: (i / miniCount) * Math.PI * 2, r: 3.2 + (i % 3) * 0.7, y: (i % 2 ? 1 : -1) * (0.6 + Math.random() * 1.2), s: 0.6 + Math.random() * 0.5, spin: 0.3 + Math.random() };
    m.scale.setScalar(m.userData.s);
    scene.add(m); minis.push(m);
  }

  const particles = makeParticles(THREE, { count: q.particles, radius: 9 });
  scene.add(particles);

  // shadow catcher floor
  if (q.shadows) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; floor.receiveShadow = true; scene.add(floor);
  }

  // ---- layout: centerpiece sits right of the headline on wide screens, above it on phones
  let layout = { x: 2.1, y: 0.15, z: 0, scale: 1 };
  const onResize = (w, h) => {
    const narrow = w / h < 0.9;
    layout = narrow ? { x: 0, y: 1.05, z: -0.6, scale: 0.78 } : w / h < 1.4 ? { x: 1.4, y: 0.3, z: -0.4, scale: 0.86 } : { x: 2.15, y: 0.15, z: 0, scale: 1 };
  };

  // ---- interaction: pointer parallax (mouse) + drag-to-spin (touch & mouse)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let drag = null, spinBoost = 0;
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (drag) { spinBoost += (e.clientX - drag) * 0.004; drag = e.clientX; }
  };
  const onDown = (e) => { if (e.target === canvas) drag = e.clientX; };
  const onUp = () => { drag = null; };
  container.addEventListener("pointermove", onMove, { passive: true });
  container.addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);

  // swap label when the featured album or now-playing track changes
  const offTrack = bus.on("track", async (t) => {
    const im = await loadImage(t?.album?.coverUrl);
    if (im) setVinylLabel(THREE, vinyl, vinylTexture(THREE, { image: im, palette: t.album.palette }));
  });

  // ---- entrance: camera glides in from depth while the monolith unfolds
  const intro = { t: q.reduced ? 1 : 0 };
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  let spin = 0;

  const loop = runLoop({
    renderer, camera, container, onResize,
    frame: (t, dt, now) => {
      const L = engine.levels(now);
      const motion = q.reduced ? 0.15 : 1;
      intro.t = Math.min(1, intro.t + dt / 2.6);
      const e = ease(intro.t);

      pointer.x = damp(pointer.x, pointer.tx, 3, dt);
      pointer.y = damp(pointer.y, pointer.ty, 3, dt);

      // camera: dolly-in + parallax
      camera.position.x = pointer.x * 0.55 * motion;
      camera.position.y = 0.2 - pointer.y * 0.35 * motion;
      camera.position.z = 9 + (1 - e) * 9;
      camera.lookAt(layout.x * 0.35, layout.y * 0.5, 0);

      // centerpiece
      rig.position.set(layout.x, layout.y, layout.z);
      rig.scale.setScalar(layout.scale * (0.6 + 0.4 * e));
      monolith.rotation.y = -0.38 + pointer.x * 0.25 * motion + Math.sin(t * 0.25) * 0.08 * motion;
      monolith.rotation.x = 0.12 - pointer.y * 0.12 * motion + Math.sin(t * 0.2) * 0.04 * motion;
      monolith.position.y = Math.sin(t * 0.6) * 0.06 * motion;

      const speed = engine.playing ? 0.9 + L.bass * 1.6 : 0.18;
      spinBoost *= Math.pow(0.04, dt);
      spin += (speed * motion + spinBoost) * dt;
      vinyl.rotation.y = spin;                      // rotates around its own axis (it was tipped onto X)
      disc.rotation.z = -spin * 0.6;
      disc.position.x = 0.9 + Math.sin(t * 0.3) * 0.08;

      ring.userData.update(L.freq, L.level, t);
      ring.rotation.z = t * 0.05 * motion;
      ripples.userData.update(t, L.bass);
      const pulse = 1 + L.beat * 0.04;
      vinyl.scale.setScalar(pulse);

      // orbiters
      const ox = layout.x, oy = layout.y;
      sculpture.position.set(ox - 2.0 * layout.scale + Math.sin(t * 0.4) * 0.15, oy + 1.3 * layout.scale + Math.cos(t * 0.5) * 0.12, 0.6);
      sculpture.rotation.set(t * 0.21 * motion, t * 0.33 * motion, 0);
      sculpture.scale.setScalar(0.62 * layout.scale * (1 + L.mid * 0.15) * e);
      phones.position.set(ox + 1.7 * layout.scale, oy - 1.45 * layout.scale + Math.sin(t * 0.7) * 0.08, 1.2);
      phones.rotation.set(0.35 + Math.sin(t * 0.4) * 0.08, -0.6 + pointer.x * 0.2, 0.15 + Math.sin(t * 0.3) * 0.05);
      phones.scale.setScalar(0.55 * layout.scale * e);
      minis.forEach((m) => {
        const u = m.userData, a = u.a + t * 0.05 * motion;
        m.position.set(ox + Math.cos(a) * u.r, oy + u.y + Math.sin(t * 0.5 + u.a) * 0.2, Math.sin(a) * u.r - 1.5);
        m.rotation.set(Math.PI / 2 + Math.sin(t * 0.3 + u.a) * 0.6, t * u.spin * motion, 0.3);
      });

      // light choreography
      iris.position.set(ox + Math.cos(t * 0.5) * 4, oy + Math.sin(t * 0.7) * 2, 2.5 + Math.sin(t * 0.4) * 1.5);
      iris.intensity = 30 + L.bass * 90;
      volt.position.set(ox + Math.cos(-t * 0.8) * 2.2, oy - 1.6, 2);
      volt.intensity = 2 + L.high * 30;
      key.intensity = 45 + L.level * 30;

      particles.material.uniforms.uTime.value = t;
      particles.material.uniforms.uLevel.value = L.level;
      particles.rotation.y = t * 0.02;

      renderer.render(scene, camera);
    },
  });

  return {
    dispose() {
      loop.dispose(); offTrack();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      disposeScene(scene, [env, miniTex]);
      renderer.dispose(); renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
