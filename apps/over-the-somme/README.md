# Over the Somme

Source for `public/hubs/ush9-over-the-somme.html`, the 3D flyover of the Somme battlefield on 1 July 1916.

The first version came out of Grok's app builder (Grantauch/atlas-plaza-tango-velvet) as a React app. This folder keeps only the game itself, with a plain page around it so it runs as a static hub like everything else in `public/hubs/`.

- `game/world.ts` builds the terrain, trench lines and the twenty sites (`POIS`) with their descriptions
- `game/props.ts` and `game/models.ts` place the wire, sandbags, figures, tanks and balloon
- `game/flight.ts` is the flight model
- `game/mount.ts` runs the scene, night mode, wireframe and the glide used by the field notebook
- `game/zerohour.ts` is the zero hour film: the clock, captions, camera shots, the infantry waves and the German machine guns. Captions and casualty rates by sector are at the top of the file
- `game/atmosphere.ts` holds the morning sun position, valley mist and the sky
- `game/fx.ts` and `game/particles.ts` make shell bursts, the mine columns, drifting smoke and muzzle flashes
- `game/plane.ts` is the Morane-Saulnier Type L Parasol
- `game/audio.ts` builds every sound in the browser. No sound files are loaded
- `entry.ts` drives the page: intro, zero hour captions, notebook, toasts, pause, graphics setting and touch controls

## Graphics settings

The page starts on Best (shadows, full smoke) on computers with a mouse and Balanced on touch screens. If frames run slow it steps down on its own, to Balanced and then Fast, which turns shadows off and thins the smoke. The pause screen has a manual setting.

## Sources for the zero hour captions

- Cecil Lewis, Sagittarius Rising (1936), quoted on the Lochnagar Crater Foundation's history panels, lochnagarcrater.org
- First day casualty figures (57,470, including 19,240 killed) are the standard British official history totals

The notebook remembers logged sites in the browser only. Nothing is sent anywhere.

## Rebuilding

The site does not rebuild this bundle. After editing, run from this folder:

```
npm install
npm run build
```

That rewrites `public/hubs/ush9-over-the-somme/somme.js`. Commit the source and the new bundle together.
