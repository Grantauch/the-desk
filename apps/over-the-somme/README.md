# Over the Somme

Source for `public/hubs/ush9-over-the-somme.html`, the 3D flyover of the Somme battlefield on 1 July 1916.

The first version came out of Grok's app builder (Grantauch/atlas-plaza-tango-velvet) as a React app. This folder keeps only the game itself, with a plain page around it so it runs as a static hub like everything else in `public/hubs/`.

- `game/world.ts` builds the terrain, trench lines and the twenty sites (`POIS`) with their descriptions
- `game/props.ts` and `game/models.ts` place the wire, sandbags, figures, tanks and balloon
- `game/flight.ts` is the flight model
- `game/mount.ts` runs the scene, night mode, wireframe and the glide used by the field notebook
- `entry.ts` drives the page: intro, notebook, toasts, pause and touch controls

The notebook remembers logged sites in the browser only. Nothing is sent anywhere.

## Rebuilding

The site does not rebuild this bundle. After editing, run from this folder:

```
npm install
npm run build
```

That rewrites `public/hubs/ush9-over-the-somme/somme.js`. Commit the source and the new bundle together.
