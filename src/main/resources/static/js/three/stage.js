// Full-screen player stage: a turntable platter with the current album as the label, a tonearm that drops
// onto the record while playing, a live spectrum ring and palette-tinted light.
import { loadThree, quality, createRenderer, studioEnvironment, runLoop, disposeScene, damp } from "./core.js";
import { vinylTexture, makeVinyl, makeWaveRing, makeRipples, makeTonearm, makeParticles, loadImage, setVinylLabel } from "./objects.js";
import { engine } from "../audio.js";

export async function createStage(container) {
  const THREE = await loadThree();
  if (!THREE || !container.isConnected) return null;
  const q = quality();
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);
  let renderer;
  try { renderer = createRenderer(THREE, canvas, q); } catch { canvas.remove(); return null; }
  const env = studioEnvironment(THREE, renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.AmbientLight(0x1d1530, 0.8));
  const key = new THREE.SpotLight(0xffffff, 50, 30, Math.PI / 7, 0.6, 1.5); key.position.set(-3, 5, 7); scene.add(key);
  const mainLight = new THREE.PointLight(0x8b5cf6, 40, 16, 1.6); scene.add(mainLight);
  const accentLight = new THREE.PointLight(0xb6ff4a, 8, 10, 2); scene.add(accentLight);

  const rig = new THREE.Group(); scene.add(rig);
  // platter
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.1, 0.12, q.segments),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1822, metalness: 0.9, roughness: 0.25, envMap: env, clearcoat: 0.6 }));
  platter.rotation.x = Math.PI / 2; platter.position.z = -0.1; rig.add(platter);
  const vinyl = makeVinyl(THREE, { texture: vinylTexture(THREE, {}), radius: 1.95, thickness: 0.03, segments: q.segments, env });
  vinyl.rotation.x = Math.PI / 2;
  const spinner = new THREE.Group(); spinner.add(vinyl); rig.add(spinner);
  const ring = makeWaveRing(THREE, { count: q.tier === "low" ? 72 : 128, radius: 2.35, env }); rig.add(ring);
  const ripples = makeRipples(THREE, { radius: 2.35, count: 3 }); rig.add(ripples);
  const arm = makeTonearm(THREE, { env }); arm.position.set(2.15, 1.85, 0.05); rig.add(arm);
  const particles = makeParticles(THREE, { count: Math.round(q.particles * 0.6), radius: 10 }); scene.add(particles);

  let layout = { x: -2.3, y: 0.55, s: 1 };
  const onResize = (w, h) => {
    const narrow = w / h < 0.9;
    layout = narrow ? { x: 0, y: 1.7, s: 0.78 } : w / h < 1.4 ? { x: -1.6, y: 0.8, s: 0.8 } : { x: -2.4, y: 0.75, s: 1 };
  };

  const colors = { main: new THREE.Color(0x8b5cf6), accent: new THREE.Color(0xb6ff4a), tMain: new THREE.Color(0x8b5cf6), tAccent: new THREE.Color(0xb6ff4a) };
  let spin = 0, armAngle = 0.35, tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    tilt.tx = (e.clientX / innerWidth) * 2 - 1; tilt.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener("pointermove", onMove, { passive: true });

  const loop = runLoop({
    renderer, camera, container, onResize,
    frame: (t, dt, now) => {
      const L = engine.levels(now);
      const motion = q.reduced ? 0.15 : 1;
      tilt.x = damp(tilt.x, tilt.tx, 2.5, dt); tilt.y = damp(tilt.y, tilt.ty, 2.5, dt);
      rig.position.set(layout.x, layout.y, 0);
      rig.scale.setScalar(layout.s);
      rig.rotation.set(-0.32 - tilt.y * 0.12 * motion, 0.28 + tilt.x * 0.2 * motion, 0);

      const playing = engine.playing;
      spin += (playing ? 3.46 : 0) * dt * motion; // ≈ 33⅓ rpm
      vinyl.rotation.y = spin;
      // rest outside the platter; while playing the stylus tracks from the outer groove toward the label
      armAngle = damp(armAngle, playing ? -0.25 - (engine.audio.currentTime / (engine.audio.duration || 1)) * 0.5 : 0.35, 2.5, dt);
      arm.rotation.z = armAngle;

      ring.userData.update(L.freq, L.level, t);
      ripples.userData.update(t, L.bass);
      colors.main.lerp(colors.tMain, 1 - Math.exp(-2 * dt));
      colors.accent.lerp(colors.tAccent, 1 - Math.exp(-2 * dt));
      mainLight.color.copy(colors.main); accentLight.color.copy(colors.accent);
      mainLight.position.set(layout.x + Math.cos(t * 0.4) * 4, layout.y + Math.sin(t * 0.5) * 3, 3);
      mainLight.intensity = 25 + L.bass * 80;
      accentLight.position.set(layout.x + 2.5, layout.y - 2, 2);
      accentLight.intensity = 3 + L.high * 25;

      particles.material.uniforms.uTime.value = t;
      particles.material.uniforms.uLevel.value = L.level;
      renderer.render(scene, camera);
    },
  });

  let token = 0;
  return {
    async setTrack(track) {
      if (!track) return;
      const my = ++token;
      const img = await loadImage(track.album?.coverUrl);
      if (my !== token) return;
      setVinylLabel(THREE, vinyl, vinylTexture(THREE, { image: img, palette: track.album?.palette }));
      const p = track.album?.palette;
      if (p) { colors.tMain.set(p[1]); colors.tAccent.set(p[2]); }
    },
    dispose() {
      loop.dispose(); removeEventListener("pointermove", onMove);
      disposeScene(scene, [env]); renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove();
    },
  };
}
