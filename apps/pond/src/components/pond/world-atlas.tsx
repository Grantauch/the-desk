import { useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import type { PondSim } from "@/lib/pond/sim";
import type { PondCamera } from "@/lib/pond/camera";
import type { ResidentSave } from "@/lib/pond/ecosystem";
import { getOutcome } from "@/lib/pond/discovery";
import {
  ATLAS_SIDE, BIOMES, atlasLandmarks, classifyAtlas, isVisited,
  type AtlasState, type Biome,
} from "@/lib/pond/atlas";

type Props = {
  sim: PondSim;
  atlas: AtlasState;
  camera: PondCamera;
  residents: readonly ResidentSave[];
  revision: number;
  onJump: (x: number, y: number) => void;
};

const MAP_SIZE = 320;
const TILE = MAP_SIZE / ATLAS_SIDE;
const LEGEND: Biome[] = ["water", "grove", "fire", "frost", "sand", "stone"];

function sampleMap(
  ctx: CanvasRenderingContext2D,
  sim: PondSim,
  atlas: AtlasState,
  biomes: readonly Biome[],
  residents: readonly ResidentSave[],
  camera: PondCamera,
) {
  const radius = MAP_SIZE / 2 - 2;
  ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = "#14191d";
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, radius, 0, Math.PI * 2);
  ctx.clip();

  const backdrop = ctx.createRadialGradient(158, 143, 10, 160, 160, 210);
  backdrop.addColorStop(0, "#343334");
  backdrop.addColorStop(1, "#17191d");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  for (let ty = 0; ty < ATLAS_SIDE; ty++) for (let tx = 0; tx < ATLAS_SIDE; tx++) {
    const worldX = Math.floor((tx + 0.5) * sim.w / ATLAS_SIDE);
    const worldY = Math.floor((ty + 0.5) * sim.h / ATLAS_SIDE);
    if (!sim.inDish(worldX, worldY)) continue;
    const seen = isVisited(atlas, tx, ty);
    const biome = biomes[ty * ATLAS_SIDE + tx]!;
    ctx.fillStyle = seen ? BIOMES[biome].color : "#202429";
    ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.3, TILE + 0.3);
    if (seen) {
      ctx.fillStyle = ((tx * 7 + ty * 11) % 4 === 0) ? "#f2eee1" : "#000000";
      ctx.globalAlpha = 0.075;
      ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE * 0.5, TILE * 0.26);
      ctx.globalAlpha = 1;
    } else if ((tx + ty) % 3 === 0) {
      ctx.strokeStyle = "#69717a";
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(tx * TILE, (ty + 1) * TILE);
      ctx.lineTo((tx + 1) * TILE, ty * TILE);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = "rgba(238,226,203,.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= MAP_SIZE; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); ctx.stroke();
  }
  for (let y = 0; y <= MAP_SIZE; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); ctx.stroke();
  }

  const scale = MAP_SIZE / sim.w;
  for (const resident of residents) {
    const tx = Math.floor(resident.x / sim.w * ATLAS_SIDE);
    const ty = Math.floor(resident.y / sim.h * ATLAS_SIDE);
    if (!isVisited(atlas, tx, ty)) continue;
    const outcome = getOutcome(resident.id);
    if (!outcome) continue;
    const hue = (outcome.facets.force * 29 + outcome.facets.form * 11) % 360;
    const x = resident.x * scale, y = resident.y * scale;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(13,17,20,.8)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(" + hue + " 89% 80%)";
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(246,236,211,.08)";
  ctx.strokeStyle = "#f4e6bb";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.fillRect(camera.x * scale, camera.y * scale, camera.size * scale, camera.size * scale);
  ctx.strokeRect(camera.x * scale, camera.y * scale, camera.size * scale, camera.size * scale);
  ctx.setLineDash([]);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(160, 160, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "#9d9b97";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(160, 160, radius - 4, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(245,229,193,.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function WorldAtlas({ sim, atlas, camera, residents, revision, onJump }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const biomes = useMemo(() => classifyAtlas(sim, atlas), [sim, atlas, revision]);
  const landmarks = useMemo(() => atlasLandmarks(sim, atlas, biomes, residents), [sim, atlas, biomes, residents]);
  const coverage = useMemo(() => {
    let seen = 0, possible = 0;
    for (let ty = 0; ty < ATLAS_SIDE; ty++) for (let tx = 0; tx < ATLAS_SIDE; tx++) {
      const x = Math.floor((tx + .5) * sim.w / ATLAS_SIDE);
      const y = Math.floor((ty + .5) * sim.h / ATLAS_SIDE);
      if (!sim.inDish(x, y)) continue;
      possible++;
      if (isVisited(atlas, tx, ty)) seen++;
    }
    return possible ? Math.round(100 * seen / possible) : 0;
  }, [sim, atlas]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d", { alpha: false });
    if (ctx) sampleMap(ctx, sim, atlas, biomes, residents, camera);
  }, [sim, atlas, camera, biomes, residents]);

  const navigate = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - bounds.left) / bounds.width * sim.w);
    const y = Math.floor((event.clientY - bounds.top) / bounds.height * sim.h);
    if (sim.inBounds(x, y) && sim.inDish(x, y)) onJump(x, y);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-3" aria-label="Exploration atlas">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-fg">World atlas</h2>
          <p className="text-xs text-muted">Real habitats, living inhabitants, and places you've visited</p>
        </div>
        <span className="rounded-md bg-surface-2 px-2.5 py-1 text-xs tabular-nums text-fg">{coverage}% explored</span>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="min-w-0">
          <button
            type="button"
            onClick={navigate}
            aria-label="Select a location on the world map to explore"
            title="Click the map to move your camera. Unexplored regions stay hidden."
            className="relative mx-auto block aspect-square w-full max-w-72 overflow-hidden rounded-full border-2 border-border-strong bg-[#171a1e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <canvas ref={canvas} width={MAP_SIZE} height={MAP_SIZE} className="pointer-events-none block size-full" aria-hidden="true"/>
            <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/75">N</span>
          </button>
          <p className="mt-2 text-center text-xs text-muted">Tap the map to travel · Dark regions are undiscovered</p>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Discovered locations</p>
          {landmarks.length ? (
            <div className="grid gap-1.5" aria-label="Visited habitat landmarks">
              {landmarks.map((place) => (
                <button key={place.title} type="button" onClick={() => onJump(place.x, place.y)}
                  aria-label={"Explore " + place.title}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-sm transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: BIOMES[place.biome].color }}/>
                  <span className="min-w-0 flex-1 text-fg">{place.title}</span>
                  <span className="text-xs tabular-nums text-muted">{place.residentCount ? place.residentCount + " life" : BIOMES[place.biome].label}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">Explore the pond to reveal its first landmarks.</p>
          )}
          <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted">Habitats</p>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {LEGEND.map((biome) => (
              <span key={biome} className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: BIOMES[biome].color }}/>
                {BIOMES[biome].label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Habitats reflect the actual sand, plants, water, ice, fire and stone you've created. Creature markers show residents in explored territory.
          </p>
        </div>
      </div>
    </section>
  );
}
