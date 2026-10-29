import * as THREE from "three";
import {
  aimYawPitch,
  flightSpeed,
  headingText,
  overlookState,
  stepFlight,
  type FlightInput,
  type FlightState,
} from "./flight";
import { buildProps } from "./props";
import { describeSpot, generateWorld, WATER_Y, X0, X1, Z0, Z1, MARK, LINES, type WorldData } from "./world";
import { makeMistUniforms, makeSky, patchMist, softDot, SUN_DIR } from "./atmosphere";
import { Effects } from "./fx";
import { FieldAudio } from "./audio";
import { makePlane } from "./plane";
import { ZeroHour, clockAt, type Caption } from "./zerohour";

export type Phase = "menu" | "fly" | "pause" | "cinema";
export type View = "chase" | "cockpit";
/** 2 best, 1 balanced, 0 fast. */
export type Quality = 0 | 1 | 2;

export type Hooks = {
  syncWire: (v: boolean) => void;
  syncNight: (v: boolean) => void;
  onPoi: (id: string) => void;
  onCaption: (c: Caption) => void;
  onClock: (text: string, progress: number) => void;
  onZeroEnd: () => void;
  onQuality: (q: Quality, auto: boolean) => void;
};

export type MountOpts = {
  canvas: HTMLCanvasElement;
  map: HTMLCanvasElement;
  plot: HTMLCanvasElement;
  hud: {
    alt: HTMLElement | null;
    spd: HTMLElement | null;
    hdg: HTMLElement | null;
    place: HTMLElement | null;
    blurb: HTMLElement | null;
  };
  hooks: { readonly current: Hooks };
  input: { joyX: number; joyY: number; rise: number; lookDx: number; lookDy: number };
  quality: Quality;
};

export type SommeApi = {
  setPhase: (p: Phase) => void;
  setWireframe: (v: boolean) => void;
  setNight: (v: boolean) => void;
  setView: (v: View) => void;
  setMuted: (v: boolean) => void;
  setQuality: (q: Quality | "auto") => void;
  startAudio: () => void;
  beginOverlook: () => void;
  flyTo: (x: number, z: number) => void;
  startZeroHour: () => void;
  stopZeroHour: () => void;
  takeControls: () => void;
  dispose: () => void;
};

const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
  "Space", "KeyC", "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "KeyF", "KeyN", "KeyR", "KeyV",
]);

function toSrgb(u: number) {
  return u <= 0.0031308 ? u * 12.92 : 1.055 * u ** (1 / 2.4) - 0.055;
}

function paintMap(canvas: HTMLCanvasElement, world: WorldData) {
  const w = world.cols;
  const h = world.rows;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cols = world.colors;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = Math.round(toSrgb(cols[i * 3]) * 255);
    data[o + 1] = Math.round(toSrgb(cols[i * 3 + 1]) * 255);
    data[o + 2] = Math.round(toSrgb(cols[i * 3 + 2]) * 255);
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of world.polylines) {
    ctx.strokeStyle = line.side === "german" ? "rgba(120, 50, 36, 0.95)" : "rgba(40, 52, 96, 0.9)";
    ctx.lineWidth = line.role === "front" ? 2.4 : line.role === "comm" || line.role === "sap" ? 1 : 1.4;
    ctx.beginPath();
    line.points.forEach((p, i) => {
      const sx = ((p.x - X0) / (X1 - X0)) * w;
      const sy = ((p.z - Z0) / (Z1 - Z0)) * h;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }
  ctx.fillStyle = "#1c1a14";
  for (const p of world.pois) {
    if (!p.sprite) continue;
    const sx = ((p.x - X0) / (X1 - X0)) * w;
    const sy = ((p.z - Z0) / (Z1 - Z0)) * h;
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  ctx.fillStyle = "#1c1a14";
  ctx.font = "bold 18px Georgia, serif";
  ctx.fillText("N", w * 0.5 - 6, 20);
}

function makeLabel(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = "rgba(20, 22, 16, 0.8)";
  g.beginPath();
  g.roundRect(16, 28, 480, 72, 10);
  g.fill();
  g.strokeStyle = "rgba(201, 165, 90, 0.95)";
  g.lineWidth = 4;
  g.stroke();
  g.font = "600 40px Georgia, serif";
  g.fillStyle = "#f4ead8";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(18, 4.5, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 8;
  return { sprite, mat, tex };
}

const DAY = {
  hemiSky: "#d4e2ee",
  hemiGround: "#7d6443",
  hemi: 0.72,
  sun: "#ffdca3",
  sunI: 3.1,
  amb: "#f3e6cc",
  ambI: 0.06,
  fog: "#dccdaa",
  fogNear: 190,
  fogFar: 900,
  mist: "#e8dcc0",
  water: "#6f9ea4",
  zenith: "#4c7db4",
  horizon: "#ecd3a3",
  sunCol: "#ffd99a",
};
const NIGHT = {
  hemiSky: "#2c3e5c",
  hemiGround: "#1b150f",
  hemi: 0.42,
  sun: "#b9c7e8",
  sunI: 0.55,
  amb: "#1d2738",
  ambI: 0.12,
  fog: "#121620",
  fogNear: 40,
  fogFar: 320,
  mist: "#1e2533",
  water: "#17343c",
  zenith: "#05070f",
  horizon: "#1a2030",
  sunCol: "#9fb4e0",
};

export function mountSomme(opts: MountOpts): SommeApi {
  const { canvas, map, plot, hud, hooks, input } = opts;
  const world = generateWorld();
  const sample = world.sample;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  if (!renderer.getContext()) throw new Error("WebGL is not available on this device.");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1200);
  scene.add(camera);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const disposables: { dispose: () => void }[] = [];
  const mist = makeMistUniforms();

  const vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mats.push(vertexMat);

  const positions = new Float32Array(world.cols * world.rows * 3);
  for (let iz = 0; iz < world.rows; iz++) {
    for (let ix = 0; ix < world.cols; ix++) {
      const i = iz * world.cols + ix;
      const o = i * 3;
      positions[o] = X0 + (ix * (X1 - X0)) / (world.cols - 1);
      positions[o + 1] = world.heights[i];
      positions[o + 2] = Z0 + (iz * (Z1 - Z0)) / (world.rows - 1);
    }
  }
  const indices = new Uint32Array((world.cols - 1) * (world.rows - 1) * 6);
  let p = 0;
  for (let z = 0; z < world.rows - 1; z++) {
    for (let x = 0; x < world.cols - 1; x++) {
      const a = z * world.cols + x;
      const b = a + 1;
      const c = a + world.cols;
      const d = c + 1;
      indices[p++] = a;
      indices[p++] = c;
      indices[p++] = b;
      indices[p++] = b;
      indices[p++] = c;
      indices[p++] = d;
    }
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(world.colors, 3));
  terrainGeo.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
  terrainGeo.computeVertexNormals();
  geos.push(terrainGeo);
  const terrain = new THREE.Mesh(terrainGeo, vertexMat);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);

  // A skirt of plain farmland out to the horizon so the edge of the sector never shows.
  const skirtGeo = new THREE.RingGeometry(270, 1100, 64, 1);
  skirtGeo.rotateX(-Math.PI / 2);
  geos.push(skirtGeo);
  const skirtMat = new THREE.MeshLambertMaterial({ color: "#8f8a52" });
  mats.push(skirtMat);
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.set(0, -0.05, 15);
  skirt.receiveShadow = true;
  scene.add(skirt);

  const waterMat = new THREE.MeshLambertMaterial({ color: DAY.water, transparent: true, opacity: 0.7, depthWrite: false });
  mats.push(waterMat);
  const waterGeo = new THREE.PlaneGeometry(X1 - X0 + 80, Z1 - Z0 + 80, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  geos.push(waterGeo);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, WATER_Y, (Z0 + Z1) / 2);
  water.receiveShadow = true;
  scene.add(water);

  const props = buildProps(world, vertexMat, geos, mats);
  props.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(props.group);

  const sky = makeSky(800);
  geos.push(sky.geo);
  mats.push(sky.mat);
  scene.add(sky.mesh);

  const starPositions = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const r = 700;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  geos.push(starGeo);
  const starMat = new THREE.PointsMaterial({ color: "#f4ead8", size: 1.7, sizeAttenuation: false, fog: false, depthWrite: false });
  mats.push(starMat);
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.visible = false;
  scene.add(stars);

  const glareMat = new THREE.SpriteMaterial({ map: softDot(), color: "#ffd38a", transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0 });
  mats.push(glareMat);
  const glare = new THREE.Sprite(glareMat);
  glare.scale.setScalar(260);
  glare.renderOrder = 9;
  glare.frustumCulled = false;
  scene.add(glare);
  const camDir = new THREE.Vector3();

  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
  const sunLight = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sunLight.castShadow = true;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.5;
  const sc = sunLight.shadow.camera as THREE.OrthographicCamera;
  sc.near = 1;
  sc.far = 700;
  scene.add(sunLight.target);
  const amb = new THREE.AmbientLight(DAY.amb, DAY.ambI);
  scene.add(hemi, sunLight, amb);

  const fogColor = new THREE.Color(DAY.fog);
  scene.fog = new THREE.Fog(fogColor, DAY.fogNear, DAY.fogFar);

  const audio = new FieldAudio();
  const fx = new Effects(scene, sample, audio, fogColor, camera);
  disposables.push(fx);

  const planeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mats.push(planeMat);
  const plane = makePlane(planeMat);
  geos.push(...plane.geos);
  mats.push(...plane.mats);
  plane.root.scale.setScalar(0.9);
  scene.add(plane.root);

  const zh = new ZeroHour(scene, sample, vertexMat, fx, audio);
  disposables.push(zh);
  zh.onCaption = (c) => hooks.current.onCaption(c);
  zh.onEnd = () => hooks.current.onZeroEnd();

  for (const m of mats) patchMist(m, mist);

  const labels: { sprite: THREE.Sprite; x: number; z: number; mat: THREE.SpriteMaterial; tex: THREE.Texture }[] = [];
  for (const poi of world.pois) {
    if (!poi.sprite) continue;
    const made = makeLabel(poi.sprite);
    if (!made) continue;
    made.sprite.position.set(poi.x, sample(poi.x, poi.z) + 12, poi.z);
    scene.add(made.sprite);
    labels.push({ sprite: made.sprite, x: poi.x, z: poi.z, mat: made.mat, tex: made.tex });
    disposables.push(made.mat, made.tex);
  }

  paintMap(map, world);

  let phase: Phase = "menu";
  let view: View = "chase";
  let wire = false;
  let night = false;
  let quality: Quality = opts.quality;
  let autoQuality = true;
  const state: FlightState = overlookState();
  const keys = new Set<string>();
  let override: Set<string> | null = null;
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let dragId = -1;
  let lastPX = 0;
  let lastPY = 0;
  let clock = 0;
  let lastPlace = "";
  let lastBlurb = "";
  let lastPoi = "";
  let glide: { t: number; from: FlightState; to: FlightState } | null = null;
  let fov = 60;
  let bank = 0;
  let prevYaw = state.yaw;
  let cinemaDrive = true;
  const exhaustAt = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpL = new THREE.Vector3();
  let camInit = false;

  function applyQuality(q: Quality) {
    quality = q;
    const wantShadow = q > 0;
    const size = q === 2 ? 2048 : 1024;
    if (renderer.shadowMap.enabled !== wantShadow || sunLight.shadow.mapSize.x !== size) {
      renderer.shadowMap.enabled = wantShadow;
      sunLight.castShadow = wantShadow;
      sunLight.shadow.mapSize.set(size, size);
      sunLight.shadow.map?.dispose();
      sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      for (const m of mats) m.needsUpdate = true;
    }
    const half = q === 2 ? 120 : 95;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.updateProjectionMatrix();
    fx.quality = q === 0 ? 0.45 : q === 1 ? 0.75 : 1;
    fx.smoke.budget = fx.quality;
    resize();
    hooks.current.onQuality(q, autoQuality);
  }

  function paintSky(isNight: boolean) {
    const P = isNight ? NIGHT : DAY;
    sky.uniforms.uZenith.value.set(P.zenith);
    sky.uniforms.uHorizon.value.set(P.horizon);
    sky.uniforms.uSunColor.value.set(P.sunCol);
    sky.uniforms.uGlow.value = isNight ? 0.25 : 1;
    sky.uniforms.uSun.value.copy(isNight ? new THREE.Vector3(-0.4, 0.5, -0.6).normalize() : SUN_DIR);
  }

  function placeLabels() {
    for (const label of labels) {
      const d = Math.hypot(label.x - camera.position.x, label.z - camera.position.z);
      label.sprite.visible = phase !== "cinema" && d > 34 && d < 560;
      const k = Math.min(3.2, Math.max(1, d / 85));
      label.sprite.scale.set(18 * k, 4.5 * k, 1);
    }
  }

  function updateHud() {
    const g = sample(state.x, state.z);
    const agl = Math.max(0, state.y - g);
    if (hud.alt) hud.alt.textContent = String(Math.round(agl));
    if (hud.spd) hud.spd.textContent = String(Math.round(flightSpeed(state)));
    if (hud.hdg) hud.hdg.textContent = headingText(state.yaw);
    let dep = 0;
    dep = Math.max(dep, sample(state.x + 7, state.z) - g);
    dep = Math.max(dep, sample(state.x - 7, state.z) - g);
    dep = Math.max(dep, sample(state.x, state.z + 7) - g);
    dep = Math.max(dep, sample(state.x, state.z - 7) - g);
    const spot = describeSpot(state.x, state.z, g, agl, dep);
    if (hud.place && spot.title !== lastPlace) {
      hud.place.textContent = spot.title;
      lastPlace = spot.title;
    }
    if (spot.id && spot.id !== lastPoi) {
      lastPoi = spot.id;
      hooks.current.onPoi(spot.id);
    } else if (!spot.id) lastPoi = "";
    if (hud.blurb && spot.blurb !== lastBlurb) {
      hud.blurb.textContent = spot.blurb;
      lastBlurb = spot.blurb;
    }
  }

  function paintPlot() {
    if (plot.width !== map.width || plot.height !== map.height) {
      plot.width = map.width;
      plot.height = map.height;
    }
    const ctx = plot.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, plot.width, plot.height);
    const px = phase === "cinema" && cinemaDrive ? camera.position.x : state.x;
    const pz = phase === "cinema" && cinemaDrive ? camera.position.z : state.z;
    const yaw = phase === "cinema" && cinemaDrive ? Math.atan2(-(camLook.x - px), -(camLook.z - pz)) : state.yaw;
    const sx = ((px - X0) / (X1 - X0)) * plot.width;
    const sy = ((pz - Z0) / (Z1 - Z0)) * plot.height;
    const fx2 = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    ctx.fillStyle = "#b8281e";
    ctx.strokeStyle = "#fff6e0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + fx2 * 11, sy + fz * 11);
    ctx.lineTo(sx - fx2 * 6 + rx * 6, sy - fz * 6 + rz * 6);
    ctx.lineTo(sx - fx2 * 6 - rx * 6, sy - fz * 6 - rz * 6);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const cap = quality === 2 ? 1.35 : quality === 1 ? 1.1 : 0.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    framing(w, h);
  }

  let framedFor = "";
  function framing(w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight) {
    const key = `${phase === "cinema" && cinemaDrive}:${w}x${h}`;
    if (key === framedFor) return;
    framedFor = key;
    if (phase === "cinema" && cinemaDrive) camera.setViewOffset(w, h, 0, h * 0.13, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function held(code: string) {
    if (override) return override.has(code);
    return keys.has(code);
  }

  function readInput(): FlightInput {
    let thrust = 0;
    if (held("KeyW") || held("ArrowUp")) thrust += 1;
    if (held("KeyS") || held("ArrowDown")) thrust -= 1;
    let strafe = 0;
    if (held("KeyD") || held("ArrowRight")) strafe += 1;
    if (held("KeyA") || held("ArrowLeft")) strafe -= 1;
    thrust = Math.max(-1, Math.min(1, thrust + input.joyY));
    strafe = Math.max(-1, Math.min(1, strafe + input.joyX));
    let lift = 0;
    if (held("Space")) lift += 1;
    if (held("KeyC") || held("ControlLeft") || held("ControlRight")) lift -= 1;
    lift = Math.max(-1, Math.min(1, lift + input.rise));
    const lookDx = lookX + input.lookDx;
    const lookDy = lookY + input.lookDy;
    lookX = 0;
    lookY = 0;
    input.lookDx = 0;
    input.lookDy = 0;
    return { thrust, strafe, lift, boost: held("ShiftLeft") || held("ShiftRight"), lookDx, lookDy };
  }

  function setWireframe(v: boolean) {
    wire = v;
    for (const m of mats) {
      const mat = m as THREE.MeshLambertMaterial;
      if (typeof mat.wireframe === "boolean" && mat.fog !== false && !(m as THREE.ShaderMaterial).isShaderMaterial) mat.wireframe = v;
    }
  }

  function setNight(v: boolean) {
    night = v;
    const P = v ? NIGHT : DAY;
    hemi.color.set(P.hemiSky);
    hemi.groundColor.set(P.hemiGround);
    hemi.intensity = P.hemi;
    sunLight.color.set(P.sun);
    sunLight.intensity = P.sunI;
    amb.color.set(P.amb);
    amb.intensity = P.ambI;
    const fog = scene.fog as THREE.Fog;
    fog.color.set(P.fog);
    fogColor.set(P.fog);
    fog.near = P.fogNear;
    fog.far = P.fogFar;
    mist.uMistColor.value.set(P.mist);
    waterMat.color.set(P.water);
    skirtMat.color.set(v ? "#23261d" : "#8f8a52");
    stars.visible = v;
    if (props.night.lantern) props.night.lantern.emissiveIntensity = v ? 1.55 : 0.05;
    if (props.night.windows) props.night.windows.emissiveIntensity = v ? 1.35 : 0;
    if (props.night.gold) props.night.gold.emissiveIntensity = v ? 0.55 : 0.28;
    for (const pm of [fx.smoke.mat, fx.glow.mat]) {
      pm.uniforms.uFogNear.value = P.fogNear;
      pm.uniforms.uFogFar.value = P.fogFar;
    }
    paintSky(v);
  }

  function beginOverlook() {
    const o = overlookState();
    Object.assign(state, o);
    glide = null;
    camInit = false;
  }

  paintSky(false);
  applyQuality(quality);
  updateHud();

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "KeyF") {
      setWireframe(!wire);
      hooks.current.syncWire(wire);
    } else if (e.code === "KeyN") {
      setNight(!night);
      hooks.current.syncNight(night);
    } else if (e.code === "KeyR" && phase === "fly") {
      beginOverlook();
    } else if (e.code === "KeyV") {
      api.setView(view === "chase" ? "cockpit" : "chase");
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const onBlur = () => {
    keys.clear();
    dragging = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (phase !== "fly" || e.button !== 0) return;
    dragging = true;
    dragId = e.pointerId;
    lastPX = e.clientX;
    lastPY = e.clientY;
    if (e.pointerType !== "touch") canvas.requestPointerLock?.();
    else canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (document.pointerLockElement === canvas) {
      lookX += e.movementX;
      lookY += e.movementY;
      return;
    }
    if (!dragging || e.pointerId !== dragId) return;
    lookX += e.clientX - lastPX;
    lookY += e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === dragId) dragging = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  // Plane pose and the camera that follows it.
  const fwd = new THREE.Vector3();
  const qPlane = new THREE.Quaternion();
  const ePlane = new THREE.Euler(0, 0, 0, "YXZ");

  function posePlane(x: number, y: number, z: number, yaw: number, pitch: number, roll: number) {
    plane.root.position.set(x, y, z);
    ePlane.set(pitch, yaw, roll, "YXZ");
    qPlane.setFromEuler(ePlane);
    plane.root.quaternion.copy(qPlane);
  }

  function chaseCamera(dt: number, snap: boolean) {
    const cp = Math.cos(state.pitch);
    fwd.set(-Math.sin(state.yaw) * cp, Math.sin(state.pitch), -Math.cos(state.yaw) * cp);
    tmpV.set(state.x, state.y, state.z).addScaledVector(fwd, -13).add(tmpL.set(0, 3.6, 0));
    const g = sample(tmpV.x, tmpV.z);
    if (tmpV.y < g + 2) tmpV.y = g + 2;
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    camPos.lerp(tmpV, k);
    tmpL.set(state.x, state.y, state.z).addScaledVector(fwd, 10);
    camLook.lerp(tmpL, snap ? 1 : 1 - Math.exp(-dt * 9));
  }

  // Automatic quality: measure, then step down once if frames run long.
  let qWindow = 0;
  let qFrames = 0;
  let qSettle = 3;

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    clock += dt;

    if (autoQuality && phase !== "pause") {
      qSettle -= rawDt;
      if (qSettle < 0) {
        qWindow += rawDt;
        qFrames++;
        if (qWindow > 2.5) {
          const avg = qWindow / qFrames;
          if (avg > 0.034 && quality > 0) {
            applyQuality((quality - 1) as Quality);
            qSettle = 2;
          }
          qWindow = 0;
          qFrames = 0;
        }
      }
    }

    let showPlane = true;
    if (phase === "menu") {
      const ang = clock * 0.08;
      camPos.set(Math.sin(ang) * 40, 34 + Math.sin(clock * 0.3) * 2, 96);
      const g = sample(camPos.x, camPos.z);
      if (camPos.y < g + 12) camPos.y = g + 12;
      camLook.set(10, 2, -30);
      const pa = clock * 0.22;
      const px = 20 + Math.sin(pa) * 70;
      const pz = -10 + Math.cos(pa) * 55;
      posePlane(px, 46, pz, pa + Math.PI / 2, 0, -0.32);
      fx.barrage(dt, 0.7, LINES.germanFront, 16);
      fx.batteries(dt, 0.6);
      fx.drift(dt, 0.8);
      camInit = false;
    } else if (phase === "cinema" || (zh.running && !cinemaDrive && phase === "fly") || phase === "fly" || phase === "pause") {
      if (phase === "cinema" && cinemaDrive) {
        zh.update(dt);
        zh.shot();
        const k = camInit ? 1 - Math.exp(-dt * 2.5) : 1;
        camPos.lerp(zh.eye, k);
        camLook.lerp(zh.look, k);
        camInit = true;
        // Cecil Lewis's Morane circles La Boisselle on contact patrol.
        const pa = zh.t * 0.16;
        const px = MARK.lochnagar.x + Math.sin(pa) * 62;
        const pz = MARK.lochnagar.z + 30 + Math.cos(pa) * 46;
        posePlane(px, 62, pz, pa + Math.PI / 2, 0, -0.38);
        state.x = camPos.x;
        state.y = camPos.y;
        state.z = camPos.z;
      } else if (phase === "fly" || phase === "cinema") {
        if (zh.running) zh.update(dt);
        else {
          fx.barrage(dt, 1.1, LINES.germanFront, 16);
          fx.batteries(dt, 0.9);
          fx.drift(dt, 1);
        }
        if (glide) {
          glide.t = Math.min(1, glide.t + dt / 1.6);
          const e = glide.t < 0.5 ? 4 * glide.t ** 3 : 1 - (-2 * glide.t + 2) ** 3 / 2;
          const f = glide.from;
          const to = glide.to;
          const hop = Math.sin(Math.PI * glide.t) * 40;
          state.x = f.x + (to.x - f.x) * e;
          state.z = f.z + (to.z - f.z) * e;
          state.y = Math.max(f.y + (to.y - f.y) * e + hop, sample(state.x, state.z) + 6);
          let dy = to.yaw - f.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          state.yaw = f.yaw + dy * e;
          state.pitch = f.pitch + (to.pitch - f.pitch) * e;
          state.vx = state.vy = state.vz = 0;
          readInput();
          if (glide.t >= 1) glide = null;
        } else {
          const flightInput = readInput();
          stepFlight(state, flightInput, dt, sample);
          if (view === "chase") {
            const g = sample(state.x, state.z);
            if (state.y < g + 3.5) {
              state.y = g + 3.5;
              if (state.vy < 0) state.vy = 0;
            }
          }
          const targetFov = flightInput.boost ? 68 : 60;
          fov += (targetFov - fov) * (1 - Math.exp(-dt * 4));
          if (Math.abs(camera.fov - fov) > 0.05) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
          }
          const yawRate = Math.atan2(Math.sin(state.yaw - prevYaw), Math.cos(state.yaw - prevYaw)) / Math.max(dt, 1e-3);
          const strafe = flightInput.strafe;
          const target = Math.max(-0.75, Math.min(0.75, yawRate * 0.35 - strafe * 0.35));
          bank += (target - bank) * (1 - Math.exp(-dt * 4));
        }
        prevYaw = state.yaw;
        if (view === "chase") {
          posePlane(state.x, state.y, state.z, state.yaw, state.pitch * 0.85, bank);
          chaseCamera(dt, !camInit);
          camInit = true;
        } else {
          showPlane = false;
          camPos.set(state.x, state.y, state.z);
          const cp = Math.cos(state.pitch);
          camLook.set(state.x - Math.sin(state.yaw) * cp, state.y + Math.sin(state.pitch), state.z - Math.cos(state.yaw) * cp);
          camInit = false;
        }
      } else {
        // Paused: everything holds still.
        readInput();
        showPlane = view === "chase" || (zh.running && cinemaDrive);
      }
      updateHud();
    }

    plane.root.visible = showPlane;
    framing();
    if (showPlane && phase !== "pause") {
      exhaustAt.set(0, -0.55, -1.0);
      plane.root.localToWorld(exhaustAt);
      fx.exhaust(dt, exhaustAt.x, exhaustAt.y, exhaustAt.z);
    }
    plane.prop.rotation.z += dt * 55;

    if (phase !== "pause") fx.update(dt);
    camera.position.copy(camPos);
    if (fx.shake > 0.01) {
      const s = fx.shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);

    // The shadow box follows the patch of ground the camera is looking at.
    if (renderer.shadowMap.enabled) {
      tmpV.copy(camLook).sub(camPos).setY(0);
      const len = tmpV.length();
      if (len > 1e-3) tmpV.multiplyScalar(Math.min(60, 40) / len);
      const cx = camPos.x + tmpV.x;
      const cz = camPos.z + tmpV.z;
      const texel = (sc.right - sc.left) / sunLight.shadow.mapSize.x;
      const snx = Math.round(cx / texel) * texel;
      const snz = Math.round(cz / texel) * texel;
      const gy = sample(snx, snz);
      sunLight.target.position.set(snx, gy, snz);
      sunLight.position.set(snx + SUN_DIR.x * 300, gy + SUN_DIR.y * 300, snz + SUN_DIR.z * 300);
      sunLight.target.updateMatrixWorld();
    }

    mist.uMist.value = night ? 0.4 : zh.running ? Math.max(0.12, 0.55 - zh.t * 0.004) : 0.32;
    water.position.y = WATER_Y + Math.sin(clock * 0.8) * 0.05;
    sky.mesh.position.copy(camera.position);
    camera.getWorldDirection(camDir);
    const facing = Math.max(0, camDir.dot(SUN_DIR));
    glare.position.copy(camera.position).addScaledVector(SUN_DIR, 640);
    glareMat.opacity = night || wire ? 0 : facing ** 10 * 0.55;
    stars.position.copy(camera.position);
    if (phase === "cinema" || zh.running) hooks.current.onClock(clockAt(zh.t), Math.min(1, zh.t / 150));
    audio.setEngine(phase === "fly" || phase === "cinema", flightSpeed(state));

    placeLabels();
    paintPlot();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const api: SommeApi = {
    setPhase: (p) => {
      phase = p;
      if (p === "pause") audio.suspend();
      else audio.resume();
    },
    setWireframe,
    setNight,
    setView: (v) => {
      view = v;
      camInit = false;
    },
    setMuted: (v) => audio.setMuted(v),
    setQuality: (q) => {
      if (q === "auto") {
        autoQuality = true;
        qSettle = 2;
        applyQuality(2);
      } else {
        autoQuality = false;
        applyQuality(q);
      }
    },
    startAudio: () => audio.start(),
    beginOverlook,
    flyTo: (tx, tz) => {
      const back = 13;
      const ex = tx;
      const ez = tz + (tz > -200 ? back : -back);
      const ey = Math.max(sample(ex, ez), sample(tx, tz)) + 24;
      const aim = aimYawPitch(tx - ex, sample(tx, tz) + 2 - ey, tz - ez);
      glide = { t: 0, from: { ...state }, to: { x: ex, y: ey, z: ez, yaw: aim.yaw, pitch: aim.pitch, vx: 0, vy: 0, vz: 0 } };
    },
    startZeroHour: () => {
      cinemaDrive = true;
      camInit = false;
      zh.start();
      phase = "cinema";
    },
    stopZeroHour: () => {
      zh.stop();
      cinemaDrive = true;
    },
    takeControls: () => {
      // Hand the flight over from wherever the camera is, pointed where it was looking.
      cinemaDrive = false;
      const aim = aimYawPitch(camLook.x - camPos.x, camLook.y - camPos.y, camLook.z - camPos.z);
      state.x = camPos.x;
      state.y = camPos.y;
      state.z = camPos.z;
      state.yaw = aim.yaw;
      state.pitch = Math.max(-0.6, aim.pitch * 0.6);
      state.vx = state.vy = state.vz = 0;
      prevYaw = state.yaw;
      camInit = false;
      phase = "fly";
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      audio.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (window.__controlsTest) delete window.__controlsTest;
    },
  };

  window.__controlsTest = {
    getYaw: () => state.yaw,
    getSpeed: () => flightSpeed(state),
    getPosition: () => ({ x: state.x, y: state.y, z: state.z }),
    getQuality: () => quality,
    getZeroTime: () => zh.t,
    setZeroTime: (t: number) => {
      // Fast forward the simulation so soldiers and smoke are where they would be.
      let guard = 0;
      while (zh.t < t && zh.running && guard++ < 4000) {
        zh.update(0.05);
        fx.update(0.05);
      }
    },
    setPose: (x: number, y: number, z: number, yaw: number, pitch: number) => {
      Object.assign(state, { x, y, z, yaw, pitch, vx: 0, vy: 0, vz: 0 });
      prevYaw = yaw;
      camInit = false;
    },
    setKeys: (codes: string[]) => {
      override = new Set(codes);
    },
    reset: () => {
      phase = "fly";
      Object.assign(state, { x: 0, y: 60, z: 40, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 });
    },
  };

  return api;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPosition: () => { x: number; y: number; z: number };
      getQuality: () => number;
      getZeroTime: () => number;
      setZeroTime: (t: number) => void;
      setPose: (x: number, y: number, z: number, yaw: number, pitch: number) => void;
      setKeys: (codes: string[]) => void;
      reset: () => void;
    };
  }
}
