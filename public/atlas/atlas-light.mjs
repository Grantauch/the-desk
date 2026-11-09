// Live lighting for the terrain and cloud layers authored in the Blender master.
export const atlasVertex = `
  varying vec2 uvMap;
  varying vec3 worldN;
  varying vec3 worldP;
  varying vec3 worldT;
  void main() {
    uvMap = uv;
    worldN = normalize(mat3(modelMatrix) * normalize(position));
    worldT = mat3(modelMatrix) * vec3(position.z, 0., -position.x);
    worldP = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.);
  }
`;

export const atlasSurface = `
  uniform sampler2D surface;
  uniform sampler2D clouds;
  uniform sampler2D relief;
  uniform vec2 cloudOffset;
  uniform vec3 sun;
  varying vec2 uvMap;
  varying vec3 worldN;
  varying vec3 worldP;
  varying vec3 worldT;

  void main() {
    vec3 n = normalize(worldN);
    vec3 t = normalize(worldT + vec3(.00001, 0., 0.));
    vec3 b = normalize(cross(n, t));
    vec3 view = normalize(cameraPosition - worldP);
    vec3 photo = texture2D(surface, uvMap).rgb;
    float shore = smoothstep(-.017, .035, photo.r + photo.g * .22 - photo.b * .95);
    float ice = smoothstep(.32, .64, min(photo.r, photo.g));
    float land = max(shore, ice);
    float value = dot(photo, vec3(.299, .587, .114));
    vec3 bronze = mix(vec3(.075, .035, .014), vec3(.72, .38, .124), pow(clamp(value * 1.26, 0., 1.), .94));
    float shelf = smoothstep(.1, .53, photo.g * 1.18 + photo.b * .35);
    vec3 ocean = mix(vec3(.005, .024, .056), vec3(.026, .21, .27), shelf * .86);
    vec3 base = mix(ocean, bronze, land);

    vec3 localN = texture2D(relief, uvMap).rgb * 2. - 1.;
    localN.xy *= .66 + land * 1.42;
    vec3 surfaceN = normalize(t * localN.x + b * localN.y + n * max(.26, localN.z));
    float day = smoothstep(-.15, .58, dot(n, sun));
    float sunlight = max(dot(surfaceN, sun), 0.);
    vec2 shadowOffset = vec2(dot(sun, t), dot(sun, b)) * .005 / max(.24, dot(n, sun));
    float shadow = smoothstep(.16, .87, texture2D(clouds, uvMap + shadowOffset + vec2(cloudOffset.x, 0.)).r);
    float upperShadow = smoothstep(.38, .84, texture2D(clouds, uvMap + shadowOffset * 1.8 + vec2(cloudOffset.y, .004)).r);
    float transmission = 1. - shadow * .33 - upperShadow * .15;
    base *= vec3(.24, .32, .45) + vec3(1.16, .93, .68) * sunlight * transmission;
    float specular = pow(max(dot(surfaceN, normalize(sun + view)), 0.), mix(67., 20., land));
    base += specular * mix(vec3(.18, .24, .25), vec3(.044, .026, .009), land) * day * transmission;

    // Fine etched parallels, filtered at the horizon where the lines converge.
    vec2 lattice = abs(sin(uvMap * vec2(75.398, 37.699)));
    float grid = 1. - smoothstep(.006, .046, min(lattice.x, lattice.y));
    base += vec3(.061, .042, .023) * grid * (.30 + .70 * day) * max(0., dot(n, view));
    float limb = pow(1. - max(0., dot(n, view)), 3.4);
    vec3 air = mix(vec3(.013, .075, .16), vec3(.18, .39, .49), day);
    air += vec3(.63, .22, .048) * pow(max(dot(n, sun), 0.), 3.);
    base += air * limb * .66;
    gl_FragColor = vec4(base, 1.);
    #include <encodings_fragment>
  }
`;

export const atlasCloud = `
  uniform sampler2D clouds;
  uniform vec3 sun;
  uniform float upper;
  varying vec2 uvMap;
  varying vec3 worldN;
  varying vec3 worldP;
  varying vec3 worldT;

  float density(vec2 uv) {
    return texture2D(clouds, uv + vec2(0., upper * .004)).r;
  }

  void main() {
    float center = density(uvMap);
    float cover = mix(smoothstep(.12, .81, center) * .90, smoothstep(.36, .88, center) * .46, upper);
    if (cover < .008) discard;
    vec3 n = normalize(worldN);
    vec3 t = normalize(worldT + vec3(.00001, 0., 0.));
    vec3 b = normalize(cross(n, t));
    vec2 stepUV = vec2(.0012, .0018);
    vec2 slope = vec2(density(uvMap + vec2(stepUV.x, 0.)) - density(uvMap - vec2(stepUV.x, 0.)),
                      density(uvMap + vec2(0., stepUV.y)) - density(uvMap - vec2(0., stepUV.y)));
    vec3 cloudN = normalize(n - (t * slope.x + b * slope.y) * mix(1.85, .64, upper));
    float light = max(0., dot(cloudN, sun));
    float day = smoothstep(-.22, .45, dot(n, sun));
    vec3 silver = mix(vec3(.062, .12, .20), vec3(.33, .47, .55), day);
    vec3 gold = mix(vec3(.83, .72, .58), vec3(1., .76, .47), upper);
    vec3 color = silver * .61 + gold * light * mix(.94, 1.07, upper);
    float edge = pow(1. - max(0., dot(n, normalize(cameraPosition - worldP))), 2.4);
    color += vec3(.42, .29, .16) * edge * day * .45;
    gl_FragColor = vec4(color, cover);
    #include <encodings_fragment>
  }
`;

export const atlasAir = `
  uniform vec3 sun;
  varying vec3 worldN;
  varying vec3 worldP;
  void main() {
    vec3 n = normalize(worldN);
    vec3 view = normalize(cameraPosition - worldP);
    float grazing = abs(dot(n, view));
    float rim = pow(1. - grazing, 5.) * smoothstep(.005, .145, grazing);
    float day = smoothstep(-.4, .82, dot(n, sun));
    vec3 color = mix(vec3(.033, .15, .34), vec3(.68, .32, .095), day);
    gl_FragColor = vec4(color, rim * mix(.48, .79, day));
    #include <encodings_fragment>
  }
`;
