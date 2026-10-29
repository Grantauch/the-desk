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
import { describeSpot, generateWorld, WATER_Y, X0, X1, Z0, Z1, type WorldData } from "./world";

export type Phase = "menu" | "fly" | "pause";

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
  hooks: { readonly current: { syncWire: (v: boolean) => void; syncNight: (v: boolean) => void; onPoi: (id: string) => void } };
  input: { joyX: number; joyY: number; rise: number; lookDx: number; lookDy: number };
};

export type SommeApi = {
  setPhase: (p: Phase) => void;
  setWireframe: (v: boolean) => void;
  setNight: (v: boolean) => void;
  beginOverlook: () => void;
  flyTo: (x: number, z: number) => void;
  dispose: () => void;
};

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "KeyC",
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "KeyF",
  "KeyN",
  "KeyR",
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
    ctx.strokeStyle = line.side === "german" ? "rgba(92, 64, 42, 0.95)" : "rgba(244, 234, 216, 0.92)";
    ctx.lineWidth = line.role === "front" ? 2.2 : line.role === "comm" || line.role === "sap" ? 1 : 1.4;
    ctx.beginPath();
    line.points.forEach((p, i) => {
      const sx = ((p.x - X0) / (X1 - X0)) * w;
      const sy = ((p.z - Z0) / (Z1 - Z0)) * h;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }
  ctx.fillStyle = "#c6a15a";
  for (const p of world.pois) {
    if (!p.sprite) continue;
    const sx = ((p.x - X0) / (X1 - X0)) * w;
    const sy = ((p.z - Z0) / (Z1 - Z0)) * h;
    ctx.fillRect(sx - 1.6, sy - 1.6, 3.2, 3.2);
  }
  ctx.fillStyle = "#f4ead8";
  ctx.font = "18px Georgia, serif";
  ctx.fillText("N", w * 0.5 - 6, 20);
}

function makeLabel(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = "rgba(28, 25, 20, 0.78)";
  g.beginPath();
  g.roundRect(16, 28, 480, 72, 14);
  g.fill();
  g.strokeStyle = "rgba(198, 161, 90, 0.95)";
  g.lineWidth = 4;
  g.stroke();
  g.font = "600 40px Georgia, serif";
  g.fillStyle = "#f4ead8";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(18, 4.5, 1);
  sprite.center.set(0.5, 0);
  return { sprite, mat, tex };
}

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
  renderer.toneMappingExposure = 1.06;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.18, 900);
  camera.rotation.order = "YXZ";

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const disposables: { dispose: () => void }[] = [];

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
  scene.add(terrain);

  const waterMat = new THREE.MeshLambertMaterial({
    color: "#6ea0a6",
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  mats.push(waterMat);
  const waterGeo = new THREE.PlaneGeometry(X1 - X0 + 80, Z1 - Z0 + 80, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  geos.push(waterGeo);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, WATER_Y, (Z0 + Z1) / 2);
  scene.add(water);

  const props = buildProps(world, vertexMat, geos, mats);
  scene.add(props.group);

  const skyGeo = new THREE.SphereGeometry(720, 18, 12);
  geos.push(skyGeo);
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
  skyGeo.setAttribute("color", new THREE.BufferAttribute(skyColors, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false });
  mats.push(skyMat);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const starPositions = new Float32Array(280 * 3);
  for (let i = 0; i < 280; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const r = 560;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  geos.push(starGeo);
  const starMat = new THREE.PointsMaterial({
    color: "#f4ead8",
    size: 1.7,
    sizeAttenuation: false,
    fog: false,
    depthWrite: false,
  });
  mats.push(starMat);
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.visible = false;
  scene.add(stars);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(14, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#f3e2b0", fog: false, depthWrite: false }),
  );
  geos.push(sun.geometry);
  mats.push(sun.material);
  sun.frustumCulled = false;
  scene.add(sun);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 6, 5),
    new THREE.MeshBasicMaterial({ color: "#ffb15a", fog: false, depthWrite: false, transparent: true }),
  );
  geos.push(flash.geometry);
  mats.push(flash.material);
  flash.visible = false;
  flash.frustumCulled = false;
  scene.add(flash);

  const hemi = new THREE.HemisphereLight("#d7e4ee", "#6a5438", 0.82);
  const sunLight = new THREE.DirectionalLight("#fff1d6", 1.45);
  sunLight.position.set(120, 160, 80);
  const amb = new THREE.AmbientLight("#f3ead8", 0.22);
  scene.add(hemi, sunLight, amb);
  const sunDir = new THREE.Vector3(120, 160, 80).normalize();

  scene.fog = new THREE.Fog("#d5c7ae", 80, 520);

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
  let wire = false;
  let night = false;
  const state: FlightState = overlookState();
  const keys = new Set<string>();
  let override: Set<string> | null = null;
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let dragId = -1;
  let lastPX = 0;
  let lastPY = 0;
  let flashLife = 0;
  let flashWait = 2.4;
  let clock = 0;
  let lastPlace = "";
  let lastBlurb = "";
  let lastPoi = "";
  let glide: { t: number; from: FlightState; to: FlightState } | null = null;
  let fov = 62;

  const cTop = new THREE.Color();
  const cHor = new THREE.Color();
  const cMix = new THREE.Color();

  function paintSky(isNight: boolean) {
    cTop.set(isNight ? "#070814" : "#8eabbe");
    cHor.set(isNight ? "#141722" : "#d5c7ae");
    const pos = skyGeo.attributes.position;
    const col = skyGeo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 720;
      const k = Math.max(0, Math.min(1, y));
      cMix.copy(cHor).lerp(cTop, k ** 0.7);
      col.setXYZ(i, cMix.r, cMix.g, cMix.b);
    }
    col.needsUpdate = true;
  }

  function applyLook() {
    const g = sample(state.x, state.z);
    const agl = Math.max(0, state.y - g);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const sy = Math.sin(state.yaw);
    const cy = Math.cos(state.yaw);
    camera.position.set(state.x, state.y, state.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(state.x - sy * cp, state.y + sp, state.z - cy * cp);
    if (hud.alt) hud.alt.textContent = String(Math.round(agl));
    if (hud.spd) hud.spd.textContent = String(Math.round(flightSpeed(state)));
    if (hud.hdg) hud.hdg.textContent = headingText(state.yaw);
    let dep = 0;
    const h0 = g;
    dep = Math.max(dep, sample(state.x + 7, state.z) - h0);
    dep = Math.max(dep, sample(state.x - 7, state.z) - h0);
    dep = Math.max(dep, sample(state.x, state.z + 7) - h0);
    dep = Math.max(dep, sample(state.x, state.z - 7) - h0);
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
    for (const label of labels) {
      const d = Math.hypot(label.x - state.x, label.z - state.z);
      label.sprite.visible = d > 34 && d < 520;
      const k = Math.min(3.2, Math.max(1, d / 85));
      label.sprite.scale.set(18 * k, 4.5 * k, 1);
      label.sprite.position.y = sample(label.x, label.z) + 11;
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
    const sx = ((state.x - X0) / (X1 - X0)) * plot.width;
    const sy = ((state.z - Z0) / (Z1 - Z0)) * plot.height;
    const fx = -Math.sin(state.yaw);
    const fz = -Math.cos(state.yaw);
    const rx = Math.cos(state.yaw);
    const rz = -Math.sin(state.yaw);
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.moveTo(sx + fx * 9, sy + fz * 9);
    ctx.lineTo(sx - fx * 5 + rx * 5, sy - fz * 5 + rz * 5);
    ctx.lineTo(sx - fx * 5 - rx * 5, sy - fz * 5 - rz * 5);
    ctx.closePath();
    ctx.fill();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
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
    return {
      thrust,
      strafe,
      lift,
      boost: held("ShiftLeft") || held("ShiftRight"),
      lookDx,
      lookDy,
    };
  }

  function setWireframe(v: boolean) {
    wire = v;
    for (const m of mats) {
      const mat = m as THREE.MeshLambertMaterial;
      if (typeof mat.wireframe === "boolean" && mat.fog !== false) mat.wireframe = v;
    }
  }

  function setNight(v: boolean) {
    night = v;
    const fog = scene.fog as THREE.Fog;
    if (v) {
      hemi.color.set("#24344e");
      hemi.groundColor.set("#1a140e");
      hemi.intensity = 0.4;
      sunLight.color.set("#c5d0ea");
      sunLight.intensity = 0.5;
      amb.color.set("#1a2436");
      amb.intensity = 0.12;
      fog.color.set("#12151e");
      fog.near = 36;
      fog.far = 280;
      waterMat.color.set("#16343c");
      waterMat.opacity = 0.72;
      stars.visible = true;
      sun.visible = false;
      if (props.night.lantern) props.night.lantern.emissiveIntensity = 1.55;
      if (props.night.windows) props.night.windows.emissiveIntensity = 1.35;
      if (props.night.gold) props.night.gold.emissiveIntensity = 0.55;
    } else {
      hemi.color.set("#d7e4ee");
      hemi.groundColor.set("#6a5438");
      hemi.intensity = 0.82;
      sunLight.color.set("#fff1d6");
      sunLight.intensity = 1.45;
      amb.color.set("#f3ead8");
      amb.intensity = 0.22;
      fog.color.set("#d5c7ae");
      fog.near = 80;
      fog.far = 520;
      waterMat.color.set("#6ea0a6");
      waterMat.opacity = 0.62;
      stars.visible = false;
      sun.visible = true;
      if (props.night.lantern) props.night.lantern.emissiveIntensity = 0.05;
      if (props.night.windows) props.night.windows.emissiveIntensity = 0;
      if (props.night.gold) props.night.gold.emissiveIntensity = 0.28;
    }
    paintSky(v);
  }

  function beginOverlook() {
    const o = overlookState();
    state.x = o.x;
    state.y = o.y;
    state.z = o.z;
    state.yaw = o.yaw;
    state.pitch = o.pitch;
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
  }

  paintSky(false);
  resize();
  applyLook();

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "KeyF") {
      setWireframe(!wire);
      hooks.current.syncWire(wire);
    } else if (e.code === "KeyN") {
      setNight(!night);
      hooks.current.syncNight(night);
    } else if (e.code === "KeyR" && phase !== "menu") {
      beginOverlook();
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
    const dx = e.clientX - lastPX;
    const dy = e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
    lookX += dx;
    lookY += dy;
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

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (phase === "menu") {
      const ang = clock * 0.12;
      const x = Math.sin(ang) * 34;
      const z = 74;
      const y = 30 + Math.sin(clock * 0.35) * 1.6;
      const g = sample(x, z);
      state.x = x;
      state.z = z;
      state.y = Math.max(y, g + 12);
      const aim = aimYawPitch(6 - state.x, 4 - state.y, -16 - state.z);
      state.yaw = aim.yaw;
      state.pitch = aim.pitch;
      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
    } else if (phase === "fly" && glide) {
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
      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
      readInput();
      if (glide.t >= 1) glide = null;
    } else if (phase === "fly") {
      const flightInput = readInput();
      stepFlight(state, flightInput, dt, sample);
      const targetFov = flightInput.boost ? 70 : 62;
      fov += (targetFov - fov) * (1 - Math.exp(-dt * 4));
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    } else {
      readInput();
    }

    water.position.y = WATER_Y + Math.sin(clock * 0.8) * 0.05;
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 520);
    if (night) {
      flashWait -= dt;
      if (flashLife > 0) {
        flashLife -= dt;
        const k = Math.max(flashLife, 0) / 0.16;
        flash.scale.setScalar(0.6 + (1 - k) * 4);
        if (flashLife <= 0) flash.visible = false;
      } else if (flashWait <= 0) {
        flashWait = 1.8 + Math.random() * 3.2;
        flashLife = 0.16;
        const fx = -200 + Math.random() * 400;
        const fz = Math.random() > 0.5 ? 130 : -145;
        flash.position.set(fx, sample(fx, fz) + 3, fz);
        flash.visible = true;
      }
    } else if (flash.visible) {
      flash.visible = false;
    }

    applyLook();
    paintPlot();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const api: SommeApi = {
    setPhase: (p) => {
      phase = p;
    },
    setWireframe,
    setNight,
    beginOverlook,
    flyTo: (tx, tz) => {
      // Park just short of the site, inside its logging radius, looking down onto it.
      const back = 13;
      const ex = tx;
      const ez = tz + (tz > -200 ? back : -back);
      const ey = Math.max(sample(ex, ez), sample(tx, tz)) + 24;
      const aim = aimYawPitch(tx - ex, sample(tx, tz) + 2 - ey, tz - ez);
      glide = {
        t: 0,
        from: { ...state },
        to: { x: ex, y: ey, z: ez, yaw: aim.yaw, pitch: aim.pitch, vx: 0, vy: 0, vz: 0 },
      };
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
    setKeys: (codes: string[]) => {
      override = new Set(codes);
    },
    reset: () => {
      phase = "fly";
      state.x = 0;
      state.y = 60;
      state.z = 40;
      state.yaw = 0;
      state.pitch = 0;
      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
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
      setKeys: (codes: string[]) => void;
      reset: () => void;
    };
  }
}
