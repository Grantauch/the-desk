import type { PointerEvent, ReactNode } from "react";
import {
  Coins,
  Crosshair,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "./icons";
import {
  ART_URLS,
  MANUAL_BONUS,
  SELL_RATE,
  TOWER_ORDER,
  TOWERS,
  WAVES,
  towerDamage,
  towerRate,
  upgradeCost,
  type Priority,
  type TowerKind,
} from "./game/data";
import { paint } from "./game/draw";
import { Game, screenToWorld, type Hud } from "./game/game";

const { useEffect, useRef, useState } = window.React;
const HISTORY_URL = "https://encyclopedia.ushmm.org/content/en/article/invasion-of-poland-fall-1939";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "first", label: "First" },
  { id: "last", label: "Last" },
  { id: "close", label: "Near" },
  { id: "strong", label: "Strong" },
];

export function Blitzkrieg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) gameRef.current = new Game();
  const game = gameRef.current;
  const [hud, setHud] = useState<Hud>(() => game.hud());

  useEffect(() => {
    game.hydrateSave();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    game.reduce = reduce;
    return game.subscribe(() => setHud(game.hud()));
  }, [game]);

  useEffect(() => {
    let left = Object.keys(ART_URLS).length;
    for (const [key, url] of Object.entries(ART_URLS)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        game.setImage(key, img);
        left -= 1;
        if (left === 0) game.markDirty();
      };
      img.onerror = () => {
        left -= 1;
      };
      img.src = url;
    }
  }, [game]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fit = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      game.setView(rect.width, rect.height, dpr);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.frame(dt);
      paint(game, ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [game]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.repeat) return;
      if (event.code === "Space") {
        if (target?.closest("button, a")) return;
        event.preventDefault();
        if (game.phase === "briefing") game.dismissBriefing();
        else if (game.mannedId) game.setKeyFire(true);
        else if (game.phase === "deploy") game.startWave();
      } else if (event.code === "Escape") {
        if (game.mannedId) game.unman();
        else game.arm(null);
      } else if (event.code === "KeyM" && game.selectedId) {
        if (game.mannedId === game.selectedId) game.unman();
        else game.man(game.selectedId);
      } else if (event.code === "KeyP") game.togglePause();
      else if (event.code === "Digit1") game.arm("ckm");
      else if (event.code === "Digit2") game.arm("at");
      else if (event.code === "Digit3") game.arm("mortar");
      else if (event.code === "Digit4") game.arm("aa");
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") game.setKeyFire(false);
    };
    const blur = () => game.blur();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") game.blur();
      else game.audio.resume();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [game]);

  const worldFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return screenToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      game.camX,
      game.camY,
      game.camZoom,
    );
  };

  const wave = WAVES[hud.wave];
  const manned = hud.mannedId !== null;
  const playing = hud.phase === "deploy" || hud.phase === "combat";

  return (
    <div className="app-shell relative">
      <header className="app-header flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2">
        <div className="mr-auto min-w-0">
          <p className="font-display text-xl leading-none tracking-wide">Blitzkrieg</p>
          <p className="text-sm uppercase tracking-widest text-muted">1 September 1939</p>
        </div>
        <Stat icon={<Heart className="size-4" aria-hidden />} label="Garrison" value={String(hud.lives)} hot={hud.lives <= 6} />
        <Stat icon={<Coins className="size-4" aria-hidden />} label="Złoty" value={String(hud.gold)} accent />
        <Stat
          icon={<Crosshair className="size-4" aria-hidden />}
          label="Wave"
          value={`${Math.min(hud.wave + 1, hud.waveCount)}/${hud.waveCount}`}
        />
        <div className="flex items-center gap-2">
          <IconButton label={hud.paused ? "Resume" : "Pause"} onClick={() => game.togglePause()} disabled={hud.phase !== "combat"}>
            {hud.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </IconButton>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-md border border-border bg-surface-2 px-3 text-sm uppercase tracking-wider text-fg disabled:opacity-40"
            onClick={() => game.toggleSpeed()}
            disabled={!playing}
          >
            {hud.speed}×
          </button>
          <IconButton label={hud.muted ? "Unmute" : "Mute"} onClick={() => game.toggleMute()}>
            {hud.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconButton>
        </div>
      </header>

      <div ref={stageRef} className="relative min-h-0 bg-bg">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          aria-label="Polish road, 1 September 1939. Place guns off the road."
          onContextMenu={(event) => {
            event.preventDefault();
            game.arm(null);
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            game.audio.unlock();
            const world = worldFromEvent(event);
            game.pointerDown(world, event.pointerType === "touch" ? "touch" : "mouse", event.detail);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.isPrimary) game.pointerMove(worldFromEvent(event));
          }}
          onPointerUp={(event) => { if (event.isPrimary) game.pointerUp(); }}
          onPointerCancel={(event) => { if (event.isPrimary) game.pointerUp(); }}
          onLostPointerCapture={(event) => { if (event.isPrimary) game.pointerUp(); }}
        />
        {playing && hud.hint ? (
          <div className="callout pointer-events-none absolute top-4 right-4 left-4 mx-auto max-w-md rounded-md border border-border bg-surface/95 px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-widest text-accent">
              Wave {hud.wave + 1} · {hud.waveName}
            </p>
            <p className="mt-1 text-base text-fg">{hud.hint}</p>
          </div>
        ) : null}
        {manned ? (
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex justify-center lg:bottom-4">
            <p className="rounded-md border border-primary bg-surface px-3 py-2 text-center text-sm uppercase tracking-widest text-fg">
              On the gun · aim and hold to fire · Esc releases · direct fire +{Math.round((MANUAL_BONUS - 1) * 100)}%
            </p>
          </div>
        ) : null}
        {manned ? (
          <button
            type="button"
            className="fire-hold absolute right-4 bottom-20 z-10 h-20 w-20 place-items-center rounded-full bg-primary text-sm uppercase tracking-widest text-fg shadow-lg"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              game.setBtnFire(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={() => game.setBtnFire(false)}
            onPointerCancel={() => game.setBtnFire(false)}
            onLostPointerCapture={() => game.setBtnFire(false)}
          >
            Fire
          </button>
        ) : null}
        {hud.phase === "combat" ? (
          <p className="pointer-events-none absolute bottom-3 left-3 text-sm uppercase tracking-widest text-fg">
            {hud.left} still on the road{hud.paused ? " · paused" : ""}
          </p>
        ) : null}
      </div>

      <aside className="dock flex min-h-0 flex-col border-t border-border bg-surface">
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">Guns · 1–4 to arm</p>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible">
            {TOWER_ORDER.map((kind) => {
              const def = TOWERS[kind];
              const armed = hud.armed === kind;
              const poor = hud.gold < def.cost;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={armed}
                  disabled={!playing || poor}
                  onClick={() => game.arm(kind)}
                  className={`flex min-h-16 w-44 shrink-0 items-center gap-2 rounded-md border px-2 py-2 text-left lg:w-auto ${
                    armed ? "border-primary bg-surface-2" : "border-border bg-bg"
                  } disabled:opacity-40`}
                >
                  <img src={ART_URLS[`tower-${kind}`]} alt="" className="h-12 w-12 object-contain" />
                  <span className="min-w-0">
                    <span className="block text-base leading-tight text-fg">{def.name}</span>
                    <span className="block text-sm text-muted">{def.tone}</span>
                  </span>
                  <span className="ml-auto text-sm text-accent">{def.cost}</span>
                </button>
              );
            })}
          </div>
          <Inspector hud={hud} game={game} />
        </div>
        <div className="border-t border-border p-3">
          <button
            type="button"
            className="min-h-11 w-full rounded-md bg-primary px-4 text-base uppercase tracking-widest text-fg disabled:opacity-40"
            disabled={hud.phase !== "deploy"}
            onClick={() => {
              game.audio.unlock();
              game.startWave();
            }}
          >
            {hud.phase === "combat" ? "Column on the road" : `Send wave ${hud.wave + 1}`}
          </button>
          <p className="mt-2 text-center text-sm text-muted">
            {wave ? wave.name : ""} · leaks cost the garrison
          </p>
        </div>
      </aside>

      {hud.phase === "briefing" ? (
        <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/80 p-4">
          <article className="overlay-card w-full max-w-lg rounded-lg border border-border bg-surface px-6 py-6 shadow-xl">
            <p className="text-xs uppercase tracking-widest text-accent">Poland · the frontier road</p>
            <h1 className="mt-1 font-display text-5xl leading-none text-fg">Blitzkrieg</h1>
            <p className="mt-2 text-sm uppercase tracking-widest text-muted">1 September 1939</p>
            <p className="mt-4 text-lg leading-snug text-fg">
              Columns are crossing the border at dawn. You have the guns on one road into the interior — nests, the 37mm, mortars, and a Bofors. Hold until night.
            </p>
            <ul className="mt-4 space-y-2 text-base leading-snug text-muted">
              <li>Set guns off the road. They crew themselves and fire on the first target in range.</li>
              <li>Man a gun when a bend is failing. You aim. You fire. The others keep shooting.</li>
              <li>Upgrade ordnance and drill. Every vehicle that slips through costs the garrison.</li>
            </ul>
            <p className="mt-4 text-sm leading-snug text-muted">
              This is a fictional road set during Nazi Germany’s invasion of Poland.{" "}
              <a className="text-accent underline" href={HISTORY_URL} target="_blank" rel="noreferrer">
                Read the history at the U.S. Holocaust Memorial Museum.
              </a>
            </p>
            <p className="mt-4 text-sm text-muted">
              {hud.victories > 0
                ? `This road has held ${hud.victories} ${hud.victories === 1 ? "time" : "times"}.`
                : hud.bestWave > 0
                  ? `Furthest hold: wave ${hud.bestWave} of ${hud.waveCount}.`
                  : "No hold recorded on this road yet."}
            </p>
            <button
              type="button"
              className="mt-5 min-h-11 w-full rounded-md bg-primary px-4 text-base uppercase tracking-widest text-fg"
              onClick={() => game.dismissBriefing()}
            >
              Take the road
            </button>
          </article>
        </div>
      ) : null}

      {hud.phase === "victory" || hud.phase === "defeat" ? (
        <EndCard hud={hud} onRestart={() => game.restart()} />
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hot,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hot?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={hot ? "text-primary" : accent ? "text-accent" : "text-muted"}>{icon}</span>
      <span>
        <span className="block text-xs uppercase tracking-widest text-muted">{label}</span>
        <span className={`block text-lg leading-none tabular-nums ${hot ? "text-primary" : accent ? "text-accent" : "text-fg"}`}>
          {value}
        </span>
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-md border border-border bg-surface-2 text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Inspector({ hud, game }: { hud: Hud; game: Game }) {
  const selected = hud.selected;
  if (!selected) {
    return (
      <div className="mt-3 rounded-md border border-border bg-bg px-3 py-3">
        <p className="text-base text-fg">Arm a gun, then tap open ground.</p>
        <p className="mt-1 text-sm leading-snug text-muted">
          Double-click a placed gun, or press M, to crew it. Direct fire hits harder. Sell returns {Math.round(SELL_RATE * 100)}%.
        </p>
      </div>
    );
  }
  const def = TOWERS[selected.kind];
  const dmgCost = upgradeCost(selected.kind, "dmg", selected.dmgRank);
  const rateCost = upgradeCost(selected.kind, "rate", selected.rateRank);
  const crewed = hud.mannedId === selected.id;
  return (
    <div className="mt-3 rounded-md border border-border bg-bg px-3 py-3">
      <div className="flex items-start gap-3">
        <img src={ART_URLS[`tower-${selected.kind}`]} alt="" className="h-14 w-14 object-contain" />
        <div>
          <h2 className="text-lg leading-tight text-fg">{def.name}</h2>
          <p className="text-sm leading-snug text-muted">{def.blurb}</p>
        </div>
      </div>
      <p className="mt-3 text-sm tabular-nums text-fg">
        {Math.round(towerDamage(selected.kind, selected.dmgRank))} damage · {towerRate(selected.kind, selected.rateRank).toFixed(1)} /s
        {crewed ? " · crewed" : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRIORITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => game.setPriority(item.id)}
            className={`min-h-11 rounded-md border px-3 text-sm uppercase tracking-wider ${
              selected.priority === item.id ? "border-accent bg-surface-2 text-accent" : "border-border text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <Upgrade
          label="Ordnance"
          rank={selected.dmgRank}
          cost={dmgCost}
          gold={hud.gold}
          onClick={() => game.upgrade(selected.id, "dmg")}
        />
        <Upgrade
          label="Drill"
          rank={selected.rateRank}
          cost={rateCost}
          gold={hud.gold}
          onClick={() => game.upgrade(selected.id, "rate")}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-11 rounded-md bg-primary px-3 text-sm uppercase tracking-widest text-fg"
          onClick={() => (crewed ? game.unman() : game.man(selected.id))}
        >
          {crewed ? "Release gun" : "Man this gun"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 text-sm uppercase tracking-widest text-muted"
          onClick={() => game.sell(selected.id)}
        >
          Sell {Math.floor(selected.spent * SELL_RATE)}
        </button>
      </div>
    </div>
  );
}

function Upgrade({
  label,
  rank,
  cost,
  gold,
  onClick,
}: {
  label: string;
  rank: number;
  cost: number;
  gold: number;
  onClick: () => void;
}) {
  const maxed = rank >= 3;
  return (
    <button
      type="button"
      disabled={maxed || gold < cost}
      onClick={onClick}
      className="flex min-h-11 items-center justify-between rounded-md border border-border px-3 text-left text-sm disabled:opacity-40"
    >
      <span className="text-fg">
        {label}
        <span className="ml-2 inline-flex gap-1 align-middle">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`inline-block size-2 rounded-full ${i < rank ? "bg-accent" : "bg-border"}`} />
          ))}
        </span>
      </span>
      <span className="text-accent">{maxed ? "Max" : `${cost} zł`}</span>
    </button>
  );
}

function EndCard({ hud, onRestart }: { hud: Hud; onRestart: () => void }) {
  const won = hud.phase === "victory";
  const wave = WAVES[Math.min(hud.wave, WAVES.length - 1)];
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-bg/80 p-4">
      <article className="overlay-card w-full max-w-lg rounded-lg border border-border bg-surface px-6 py-6 text-center">
        <p className="text-xs uppercase tracking-widest text-accent">{won ? "Night, 1 September" : "The road is open"}</p>
        <h2 className="mt-2 font-display text-4xl text-fg">{won ? "The line holds." : "The corridor breaks."}</h2>
        <p className="mt-3 text-lg leading-snug text-muted">
          {won
            ? "Twelve waves stopped on this road. It is one road. It held."
            : `The garrison failed on wave ${hud.wave + 1}${wave ? `, ${wave.name}` : ""}. Other roads are still fighting. This one is not.`}
        </p>
        <p className="mt-4 text-sm leading-snug text-muted">
          In the September Campaign, the Soviet Union invaded eastern Poland on September 17.
          German forces took Warsaw later that month.{" "}
          <a className="text-accent underline" href={HISTORY_URL} target="_blank" rel="noreferrer">
            Read how the invasion unfolded.
          </a>
        </p>
        <button
          type="button"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-base uppercase tracking-widest text-fg"
          onClick={onRestart}
        >
          <RotateCcw className="size-4" aria-hidden />
          Reform the line
        </button>
      </article>
    </div>
  );
}
