// La Source — the scroll world (calm-cinematic). Core three.js only, no addons.
// A single source-stone on water becomes a slowly-built cairn as the page scrolls;
// near the end the camera lifts and a soft dawn horizon opens. Driven by whole-page
// scroll progress via setScroll(0..1). No bundler; vendored three.js module.
import * as THREE from "../vendor/three.module.min.js";

const PLASTER = 0xedf1e8;

/* ------------------------- small maths ------------------------- */
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smooth(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ---- tiny value noise for the pebble silhouette ----
function hash(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  function l(a, b, t) { return a + (b - a) * t; }
  const c000 = hash(xi, yi, zi), c100 = hash(xi + 1, yi, zi);
  const c010 = hash(xi, yi + 1, zi), c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1), c101 = hash(xi + 1, yi, zi + 1);
  const c011 = hash(xi, yi + 1, zi + 1), c111 = hash(xi + 1, yi + 1, zi + 1);
  return l(l(l(c000, c100, u), l(c010, c110, u), v), l(l(c001, c101, u), l(c011, c111, u), v), w);
}
function fbm(x, y, z) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 3; i++) { a += amp * (vnoise(x * f, y * f, z * f) - 0.5); f *= 2; amp *= 0.5; }
  return a;
}

// ---- soft radial sprite texture ----
function radialTexture(inner, outer) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- warm environment (equirect gradient) for material response ----
function warmEnvironment(renderer) {
  const c = document.createElement("canvas"); c.width = 32; c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, "#fff3e2");
  grd.addColorStop(0.45, "#e9d9c4");
  grd.addColorStop(0.75, "#7d7566");
  grd.addColorStop(1.0, "#2b2620");
  g.fillStyle = grd; g.fillRect(0, 0, 32, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}

// ---- soft ripple normal map ----
function rippleNormal() {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"); const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const s = 0.06;
    const nx = fbm(x * s, y * s, 3.1), nxx = fbm((x + 1) * s, y * s, 3.1);
    const ny = fbm(x * s, (y + 1) * s, 3.1);
    const dx = (nxx - nx) * 3, dy = (ny - nx) * 3;
    const i = (y * N + x) * 4;
    img.data[i] = 128 + dx * 90; img.data[i + 1] = 128 + dy * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

// ---- dawn sky gradient (unlit backdrop, revealed on the horizon lift) ----
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 8; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.00, "#f7ead6");  // high warm light
  grd.addColorStop(0.42, "#f0e6cf");
  grd.addColorStop(0.72, "#e6ecd8");  // pale green air
  grd.addColorStop(1.00, "#dfe7d3");  // meets the water haze
  g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ------------------- the cairn : source + stacked stones ------------------- */
// y = centre height once settled · s = scale · rot = spin for variety
// at = scroll progress where the stone begins to rise from the water
const CAIRN = [
  { y: 0.42, s: 1.00, rot: 0.0, at: 0.00 }, // the source (always present)
  { y: 0.86, s: 0.68, rot: 1.2, at: 0.14 },
  { y: 1.16, s: 0.52, rot: 2.5, at: 0.26 },
  { y: 1.40, s: 0.40, rot: 0.7, at: 0.38 },
  { y: 1.58, s: 0.30, rot: 1.9, at: 0.50 },
];
const RISE_WIN = 0.16; // how much scroll a stone takes to rise and settle
const RISE_FROM = -0.35; // stones emerge from just under the surface

// camera journey keyframes across whole-page progress.
// A crane, not a dolly: distance stays close (~3.2) so the pale stones keep their
// form and read against their own shadows; the camera simply rises with the cairn,
// then tilts up at the end to open the dawn horizon.
const CAM = [
  { p: 0.00, pos: [0.00, 0.62, 3.30], look: [0.12, 0.42,  0.0] }, // hero — close on the source
  { p: 0.16, pos: [0.00, 0.86, 3.80], look: [0.00, 0.78,  0.0] }, // ease back, room to stack
  { p: 0.50, pos: [0.00, 1.10, 4.05], look: [0.00, 1.00,  0.0] }, // the stack grows, framed
  { p: 0.70, pos: [0.00, 1.26, 4.20], look: [0.00, 1.08,  0.0] }, // cairn complete
  { p: 0.86, pos: [0.00, 1.74, 4.05], look: [0.00, 1.45, -2.2] }, // begin the lift
  { p: 1.00, pos: [0.00, 2.20, 3.85], look: [0.00, 1.95, -7.5] }, // dawn horizon opens
];

function sampleCam(p, outPos, outLook) {
  let i = 0;
  while (i < CAM.length - 1 && p > CAM[i + 1].p) i++;
  const a = CAM[i], b = CAM[Math.min(i + 1, CAM.length - 1)];
  const t = smooth(a.p, b.p, p);
  outPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
  outLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
}

export function createSource({ canvas, tier = "A", reducedMotion = false }) {
  const low = tier === "B";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5));
  renderer.setClearColor(PLASTER, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fogColorNear = new THREE.Color(PLASTER);
  const fogColorFar = new THREE.Color(0xf3e6cf); // warm dawn air at the finale
  scene.fog = new THREE.FogExp2(PLASTER, 0.17);
  scene.environment = warmEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  sampleCam(0, camPos, camLook);
  camera.position.copy(camPos);

  // ---- lights ----
  const key = new THREE.DirectionalLight(0xfff0da, 2.3);
  key.position.set(-3.2, 2.6, 1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
  key.shadow.camera.left = key.shadow.camera.bottom = -3.5;
  key.shadow.camera.right = key.shadow.camera.top = 3.5;
  key.shadow.bias = -0.0008; key.shadow.radius = low ? 4 : 8;
  scene.add(key);
  const hemi = new THREE.HemisphereLight(0xfff0dd, 0x6f7a63, 0.42);
  scene.add(hemi);

  // ---- shared pebble geometry ----
  const geo = new THREE.IcosahedronGeometry(0.52, low ? 16 : 40);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const d = 1 + 0.16 * fbm(n.x * 1.6 + 5, n.y * 1.6, n.z * 1.6) + 0.05 * fbm(n.x * 4, n.y * 4, n.z * 4 + 2);
    v.copy(n).multiplyScalar(0.52 * d);
    v.y *= 0.82; // settle it
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: 0xe7ddce, roughness: 0.6, metalness: 0.0,
    clearcoat: 0.28, clearcoatRoughness: 0.55, envMapIntensity: 0.85,
    emissive: 0x6b3d1f, emissiveIntensity: 0.07,
  });

  // build the cairn
  const stones = CAIRN.map((cfg, i) => {
    const m = new THREE.Mesh(geo, stoneMat);
    m.castShadow = true; m.receiveShadow = i > 0;
    m.rotation.y = cfg.rot;
    m.position.set((i % 2 ? 0.05 : -0.04) * (i > 0 ? 1 : 0), cfg.y, (i % 3 - 1) * 0.03 * (i > 0 ? 1 : 0));
    scene.add(m);
    return { mesh: m, cfg };
  });
  const source = stones[0].mesh; // the base stone touches the water

  // mirror-clone reflection of the source (cheap sheen on the water)
  const reflMat = stoneMat.clone();
  reflMat.emissiveIntensity = 0.04; reflMat.envMapIntensity = 0.4; reflMat.color = new THREE.Color(0xb8ad9c);
  const refl = new THREE.Mesh(geo, reflMat);
  refl.scale.y = -1;
  scene.add(refl);

  // ---- water ----
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x49543f, roughness: 0.13, metalness: 0.0, transparent: true, opacity: 0.86,
    clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.25,
  });
  const rn = rippleNormal(); waterMat.normalMap = rn; waterMat.normalScale = new THREE.Vector2(0.1, 0.1);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0; water.receiveShadow = true;
  scene.add(water);

  // ---- dawn sky backdrop (unlit; only reads once the camera lifts) ----
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 26),
    new THREE.MeshBasicMaterial({ map: skyTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false })
  );
  sky.position.set(0, 7.5, -16); // low half behind the water, upper half is sky
  scene.add(sky);

  // ---- glow behind the source (fakes bloom) ----
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(224,240,206,0.85)", "rgba(224,240,206,0)"),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(2.6, 2.6, 1); glow.position.set(0.05, 0.47, -0.3);
  scene.add(glow);

  // ---- motes ----
  const COUNT = low ? 130 : 300;
  const mgeo = new THREE.BufferGeometry();
  const mp = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    mp[i * 3] = (Math.random() - 0.5) * 4.6;
    mp[i * 3 + 1] = Math.random() * 3.0;
    mp[i * 3 + 2] = (Math.random() - 0.5) * 2.4 - 0.2;
    seed[i] = Math.random() * 100;
  }
  mgeo.setAttribute("position", new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({
    size: 0.03, map: radialTexture("rgba(255,240,220,1)", "rgba(255,240,220,0)"),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.7,
  }));
  scene.add(motes);

  // ---- interaction / state ----
  const pointer = new THREE.Vector2(0, 0);
  const pointerTarget = new THREE.Vector2(0, 0);
  let scrollP = 0, scrollEased = 0;
  function onPointer(e) {
    const t = e.touches ? e.touches[0] : e;
    pointerTarget.set((t.clientX / window.innerWidth - 0.5), (t.clientY / window.innerHeight - 0.5));
  }
  if (!low) window.addEventListener("pointermove", onPointer, { passive: true });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize); resize();

  const clock = new THREE.Clock();
  let running = false, raf = 0, tAcc = 0;
  const tmpFog = new THREE.Color();

  function frame(dt, elapsed) {
    // ease the scroll so wheel jumps feel like breath, not snaps
    scrollEased += (scrollP - scrollEased) * Math.min(1, dt * 3.2);
    const p = reducedMotion ? scrollP : scrollEased;

    // breath: one calm 11s cycle
    const b = 0.5 - 0.5 * Math.cos((elapsed / 11) * Math.PI * 2);

    // source stone breathes on the water
    const sy = CAIRN[0].y + b * 0.03;
    const ss = 1 + b * 0.012;
    source.position.y = sy; source.scale.setScalar(ss);
    refl.position.y = -sy; refl.scale.set(ss, -ss, ss);
    glow.position.y = sy + 0.05;
    glow.material.opacity = (0.55 + b * 0.2) * (1 - 0.5 * smooth(0.6, 1.0, p));
    glow.scale.setScalar(2.5 + b * 0.15);
    key.intensity = 2.15 + b * 0.25;

    // stacked stones rise from the water as the page scrolls
    for (let i = 1; i < stones.length; i++) {
      const cfg = stones[i].cfg, m = stones[i].mesh;
      const t = smooth(cfg.at, cfg.at + RISE_WIN, p);
      const e = t * t * (3 - 2 * t); // settle easing
      m.visible = t > 0.001;
      m.position.y = lerp(RISE_FROM, cfg.y, e) + b * 0.02 * e;
      m.scale.setScalar(cfg.s * (0.18 + 0.82 * e) * (1 + b * 0.01));
    }

    // water shimmer
    rn.offset.x = elapsed * 0.006; rn.offset.y = elapsed * 0.004;

    // fog thins early so the rising cairn reads, then the air warms toward dawn
    scene.fog.density = lerp(0.17, 0.05, smooth(0.12, 0.68, p));
    tmpFog.copy(fogColorNear).lerp(fogColorFar, smooth(0.55, 1.0, p));
    scene.fog.color.copy(tmpFog);
    renderer.setClearColor(tmpFog, 1);

    // dawn sky fades in with the horizon lift
    sky.material.opacity = smooth(0.62, 0.98, p);

    // motes drift
    const a = mgeo.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      let py = a.array[i * 3 + 1] + dt * 0.045;
      a.array[i * 3] += Math.sin(elapsed * 0.25 + seed[i]) * 0.0008;
      if (py > 3.1) { py = -0.1; a.array[i * 3] = (Math.random() - 0.5) * 4.6; }
      a.array[i * 3 + 1] = py;
    }
    a.needsUpdate = true;

    // camera : follow the journey + gentle pointer parallax
    sampleCam(p, camPos, camLook);
    pointer.lerp(pointerTarget, 0.05);
    camera.position.set(
      camPos.x + pointer.x * 0.26,
      camPos.y - pointer.y * 0.12,
      camPos.z
    );
    camera.lookAt(camLook.x, camLook.y, camLook.z);

    renderer.render(scene, camera);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    tAcc += dt;
    if (low && tAcc < 1 / 32) return; // ~30fps cap on tier B
    const step = low ? tAcc : dt; tAcc = 0;
    frame(step, clock.elapsedTime);
  }

  const api = {
    setScroll(p) { scrollP = clamp01(p); },
    start() { if (running || reducedMotion) return; running = true; clock.start(); loop(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    renderStill() { scrollEased = scrollP; frame(0.016, 4.2); }, // one nice frame for reduced-motion
    destroy() {
      this.stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); } });
      rn.dispose(); scene.environment && scene.environment.dispose(); renderer.dispose();
    },
  };

  if (reducedMotion) { api.renderStill(); } else { api.start(); }
  try { if (new URLSearchParams(location.search).get("src3d")) window.__source = api; } catch (e) {}
  return api;
}
