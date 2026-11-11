// Procedural 3D objects for SONORA: vinyl, chrome discs, glass sculpture, headphones, particles, sound-wave ring.

const imgCache = new Map();
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise((res) => {
      const i = new Image(); i.decoding = "async";
      i.onload = () => res(i); i.onerror = () => res(null); i.src = url;
    }));
  }
  return imgCache.get(url);
}

/** Canvas texture of a record face: micro-grooves, track gaps, printed label (album art) and spindle hole. */
export function vinylTexture(THREE, { image = null, palette = ["#120a24", "#8b5cf6", "#b6ff4a"], size = 1024 } = {}) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), R = size / 2;
  g.translate(R, R);
  g.fillStyle = "#08070b"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // grooves
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gaps = [0.52, 0.64, 0.77, 0.88].map((x) => x * R);
  for (let r = R * 0.36; r < R * 0.985; r += size / 900) {
    const inGap = gaps.some((gp) => Math.abs(r - gp) < size / 260);
    g.strokeStyle = inGap ? "rgba(0,0,0,.9)" : `rgba(${200 + rnd() * 55 | 0},${190 + rnd() * 50 | 0},255,${0.025 + rnd() * 0.06})`;
    g.lineWidth = inGap ? size / 220 : size / 1800;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  }
  // outer lip
  g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = size / 300; g.beginPath(); g.arc(0, 0, R * 0.993, 0, Math.PI * 2); g.stroke();
  // label
  const L = R * 0.33;
  g.save(); g.beginPath(); g.arc(0, 0, L, 0, Math.PI * 2); g.clip();
  if (image) {
    g.drawImage(image, -L, -L, L * 2, L * 2);
  } else {
    const grad = g.createRadialGradient(-L * 0.4, -L * 0.4, 0, 0, 0, L);
    grad.addColorStop(0, palette[1]); grad.addColorStop(1, palette[0]);
    g.fillStyle = grad; g.fillRect(-L, -L, L * 2, L * 2);
  }
  const shade = g.createRadialGradient(0, 0, L * 0.6, 0, 0, L);
  shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = shade; g.fillRect(-L, -L, L * 2, L * 2);
  g.restore();
  g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = size / 500; g.beginPath(); g.arc(0, 0, L, 0, Math.PI * 2); g.stroke();
  // spindle hole
  g.fillStyle = "#020203"; g.beginPath(); g.arc(0, 0, R * 0.022, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

export function makeVinyl(THREE, { texture, radius = 1, thickness = 0.025, segments = 96, env = null }) {
  const geo = new THREE.CylinderGeometry(radius, radius, thickness, segments, 1);
  const face = new THREE.MeshPhysicalMaterial({
    map: texture, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.18, envMap: env, envMapIntensity: 1.2,
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0x111016, roughness: 0.4, metalness: 0.6, envMap: env });
  const mesh = new THREE.Mesh(geo, [edge, face, face]);
  mesh.castShadow = true;
  return mesh;
}

export function setVinylLabel(THREE, mesh, texture) {
  const face = mesh.material[1];
  face.map?.dispose(); face.map = texture; face.needsUpdate = true;
}

/** Mirror-chrome disc with thin-film iridescence (CD-like). */
export function makeChromeDisc(THREE, { radius = 1, env, segments = 96 }) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, radius * 0.16, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: segments });
  geo.center();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe6e2f2, metalness: 1, roughness: 0.08, envMap: env, envMapIntensity: 1.5,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  return m;
}

/** Glass/chrome audio sculpture: a twisted torus knot (glass on high tier, polished chrome-violet otherwise). */
export function makeSculpture(THREE, { env, transmission, segments = 128 }) {
  const geo = new THREE.TorusKnotGeometry(0.42, 0.13, segments * 2, Math.max(16, segments / 4), 2, 3);
  const mat = transmission
    ? new THREE.MeshPhysicalMaterial({ color: 0xd8ccff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.9, ior: 1.45,
        attenuationColor: new THREE.Color(0x8b5cf6), attenuationDistance: 1.4, envMap: env, envMapIntensity: 1.4, clearcoat: 1 })
    : new THREE.MeshPhysicalMaterial({ color: 0xb197fc, metalness: 1, roughness: 0.14, envMap: env, envMapIntensity: 1.4, clearcoat: 1, iridescence: 0.6 });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  return m;
}

/** Studio headphones assembled from primitives: brushed band, chrome yokes, graphite cups, soft cushions. */
export function makeHeadphones(THREE, { env }) {
  const g = new THREE.Group();
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xdedbe8, metalness: 1, roughness: 0.16, envMap: env, envMapIntensity: 1.4, clearcoat: 0.6 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x1a1822, metalness: 0.6, roughness: 0.35, envMap: env, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.9, metalness: 0 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, emissive: 0x8b5cf6, emissiveIntensity: 1.4, roughness: 0.3 });

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 16, 80, Math.PI), chrome);
  band.position.y = 0.12; g.add(band);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.07, 16, 60, Math.PI * 0.62), graphite);
  pad.rotation.z = Math.PI * 0.19; pad.position.y = 0.12; g.add(pad);
  for (const side of [-1, 1]) {
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 40, Math.PI), chrome);
    yoke.rotation.set(0, Math.PI / 2, Math.PI); yoke.position.set(side * 0.72, -0.02, 0); g.add(yoke);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.16, 48), graphite);
    cup.rotation.z = Math.PI / 2; cup.position.set(side * 0.72, -0.2, 0); g.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 48), accent);
    ring.rotation.y = Math.PI / 2; ring.position.set(side * (0.72 + 0.082), -0.2, 0); g.add(ring);
    const cush = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 16, 40), cushion);
    cush.rotation.y = Math.PI / 2; cush.position.set(side * (0.72 - 0.1), -0.2, 0); g.add(cush);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Soft additive particles drifting in a shell; size and glow respond to audio. */
export function makeParticles(THREE, { count = 1500, radius = 7, colors = [0x8b5cf6, 0xb197fc, 0xb6ff4a] }) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = new Float32Array(count);
  const c = colors.map((x) => new THREE.Color(x));
  for (let i = 0; i < count; i++) {
    const r = radius * (0.35 + Math.random() * 0.65), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
    const pick = Math.random() < 0.06 ? c[2] : Math.random() < 0.5 ? c[0] : c[1];
    col.set([pick.r, pick.g, pick.b], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */`
      attribute float seed; varying vec3 vColor; varying float vAlpha;
      uniform float uTime; uniform float uLevel; uniform float uPixel;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + seed * 0.08);
        p.x += sin(t + seed * 40.0) * 0.35; p.y += cos(t * 1.3 + seed * 20.0) * 0.25; p.z += sin(t * 0.7 + seed * 10.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = (1.2 + seed * 2.6) * (1.0 + uLevel * 1.6);
        gl_PointSize = size * uPixel * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vColor = color; vAlpha = 0.35 + 0.65 * fract(seed * 7.13 + uTime * 0.05 * seed);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * 1.6, a * a * vAlpha);
      }`,
  });
  return new THREE.Points(geo, mat);
}

/** Ring of instanced chrome bars that follow the live frequency spectrum. */
export function makeWaveRing(THREE, { count = 96, radius = 1.25, env }) {
  const geo = new THREE.BoxGeometry(0.018, 1, 0.018); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.2, envMap: env, emissive: 0x6d28d9, emissiveIntensity: 0.6 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const lows = new THREE.Color(0xb197fc), highs = new THREE.Color(0xb6ff4a);
  const heights = new Float32Array(count);
  mesh.userData.update = (freq, level, t) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      // mirror the spectrum so both halves of the ring move together
      const bin = freq ? freq[Math.floor((i < count / 2 ? i : count - i) / (count / 2) * freq.length * 0.55) + 1] / 255 : 0;
      const idle = 0.04 + 0.03 * Math.sin(t * 1.4 + i * 0.35);
      const target = Math.max(idle, bin * 0.55 + level * 0.1);
      heights[i] += (target - heights[i]) * 0.3;
      dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      dummy.rotation.set(0, 0, a - Math.PI / 2);
      dummy.scale.set(1, 0.02 + heights[i], 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.copy(lows).lerp(highs, Math.min(1, heights[i] * 1.4));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  mesh.userData.update(null, 0, 0);
  return mesh;
}

/** Concentric ripple rings that pulse outward on the beat (the "sound wave" object). */
export function makeRipples(THREE, { count = 4, radius = 1.4 }) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.004, 6, 160),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xb197fc : 0x8b5cf6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.userData.phase = i / count; g.add(m);
  }
  g.userData.update = (t, level) => {
    g.children.forEach((m) => {
      const p = (t * 0.18 + m.userData.phase) % 1;
      m.scale.setScalar(1 + p * 1.6);
      m.material.opacity = (1 - p) * (0.12 + level * 0.7);
    });
  };
  return g;
}

/** Tonearm with chrome pivot and headshell. */
export function makeTonearm(THREE, { env }) {
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe4e0ee, metalness: 1, roughness: 0.15, envMap: env, clearcoat: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15141a, metalness: 0.5, roughness: 0.4, envMap: env });
  const pivot = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 40), dark); base.rotation.x = Math.PI / 2; pivot.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 30), chrome); cap.rotation.x = Math.PI / 2; cap.position.z = 0.1; pivot.add(cap);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 16), chrome);
  arm.position.set(0, -0.75, 0.12); pivot.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.05), dark); head.position.set(0, -1.55, 0.12); head.rotation.z = 0.35; pivot.add(head);
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 24), chrome); weight.position.set(0, 0.22, 0.12); pivot.add(weight);
  return pivot;
}

/** Album sleeve: cover on the front, dark card on the back, vinyl tucked inside. */
export function makeSleeve(THREE, { texture, env, size = 1.6, vinylTex }) {
  const g = new THREE.Group();
  const front = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.6 });
  const back = new THREE.MeshStandardMaterial({ color: 0x15131b, roughness: 0.6, metalness: 0.2, envMap: env });
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.03), [back, back, back, back, front, back]);
  sleeve.castShadow = true;
  const vinyl = makeVinyl(THREE, { texture: vinylTex, radius: size * 0.47, thickness: 0.012, segments: 64, env });
  vinyl.rotation.x = Math.PI / 2;
  vinyl.position.z = -0.03;
  g.add(vinyl, sleeve);
  g.userData = { sleeve, vinyl, front };
  return g;
}
