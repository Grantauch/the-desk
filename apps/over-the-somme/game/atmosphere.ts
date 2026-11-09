import * as THREE from "three";

/**
 * Morning light, valley mist and the sky dome.
 * Sun position: about 7:30 a.m. on 1 July in Picardy, low in the east north east.
 * World axes: +X east, -Z north, +Y up.
 */
export const SUN_DIR = new THREE.Vector3(0.875, 0.42, -0.235).normalize();

export type MistUniforms = {
  uMist: { value: number };
  uMistFloor: { value: number };
  uMistFall: { value: number };
  uMistColor: { value: THREE.Color };
};

export function makeMistUniforms(): MistUniforms {
  return {
    uMist: { value: 0.4 },
    uMistFloor: { value: 1.2 },
    uMistFall: { value: 0.62 },
    uMistColor: { value: new THREE.Color("#e9dcc0") },
  };
}

/** Adds low lying mist that pools in valleys and thickens with distance. */
export function patchMist(mat: THREE.Material, u: MistUniforms) {
  const m = mat as THREE.Material & { fog?: boolean };
  if (m.fog === false || (m as { userData: Record<string, unknown> }).userData.mist) return;
  m.userData.mist = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMistWorld;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 mistWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mistWP = instanceMatrix * mistWP;
        #endif
        vMistWorld = (modelMatrix * mistWP).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vMistWorld;
        uniform float uMist;
        uniform float uMistFloor;
        uniform float uMistFall;
        uniform vec3 uMistColor;`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        {
          float camD = length(vMistWorld - cameraPosition);
          float lowness = exp(-max(vMistWorld.y - uMistFloor, 0.0) * uMistFall);
          float reach = 1.0 - exp(-camD * 0.016);
          float mist = clamp(uMist * lowness * reach, 0.0, 0.92);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor, mist);
        }`,
      );
  };
  mat.needsUpdate = true;
}

export type SkyUniforms = {
  uSun: { value: THREE.Vector3 };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uGlow: { value: number };
  uNight: { value: number };
};

export function makeSky(radius: number) {
  const uniforms: SkyUniforms = {
    uSun: { value: SUN_DIR.clone() },
    uZenith: { value: new THREE.Color("#6f97c0") },
    uHorizon: { value: new THREE.Color("#f0dcb4") },
    uSunColor: { value: new THREE.Color("#ffd99a") },
    uGlow: { value: 1 },
    uNight: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uSun;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform float uGlow;
      uniform float uNight;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, -0.2, 1.0);
        float h = pow(max(up, 0.0), 0.45);
        vec3 col = mix(uHorizon, uZenith, h);
        col = mix(col, uHorizon * 0.82, smoothstep(0.0, -0.2, up));
        float s = max(dot(d, normalize(uSun)), 0.0);
        float sideLit = 0.5 + 0.5 * dot(normalize(vec2(d.x, d.z)), normalize(vec2(uSun.x, uSun.z)));
        col += uSunColor * (pow(s, 7.0) * 0.32 + pow(s, 48.0) * 0.55) * uGlow;
        col += uSunColor * pow(1.0 - max(up, 0.0), 6.0) * sideLit * 0.18 * uGlow;
        col += uSunColor * smoothstep(0.9965, 0.9985, s) * 2.6 * uGlow;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, geo, mat, uniforms };
}

let glowTex: THREE.Texture | null = null;
/** Soft radial dot used for flashes, sun glare and smoke. */
export function softDot() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

let puffTex: THREE.Texture | null = null;
/** Lumpy smoke puff, drawn once from overlapping soft blobs. */
export function smokePuff() {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 30;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    const rad = 18 + rnd() * 22;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, "rgba(255,255,255,0.32)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const img = g.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const d = Math.hypot(x - 64, y - 64) / 64;
      const k = Math.max(0, 1 - d * d);
      img.data[(y * 128 + x) * 4 + 3] *= k;
    }
  }
  g.putImageData(img, 0, 0);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}
