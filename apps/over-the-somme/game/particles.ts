import * as THREE from "three";

/**
 * One draw call of camera facing quads. Used for smoke, flashes, chalk debris
 * and muzzle fire. Each particle has a position, velocity, life, size growth,
 * colour and an alpha curve.
 */
export type Emit = {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  grow?: number;
  color: THREE.Color | string;
  alpha?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  /** 0 = fade evenly, 1 = pop in fast and linger */
  shape?: number;
};

const tmp = new THREE.Color();

export class Particles {
  readonly mesh: THREE.Mesh;
  private readonly cap: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly age: Float32Array;
  private readonly size: Float32Array;
  private readonly grow: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private readonly shape: Float32Array;
  private readonly aOffset: THREE.InstancedBufferAttribute;
  private readonly aScale: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aRot: THREE.InstancedBufferAttribute;
  private readonly spin: Float32Array;
  private cursor = 0;
  private live = 0;
  readonly geo: THREE.InstancedBufferGeometry;
  readonly mat: THREE.ShaderMaterial;
  budget = 1;

  constructor(cap: number, tex: THREE.Texture, additive: boolean, fogColor: THREE.Color) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.age = new Float32Array(cap).fill(1e9);
    this.size = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.alpha0 = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.shape = new Float32Array(cap);
    this.spin = new Float32Array(cap);

    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    this.aOffset = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.aScale = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    for (const a of [this.aOffset, this.aScale, this.aColor, this.aRot]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aOffset", this.aOffset);
    geo.setAttribute("aScale", this.aScale);
    geo.setAttribute("aColor", this.aColor);
    geo.setAttribute("aRot", this.aRot);
    geo.instanceCount = 0;
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uFogColor: { value: fogColor },
        uFogNear: { value: 80 },
        uFogFar: { value: 520 },
      },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec3 aOffset;
        attribute float aScale;
        attribute vec4 aColor;
        attribute float aRot;
        varying vec2 vUv;
        varying vec4 vColor;
        varying float vDist;
        void main() {
          vUv = uv;
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
          float c = cos(aRot), s = sin(aRot);
          vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
          mv.xy += p * aScale;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec2 vUv;
        varying vec4 vColor;
        varying float vDist;
        void main() {
          vec4 t = texture2D(uTex, vUv);
          float a = t.a * vColor.a;
          if (a < 0.003) discard;
          vec3 col = vColor.rgb;
          ${additive ? "" : "float f = smoothstep(uFogNear, uFogFar, vDist); col = mix(col, uFogColor, f * 0.85);"}
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
  }

  emit(e: Emit) {
    if (this.budget < 1 && Math.random() > this.budget) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    const o = i * 3;
    this.pos[o] = e.x;
    this.pos[o + 1] = e.y;
    this.pos[o + 2] = e.z;
    this.vel[o] = e.vx ?? 0;
    this.vel[o + 1] = e.vy ?? 0;
    this.vel[o + 2] = e.vz ?? 0;
    this.life[i] = e.life;
    this.age[i] = 0;
    this.size[i] = e.size;
    this.grow[i] = e.grow ?? 0;
    this.alpha0[i] = e.alpha ?? 1;
    this.grav[i] = e.gravity ?? 0;
    this.drag[i] = e.drag ?? 0;
    this.shape[i] = e.shape ?? 0;
    this.spin[i] = e.spin ?? (Math.random() - 0.5) * 0.6;
    this.aRot.array[i] = Math.random() * Math.PI * 2;
    tmp.set(e.color);
    this.aColor.array[i * 4] = tmp.r;
    this.aColor.array[i * 4 + 1] = tmp.g;
    this.aColor.array[i * 4 + 2] = tmp.b;
  }

  clear() {
    this.age.fill(1e9);
    this.geo.instanceCount = 0;
  }

  update(dt: number, windX: number, windZ: number) {
    // Compact live particles to the front of the instance buffers.
    let n = 0;
    const off = this.aOffset.array as Float32Array;
    const sc = this.aScale.array as Float32Array;
    const col = this.aColor.array as Float32Array;
    const rot = this.aRot.array as Float32Array;
    for (let i = 0; i < this.cap; i++) {
      const life = this.life[i];
      let age = this.age[i];
      if (age >= life) continue;
      age += dt;
      this.age[i] = age;
      if (age >= life) continue;
      const o = i * 3;
      const dk = Math.exp(-this.drag[i] * dt);
      this.vel[o] = this.vel[o] * dk + windX * (1 - dk);
      this.vel[o + 1] = this.vel[o + 1] * dk - this.grav[i] * dt;
      this.vel[o + 2] = this.vel[o + 2] * dk + windZ * (1 - dk);
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      rot[i] += this.spin[i] * dt;
      const t = age / life;
      const pop = this.shape[i];
      const fadeIn = Math.min(1, t / (pop > 0.5 ? 0.04 : 0.14));
      const fadeOut = pop > 0.5 ? (1 - t) ** 1.6 : 1 - t * t;
      const a = this.alpha0[i] * fadeIn * fadeOut;
      const s = this.size[i] + this.grow[i] * age;
      const n3 = n * 3;
      off[n3] = this.pos[o];
      off[n3 + 1] = this.pos[o + 1];
      off[n3 + 2] = this.pos[o + 2];
      sc[n] = s;
      col[n * 4] = col[i * 4];
      col[n * 4 + 1] = col[i * 4 + 1];
      col[n * 4 + 2] = col[i * 4 + 2];
      col[n * 4 + 3] = a;
      if (n !== i) {
        // Move this particle's state down so slot n stays live next frame.
        this.moveSlot(i, n);
        rot[n] = rot[i];
      }
      n++;
    }
    this.live = n;
    this.cursor = n % this.cap;
    this.geo.instanceCount = n;
    this.aOffset.needsUpdate = true;
    this.aScale.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }

  private moveSlot(from: number, to: number) {
    const f = from * 3;
    const t = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t + k] = this.pos[f + k];
      this.vel[t + k] = this.vel[f + k];
    }
    this.life[to] = this.life[from];
    this.age[to] = this.age[from];
    this.size[to] = this.size[from];
    this.grow[to] = this.grow[from];
    this.alpha0[to] = this.alpha0[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.shape[to] = this.shape[from];
    this.spin[to] = this.spin[from];
    this.age[from] = 1e9;
  }

  get count() {
    return this.live;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
