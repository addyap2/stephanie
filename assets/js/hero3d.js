// La Source — hero scene (calm-cinematic). Core three.js only, no addons.
import * as THREE from "../vendor/three.module.min.js";

const PLASTER = 0xedf1e8;

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
  scene.fog = new THREE.FogExp2(PLASTER, 0.24);
  scene.environment = warmEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0.0, 0.62, 3.3);
  camera.position.copy(camBase);
  const lookBase = new THREE.Vector3(0.12, 0.42, 0);

  // ---- lights ----
  const key = new THREE.DirectionalLight(0xfff0da, 2.3);
  key.position.set(-3.2, 2.6, 1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.bias = -0.0008; key.shadow.radius = low ? 4 : 8;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x6f7a63, 0.42));

  // ---- pebble ----
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
  const stone = new THREE.Mesh(geo, stoneMat);
  const restY = 0.42;
  stone.position.set(0, restY, 0);
  stone.castShadow = true;
  scene.add(stone);

  // mirror-clone reflection (cheap, breathes with the stone)
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
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0; water.receiveShadow = true;
  scene.add(water);

  // ---- glow behind the stone (fakes bloom) ----
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(224,240,206,0.85)", "rgba(224,240,206,0)"),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(2.6, 2.6, 1); glow.position.set(0.05, restY + 0.05, -0.3);
  scene.add(glow);

  // ---- motes ----
  const COUNT = low ? 130 : 300;
  const mgeo = new THREE.BufferGeometry();
  const mp = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    mp[i * 3] = (Math.random() - 0.5) * 4.2;
    mp[i * 3 + 1] = Math.random() * 2.4;
    mp[i * 3 + 2] = (Math.random() - 0.5) * 2.2 - 0.2;
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
  let scrollP = 0;
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

  function frame(dt, elapsed) {
    // breath: one calm 11s cycle
    const b = 0.5 - 0.5 * Math.cos((elapsed / 11) * Math.PI * 2);
    const y = restY + b * 0.03;
    const s = 1 + b * 0.012;
    stone.position.y = y; stone.scale.setScalar(s);
    refl.position.y = -y + 0.0; refl.scale.set(s, -s, s);
    glow.position.y = y + 0.05;
    glow.material.opacity = 0.55 + b * 0.2; glow.scale.setScalar(2.5 + b * 0.15);
    key.intensity = 2.15 + b * 0.25;

    // water shimmer
    rn.offset.x = elapsed * 0.006; rn.offset.y = elapsed * 0.004;

    // motes drift
    const a = mgeo.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      let py = a.array[i * 3 + 1] + dt * 0.045;
      const sx = Math.sin(elapsed * 0.25 + seed[i]) * 0.0008;
      a.array[i * 3] += sx;
      if (py > 2.5) { py = -0.1; a.array[i * 3] = (Math.random() - 0.5) * 4.2; }
      a.array[i * 3 + 1] = py;
    }
    a.needsUpdate = true;

    // scroll: gentle lift + dolly
    const zoff = scrollP * 0.5, yoff = scrollP * 0.28;
    pointer.lerp(pointerTarget, 0.05);
    camera.position.set(
      camBase.x + pointer.x * 0.28,
      camBase.y + yoff - pointer.y * 0.14,
      camBase.z + zoff
    );
    camera.lookAt(lookBase.x, lookBase.y + yoff * 0.6, lookBase.z);

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
    setScroll(p) { scrollP = Math.max(0, Math.min(1, p)); },
    start() { if (running || reducedMotion) return; running = true; clock.start(); loop(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    renderStill() { frame(0, 4.2); }, // one nice frame for reduced-motion
    destroy() {
      this.stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); } });
      rn.dispose(); scene.environment && scene.environment.dispose(); renderer.dispose();
    },
  };

  if (reducedMotion) { api.renderStill(); } else { api.start(); }
  return api;
}
