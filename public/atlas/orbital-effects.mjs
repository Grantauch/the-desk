import { atlasVertex } from './atlas-light.mjs';
import { pointFromLatLon } from './story-data.mjs';

const fragment = `
  uniform vec3 axis;
  uniform vec3 east;
  uniform vec3 north;
  uniform vec3 sun;
  uniform float kind;
  uniform float time;
  uniform float strength;
  varying vec3 worldN;
  varying vec3 worldP;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
      mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
  }
  float textureField(vec2 p) {
    return noise(p) * .56 + noise(p * 2.13 + 7.) * .29 + noise(p * 4.31 - 3.) * .15;
  }
  float ellipse(vec2 p, vec2 size) {
    vec2 q = p / size;
    return exp(-dot(q, q));
  }
  void main() {
    vec3 n = normalize(worldN);
    if (dot(n, axis) < .78) discard;
    vec2 p = vec2(dot(n, east), dot(n, north));
    float r = length(p);
    float phase = time * 6.28318;
    float light = smoothstep(-.18, .68, dot(n, sun));
    vec3 color = vec3(1.);
    float opacity = 0.;

    if (kind < 1.5) {
      // Exhaust below the rising three-dimensional rocket light.
      vec2 q = p - vec2(.05, .018) * time;
      float pad = ellipse(q, vec2(.018 + time * .04, .012 + time * .023));
      float detail = textureField(q * 175. + time * 3.);
      opacity = pad * detail * .65;
      color = mix(vec3(.46, .34, .23), vec3(1., .80, .51), pad);
    } else if (kind < 2.5) {
      float angle = atan(p.y, p.x);
      float bands = .5 + .5 * cos(angle * 3. - log(max(r, .016)) * 6.9 + phase * .62);
      float detail = textureField(p * 83. + vec2(time * 2., 0.));
      float wall = exp(-pow(abs(r - .045) * 31., 2.));
      float eye = smoothstep(.017, .035, r);
      float cover = max(wall * .83, pow(bands, 1.55) * (1. - smoothstep(.05, .27, r)));
      opacity = cover * eye * (.46 + .54 * detail);
      color = mix(vec3(.31, .47, .59), vec3(.98, .95, .86), clamp(.42 + wall * .26 + detail * .45, 0., 1.));
      color *= .68 + light * .32;
    } else if (kind < 3.5) {
      float mass = max(ellipse(p, vec2(.14, .085)), ellipse(p - vec2(.10, .02), vec2(.065, .05)));
      float detail = textureField(p * 96.);
      float pulse = exp(-pow(abs(time - .27) * 14., 2.)) + exp(-pow(abs(time - .68) * 15., 2.));
      float lit = pulse * max(ellipse(p - vec2(.025, -.012), vec2(.052, .041)),
        ellipse(p + vec2(.066, -.034), vec2(.038, .05)) * .60);
      color = mix(vec3(.24, .34, .51), vec3(.75, .85, 1.), clamp(lit * .8 + detail * .22, 0., 1.));
      opacity = mass * (.37 + detail * .41) + lit * .40;
    } else if (kind < 4.5) {
      vec2 drift = vec2(-.11, .022) * time;
      vec2 q = p - drift;
      float size = .045 + .12 * time;
      float detail = textureField(q * 69. - time * 4.);
      float canopy = ellipse(q, vec2(size, size * .70));
      float column = ellipse(p, vec2(.025, .045));
      opacity = smoothstep(.17, .70, detail * (canopy * 1.24 + column * .35)) * .95;
      color = mix(vec3(.24, .20, .22), vec3(.81, .67, .53), detail * .65 + light * .2);
    } else if (kind < 5.5) {
      float arc = .09 - p.x * p.x * .91 + sin(p.x * 16. - phase * .4) * .027;
      float fold = sin(p.x * 49. + phase * .67) * .015 + sin(p.x * 83.) * .008;
      float curtain = exp(-pow(abs(p.y - arc - fold) * 43., 2.));
      float upper = exp(-pow(abs(p.y - arc - fold - .055) * 23., 2.));
      float folds = .58 + .42 * sin(p.x * 105. - phase * .74) * sin(p.x * 41.);
      color = mix(vec3(.49, .36, .79), vec3(.14, 1., .64), curtain);
      opacity = (curtain * .73 + upper * .31) * folds * exp(-pow(abs(p.x) * 3.7, 2.));
    } else if (kind < 6.5) {
      vec2 q = p - vec2(mix(-.32, .32, time), mix(.15, -.16, time));
      float core = ellipse(q, vec2(.072, .068));
      float penumbra = ellipse(q, vec2(.215, .18));
      opacity = core * .57 + penumbra * .37;
      color = vec3(.017, .029, .067);
    } else {
      float downwind = -p.y;
      float trail = p.x - downwind * .51 - sin(downwind * 16. - phase * .30) * .026;
      float width = .020 + max(0., downwind) * .35;
      float wisps = textureField(vec2(trail * 105., downwind * 34. - time * 2.));
      float plume = exp(-pow(abs(trail) / width, 2.)) * smoothstep(-.045, .027, downwind)
        * (1. - smoothstep(.12, .25 + time * .14, downwind));
      opacity = plume * (.25 + wisps * .65);
      color = mix(vec3(.47, .39, .34), vec3(.83, .77, .63), wisps * .8);
    }

    opacity *= strength * smoothstep(.08, .42, dot(n, normalize(cameraPosition - worldP)));
    if (opacity < .008) discard;
    gl_FragColor = vec4(color, min(opacity, .97));
    #include <encodings_fragment>
  }
`;

export function createOrbitalEffects(T, earth, sun) {
  const uniforms = {
    axis: { value: new T.Vector3() }, east: { value: new T.Vector3() }, north: { value: new T.Vector3() },
    sun, kind: { value: 0 }, time: { value: 0 }, strength: { value: 0 },
  };
  const shell = new T.Mesh(new T.SphereGeometry(1, 64, 40), new T.ShaderMaterial({
    vertexShader: atlasVertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false,
  }));
  shell.renderOrder = 5;
  earth.add(shell);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#fffdf0');
  glow.addColorStop(.11, '#fff6bd');
  glow.addColorStop(.27, '#ffbf609a');
  glow.addColorStop(1, '#fc7a2200');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(canvas);
  const trail = Array.from({ length: 14 }, () => {
    const dot = new T.Sprite(new T.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }));
    dot.renderOrder = 6;
    earth.add(dot);
    return dot;
  });
  const anchor = new T.Vector3(), localEast = new T.Vector3(), localNorth = new T.Vector3();
  const worldRotation = new T.Quaternion();
  let current;

  function update(event, progress = 0, atmosphere = true, still = false) {
    const enabled = Boolean(event && (atmosphere || event.effect === 6 || event.effect === 1));
    shell.visible = enabled;
    const launch = enabled && event.effect === 1;
    for (const dot of trail) dot.visible = launch;
    if (!enabled) return;
    if (current !== event) {
      current = event;
      anchor.fromArray(pointFromLatLon(event.lat, event.lon));
      localEast.crossVectors(new T.Vector3(0, 1, 0), anchor).normalize();
      localNorth.crossVectors(anchor, localEast).normalize();
      uniforms.kind.value = event.effect;
      shell.scale.setScalar(event.effect === 6 ? 1.052 : event.effect === 5 ? 1.078 : 1.062);
    }
    earth.getWorldQuaternion(worldRotation);
    uniforms.axis.value.copy(anchor).applyQuaternion(worldRotation);
    uniforms.east.value.copy(localEast).applyQuaternion(worldRotation);
    uniforms.north.value.copy(localNorth).applyQuaternion(worldRotation);
    const fade = still ? 1 : Math.min(1, progress * 10, (1 - progress) * 8);
    uniforms.time.value = progress;
    uniforms.strength.value = fade;
    if (launch) {
      trail.forEach((dot, index) => {
        const t = Math.max(0, progress - index * .021);
        dot.position.copy(anchor).multiplyScalar(1.041 + .29 * t ** 1.36)
          .addScaledVector(localEast, .16 * t * t)
          .addScaledVector(localNorth, .052 * t);
        const size = index === 0 ? .093 : .037 + index * .0023;
        dot.scale.set(size, size, 1);
        dot.material.opacity = fade * (index === 0 ? 1 : (1 - index / trail.length) * .43);
      });
    }
  }

  update(null);
  return { update };
}
