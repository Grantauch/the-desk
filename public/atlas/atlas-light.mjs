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
  uniform sampler2D borders;
  uniform float showBorders;
  uniform float atmosphereOn;
  uniform float cloudOffset;
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
    float pale = min(photo.r, min(photo.g, photo.b));
    float polar = smoothstep(.52, .78, abs(uvMap.y - .5) * 2.);
    float ice = smoothstep(.51, .79, pale) * max(polar, smoothstep(.82, .97, pale) * .72);
    float land = max(shore, ice);
    float value = dot(photo, vec3(.299, .587, .114));
    vec3 bronze = mix(vec3(.068, .036, .018), vec3(.68, .37, .13), pow(clamp(value * 1.30, 0., 1.), 1.1));
    float vegetation = smoothstep(-.04, .13, photo.g - photo.r * .77) * (1. - ice);
    bronze = mix(bronze, bronze * vec3(.66, 1.04, .68), vegetation * .78);
    bronze = mix(bronze, vec3(.57, .66, .72) * (value * .65 + .35), ice * .84);
    float shelf = smoothstep(.1, .53, photo.g * 1.18 + photo.b * .35);
    vec3 ocean = mix(vec3(.004, .022, .064), vec3(.023, .27, .34), shelf * .91);
    vec3 base = mix(ocean, bronze, land);

    vec3 localN = texture2D(relief, uvMap).rgb * 2. - 1.;
    localN.xy *= .30 + land * 2.15;
    vec3 surfaceN = normalize(t * localN.x + b * localN.y + n * max(.26, localN.z));
    float cosSun = dot(n, sun);
    float day = smoothstep(-.21, .49, cosSun);
    float cosView = max(0., dot(n, view));
    float sunlight = max(dot(surfaceN, sun), 0.);
    vec2 shadowOffset = vec2(dot(sun, t), dot(sun, b)) * .005 / max(.24, dot(n, sun));
    float transmission = 1.;
    if (atmosphereOn > .5) {
      float shadow = smoothstep(.17, .89, texture2D(clouds, uvMap + shadowOffset + vec2(cloudOffset, 0.)).r);
      transmission -= shadow * .36 * smoothstep(.02, .42, cosSun);
    }
    base *= mix(vec3(.055, .09, .20), vec3(.15, .24, .37), day)
      + vec3(1.38, 1.11, .78) * sunlight * transmission;
    if (showBorders > .5) {
      float border = texture2D(borders, uvMap).a;
      base = mix(base, mix(vec3(.31, .49, .60), vec3(.92, .71, .38), day),
        border * smoothstep(.10, .56, cosView) * mix(.83, .57, atmosphereOn));
    }
    float halfVector = max(dot(surfaceN, normalize(sun + view)), 0.);
    float sunglint = pow(halfVector, 37.) * .18 + pow(halfVector, 112.) * .72;
    vec3 reflection = mix(vec3(.18, .42, .61), vec3(1., .78, .43), day);
    base += reflection * sunglint * (1. - land) * day * transmission * transmission;
    base += vec3(.09, .05, .018) * pow(halfVector, 23.) * land * day * transmission;

    // Fine etched parallels, filtered at the horizon where the lines converge.
    vec2 lattice = abs(sin(uvMap * vec2(75.398, 37.699)));
    float grid = 1. - smoothstep(.006, .046, min(lattice.x, lattice.y));
    base += vec3(.026, .024, .018) * grid * day * cosView;
    float limb = pow(1. - cosView, 3.8);
    vec3 air = mix(vec3(.016, .095, .30), vec3(.12, .34, .58), day);
    air += vec3(.79, .30, .055) * pow(max(cosSun, 0.), 3.);
    float lowHaze = pow(1. - cosView, 1.65);
    base += air * (limb * .92 + lowHaze * .18) * atmosphereOn;
    gl_FragColor = vec4(base, 1.);
    #include <encodings_fragment>
  }
`;

export const atlasCloud = `
  uniform sampler2D clouds;
  uniform vec3 sun;
  uniform float observed;
  varying vec2 uvMap;
  varying vec3 worldN;
  varying vec3 worldP;
  varying vec3 worldT;

  float density(vec2 uv) {
    return texture2D(clouds, uv).r;
  }

  void main() {
    float center = density(uvMap);
    // Wisps, banks and tall cores come from one registered cloud field.
    float wisps = smoothstep(.055, .26, center);
    float banks = smoothstep(.13, .71, center);
    float core = smoothstep(.46, .96, center);
    float illustratedCover = wisps * .16 + banks * .65 + core * .17;
    float cover = mix(illustratedCover, smoothstep(.12, .91, center) * .91, observed);
    if (cover < .008) discard;
    vec3 n = normalize(worldN);
    vec3 t = normalize(worldT + vec3(.00001, 0., 0.));
    vec3 b = normalize(cross(n, t));
    vec2 stepUV = vec2(.0009, .0015);
    vec2 slope = vec2(density(uvMap + vec2(stepUV.x, 0.)) - density(uvMap - vec2(stepUV.x, 0.)),
                      density(uvMap + vec2(0., stepUV.y)) - density(uvMap - vec2(0., stepUV.y)));
    vec3 cloudN = normalize(n - (t * slope.x + b * slope.y) * mix(2.25, 4.3, core));
    float light = smoothstep(-.22, .83, dot(cloudN, sun));
    float day = smoothstep(-.25, .39, dot(n, sun));
    vec3 silver = mix(vec3(.055, .14, .31), vec3(.44, .61, .76), day);
    vec3 gold = mix(vec3(.86, .85, .80), vec3(1., .91, .76), core);
    vec3 color = silver * (.47 + banks * .25) + gold * light * (.25 + banks * .47 + core * .26);
    float edge = pow(1. - max(0., dot(n, normalize(cameraPosition - worldP))), 2.1);
    color += mix(vec3(.075, .22, .45), vec3(.55, .28, .09), light) * edge * .57;
    color /= vec3(1.) + max(color - .68, 0.) * .49;
    gl_FragColor = vec4(color, cover);
    #include <encodings_fragment>
  }
`;

export const atlasAir = `
  uniform vec3 sun;
  uniform float radius;
  varying vec3 worldN;
  varying vec3 worldP;
  void main() {
    vec3 n = normalize(worldN);
    vec3 view = normalize(cameraPosition - worldP);
    float chord = abs(dot(n, view));
    float altitude = max(0., radius * sqrt(max(0., 1. - chord * chord)) - 1.008);
    float density = exp(-altitude * 34.) * smoothstep(0., .34, chord);
    // A tight blue rim and a broad, faint halo share the same atmosphere shell.
    float halo = exp(-altitude * 14.) * smoothstep(0., .24, chord);
    float light = dot(n, sun);
    float day = smoothstep(-.42, .65, light);
    float terminator = (light - .12) * 2.65;
    float twilight = exp(-terminator * terminator);
    vec3 rim = mix(vec3(.05, .23, .62), vec3(.26, .58, .89), day);
    rim = mix(rim, vec3(.97, .46, .16), twilight * .75);
    vec3 mist = mix(vec3(.14, .32, .63), vec3(.73, .44, .23), twilight);
    float rimOpacity = density * mix(.30, .64, day);
    float haloOpacity = halo * .13;
    float opacity = rimOpacity + haloOpacity;
    vec3 color = (rim * rimOpacity + mist * haloOpacity) / max(.0001, opacity);
    gl_FragColor = vec4(color, opacity);
    #include <encodings_fragment>
  }
`;
