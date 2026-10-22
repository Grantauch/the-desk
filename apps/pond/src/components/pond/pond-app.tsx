import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Pause,
  Play,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PondCanvas } from "@/components/pond/pond-canvas";
import { pondAudio } from "@/lib/pond/audio";
import {
  E,
  ERASER,
  HINTS,
  PALETTE,
  RECIPES,
  WIND,
  toolById,
  type ToolId,
} from "@/lib/pond/elements";
import { PondSim, SCENES, loadScene, type SceneId } from "@/lib/pond/sim";
import { cn } from "@/lib/utils";
import { decodeWorld, encodeWorld, MAX_SAVE_BYTES, WORLD_KEY } from "@/lib/pond/save";

const BRUSHES = [1, 2, 4, 7, 11];

export function PondApp() {
  const sim = useMemo(() => {
    const s = new PondSim();
    loadScene(s, "garden");
    return s;
  }, []);
  const undoRef = useRef<Uint8Array[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [saveMessage, setSaveMessage] = useState("Saves in this browser. Export to keep a copy.");
  const [started, setStarted] = useState(false);
  const [tool, setTool] = useState<ToolId>(E.SAND);
  const [brush, setBrush] = useState(4);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [guide, setGuide] = useState(false);
  const [scene, setScene] = useState<SceneId | "custom">("garden");
  const [grains, setGrains] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const startedRef = useRef(false);
  startedRef.current = started;

  const checkpoint = useCallback(() => {
    undoRef.current = [...undoRef.current.slice(-19), sim.snapshot()];
    setCanUndo(true);
    setScene("custom");
  }, [sim]);

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    sim.restore(previous);
    setScene("custom");
    setCanUndo(undoRef.current.length > 0);
    setPaused(true);
    setToast("Undone. Paused so you can inspect it.");
  }, [sim]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("pond-muted") !== "0");
      const saved = localStorage.getItem(WORLD_KEY);
      if (saved) {
        sim.restore(decodeWorld(saved, sim));
        setScene("custom");
        setPaused(true);
        setSaveMessage("Your saved world is ready. Press Play when you want it to move.");
      }
    } catch {
      setSaveMessage("A previous save could not be loaded. Your new dish is ready.");
    }
    const save = () => {
      if (!startedRef.current) return;
      try { localStorage.setItem(WORLD_KEY, encodeWorld(sim)); }
      catch { setSaveMessage("Browser saving is unavailable. Use Export world to keep this dish."); }
    };
    const hide = () => { if (document.hidden) save(); };
    const interval = window.setInterval(save, 10000);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => {
      save();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [sim]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!guide) return;
    const before = document.activeElement as HTMLElement | null;
    guideRef.current?.focus();
    return () => before?.focus();
  }, [guide]);

  useEffect(() => {
    sim.paused = paused;
  }, [sim, paused]);

  useEffect(() => {
    pondAudio.setMuted(muted);
    try {
      localStorage.setItem("pond-muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [muted]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") pondAudio.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIndex((n) => (n + 1) % HINTS.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.code === "Escape") { setGuide(false); return; }
      if (guide || !started) return;
      if (e.code === "Space" && target.closest("button, a")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (started) setPaused((p) => !p);
        return;
      }
      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.code === "Escape") {
        setGuide(false);
        return;
      }
      const map: Record<string, ToolId> = {
        Digit1: E.SAND,
        Digit2: E.WATER,
        Digit3: E.FIRE,
        Digit4: E.PLANT,
        Digit5: E.STONE,
        Digit6: E.LAVA,
        Digit7: E.OIL,
        Digit8: E.SEED,
        Digit9: E.CRITTER,
        Digit0: ERASER,
      };
      const next = map[e.code];
      if (next !== undefined) setTool(next);
      if (e.code === "BracketLeft") setBrush((b) => BRUSHES[Math.max(0, BRUSHES.indexOf(b) - 1)] ?? 1);
      if (e.code === "BracketRight")
        setBrush((b) => BRUSHES[Math.min(BRUSHES.length - 1, BRUSHES.indexOf(b) + 1)] ?? 11);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim, started, guide, undo]);

  const onStats = useCallback(
    (g: number) => {
      setGrains(g);
      if (!startedRef.current) return;
      const r = sim.lastReaction;
      if (r && !seen.current.has(r)) {
        seen.current.add(r);
        const rec = RECIPES.find((x) => x.id === r);
        if (rec) {
          setToast(rec.title);
          if (r === "sprout" || r === "freeze" || r === "birth") pondAudio.pop(r === "freeze" ? "freeze" : r === "birth" ? "birth" : "sprout");
          if (r === "boom") pondAudio.boom();
          window.setTimeout(() => setToast((t) => (t === rec.title ? null : t)), 1600);
        }
      }
    },
    [sim],
  );

  const begin = () => {
    pondAudio.unlock();
    setStarted(true);
  };

  const stamp = (id: SceneId) => {
    checkpoint();
    loadScene(sim, id);
    setScene(id);
    setPaused(false);
  };

  const shake = () => {
    checkpoint();
    sim.shake();
    pondAudio.unlock();
    pondAudio.shake();
  };

  const clear = () => {
    checkpoint();
    sim.clearInterior();
    setScene("blank");
    setToast("Dish cleared. Undo brings it back.");
  };

  const exportWorld = () => {
    const url = URL.createObjectURL(new Blob([encodeWorld(sim)], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pond-world.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaveMessage("World exported. Import this file to pick up here again.");
  };

  const importWorld = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error("That save is too large.");
      const bytes = decodeWorld(await file.text(), sim);
      checkpoint();
      sim.restore(bytes);
      setPaused(true);
      setSaveMessage("World imported and paused. Press Play to continue.");
    } catch {
      setSaveMessage("That file isn't a valid Pond world. Your current dish is still here.");
    } finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const selected = toolById(tool);

  return (
    <main className="relative flex min-h-dvh flex-col bg-bg text-fg">
      {started ? (
        <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-medium tracking-tight leading-tight sm:text-2xl">Pond</h1>
          <a href="/games/" className="text-muted text-xs underline">← the desk</a>
          <p className="text-muted text-sm tabular-nums">{grains.toLocaleString()} grains</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="quiet"
            size="icon"
            className="size-11"
            aria-label={paused ? "Play" : "Pause"}
            onClick={() => setPaused((p) => !p)}
          >
            <span className="relative size-5">
              <Pause
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  paused ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none",
                )}
              />
              <Play
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  paused ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
                )}
              />
            </span>
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-11"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              pondAudio.unlock();
              setMuted((m) => !m);
            }}
          >
            <span className="relative size-5">
              <Volume2
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  muted ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none",
                )}
              />
              <VolumeX
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  muted ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
                )}
              />
            </span>
          </Button>
          <Button
            variant="quiet"
            size="icon"
            className="size-11"
            aria-label="Open mixes"
            aria-pressed={guide}
            onClick={() => setGuide((g) => !g)}
          >
            <BookOpen className="size-5" />
          </Button>
        </div>
      </header>
      ) : (
        <div className="h-[max(0.75rem,env(safe-area-inset-top))]" />
      )}

      <div className="flex flex-1 items-center justify-center px-3 py-2">
        <div
          className="relative w-full max-w-[min(100%,36rem,72dvh)] aspect-square rounded-full bg-dish p-2"
          style={{ boxShadow: "var(--shadow-dish)" }}
        >
          <div className="absolute inset-2 overflow-hidden rounded-full bg-dish-well">
            <PondCanvas
              sim={sim}
              tool={tool}
              brush={brush}
              running={started}
              onStats={onStats}
              onStrokeStart={checkpoint}
              className="size-full"
            />
          </div>
          {toast ? (
            <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-md bg-surface px-3 py-1.5 text-sm text-fg shadow-[0_0_0_1px_var(--color-border)] pond-enter">
              {toast}
            </div>
          ) : null}
        </div>
      </div>

      {started ? (
      <div className="px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SCENES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => stamp(s.id)}
                className={cn(
                  "h-9 shrink-0 rounded-md px-3 text-sm transition-colors duration-150",
                  scene === s.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-surface p-2 shadow-[0_0_0_1px_var(--color-border)]">
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {PALETTE.map((item) => {
                const on = tool === item.id;
                return (
                  <button
                    key={item.name}
                    type="button"
                    title={item.blurb}
                    aria-label={item.name}
                    aria-pressed={on}
                    onClick={() => setTool(item.id)}
                    className={cn(
                      "flex h-11 flex-col items-center justify-center gap-1 rounded-md transition-[background-color,box-shadow,transform] duration-150",
                      on ? "bg-surface-2 shadow-[0_0_0_1px_var(--color-border-strong)]" : "hover:bg-surface-2/60",
                    )}
                  >
                    <span
                      className={cn(
                        "size-4 rounded-full shadow-[0_0_0_1px_rgb(255_255_255/12%)]",
                        item.swatch,
                        item.id === WIND && "flex items-center justify-center",
                      )}
                    >
                      {item.id === WIND ? <Wind className="size-2.5 text-accent-fg" /> : null}
                    </span>
                    <span className={cn("text-[10px] leading-none", on ? "text-fg" : "text-muted")}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-11 flex-1 items-center gap-1 rounded-md bg-surface px-2 shadow-[0_0_0_1px_var(--color-border)]">
              {BRUSHES.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-label={`Brush ${b}`}
                  onClick={() => setBrush(b)}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center rounded-sm transition-colors duration-150",
                    brush === b ? "bg-surface-2" : "hover:bg-surface-2/50",
                  )}
                >
                  <span
                    className="rounded-full bg-fg"
                    style={{ width: 4 + b, height: 4 + b, opacity: brush === b ? 1 : 0.4 }}
                  />
                </button>
              ))}
            </div>
            <Button variant="quiet" size="icon" aria-label="Undo" disabled={!canUndo} onClick={undo}>
              <Undo2 className="size-4" />
            </Button>
            <Button variant="quiet" className="h-11 px-3" onClick={shake}>
              Shake
            </Button>
            <Button variant="quiet" size="icon" className="size-11" aria-label="Clear dish" onClick={clear}>
              <RotateCcw className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="quiet" size="sm" onClick={exportWorld}>Export world</Button>
            <Button variant="quiet" size="sm" onClick={() => fileRef.current?.click()}>Import world</Button>
            <a href="/games/" className="inline-flex min-h-11 items-center px-3 text-sm text-muted underline">Back to games</a>
            <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Import Pond world" className="hidden" onChange={(e) => void importWorld(e.target.files?.[0])} />
          </div>
          <p role="status" className="text-center text-xs text-muted">{saveMessage}</p>
          <p className="min-h-5 text-center text-sm text-muted">
            <span className="text-fg">{selected.name}</span>
            <span className="mx-1.5 text-subtle">·</span>
            {HINTS[hintIndex]}
          </p>
        </div>
      </div>
      ) : null}

      {guide ? (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-bg/70 p-3 sm:items-center"
          onClick={() => setGuide(false)}
        >
          <div
            ref={guideRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mixes"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") setGuide(false);
              if (e.key === "Tab") { e.preventDefault(); guideRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
            }}
            className="max-h-[85dvh] overflow-y-auto w-full max-w-md rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border),0_24px_48px_rgb(0_0_0/40%)] pond-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-medium tracking-tight">Mixes</h2>
                <p className="mt-1 text-sm text-muted">Things to try. Nothing is required.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGuide(false)}>
                Close
              </Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {RECIPES.map((r) => (
                <li key={r.id}>
                  <p className="text-sm font-medium text-fg">{r.title}</p>
                  <p className="text-sm text-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <footer className="px-3 pb-3 text-center text-xs text-muted">Originally built with Grok · developed for the desk</footer>
      {!started ? (
        <div
          className="absolute inset-0 z-30 w-full flex flex-col items-center justify-center bg-bg/62 px-6 text-center"
        >
          <h1 className="pond-enter font-display text-6xl font-medium tracking-tight sm:text-7xl">Pond</h1>
          <p className="pond-enter pond-enter-2 mt-3 max-w-sm text-base text-muted leading-snug">
            Paint a tiny world of sand, water, fire, and growing things.
          </p>
          <button type="button" onClick={begin} className="pond-enter pond-enter-3 mt-8 inline-flex h-12 items-center rounded-lg bg-accent px-7 text-base font-medium text-accent-fg">
            Make a mess
          </button>
          <p className="pond-enter pond-enter-4 mt-4 text-sm text-subtle">Finger or mouse. No score.</p>
        </div>
      ) : null}
    </main>
  );
}
