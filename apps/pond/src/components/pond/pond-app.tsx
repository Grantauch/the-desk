import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  FlaskConical,
  Leaf,
  Map,
  Sparkles,
  Layers3,
  Download,
  Upload,
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
import { DiscoveryGlyph } from "@/components/pond/discovery-glyph";
import { WorldAtlas } from "@/components/pond/world-atlas";
import { blankAtlas, revealAtlas, expandAtlas, type AtlasState } from "@/lib/pond/atlas";
import { PondEcosystem, MAX_RESIDENTS, residentProfile, type ResidentSave } from "@/lib/pond/ecosystem";
import {
  STARTERS, OUTCOME_SPACE, MAX_DISCOVERIES, DISCOVERY_STORAGE_KEY,
  combine, getOutcome, paintMaterial, restoreDiscoveries,
} from "@/lib/pond/discovery";
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
import { PondSim, POND_SIZES, SCENES, loadScene, type PondSize, type SceneId } from "@/lib/pond/sim";
import { initialCamera, clampCamera, expandCamera, panCamera, zoomCamera, type PondCamera } from "@/lib/pond/camera";
import { cn } from "@/lib/utils";
import { decodePondAnySize, encodeWorld, MAX_SAVE_BYTES, WORLD_KEY } from "@/lib/pond/save";

const BRUSHES = [1, 2, 4, 7, 11];
const QUICK_TOOLS: ToolId[] = [E.WATER, E.SAND, E.PLANT, E.FIRE, ERASER];

export function PondApp() {
  const sim = useMemo(() => {
    const s = new PondSim();
    loadScene(s, "garden");
    return s;
  }, []);
  const ecosystem = useMemo(() => new PondEcosystem(), []);
  const undoRef = useRef<Array<{ size: PondSize; world: Uint8Array; residents: ResidentSave[]; camera: PondCamera; atlas: AtlasState }>>([]);
  const [pondSize, setPondSize] = useState<PondSize>(192);
  const [camera, setCamera] = useState<PondCamera>(() => initialCamera(192));
  const [atlas, setAtlas] = useState<AtlasState>(() => revealAtlas(blankAtlas(192), initialCamera(192)));
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasRevision, setAtlasRevision] = useState(0);
  const lastAtlasRefresh = useRef(0);
  const [panMode, setPanMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const dishRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [saveMessage, setSaveMessage] = useState("Saves in this browser. Export to keep a copy.");
  const [started, setStarted] = useState(false);
  const [tool, setTool] = useState<ToolId>(E.SAND);
  const [brush, setBrush] = useState(4);
  const [specimenId, setSpecimenId] = useState<string | null>(null);
  const [residentCount, setResidentCount] = useState(0);
  const [ecosystemNews, setEcosystemNews] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [richGraphics, setRichGraphics] = useState(true);
  const [guide, setGuide] = useState(false);
  const [discovered, setDiscovered] = useState<string[]>([...STARTERS]);
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false);
  const [firstMix, setFirstMix] = useState<string | null>(null);
  const [mixSearch, setMixSearch] = useState("");
  const [showAllDiscoveries, setShowAllDiscoveries] = useState(false);
  // The mobile Field Station shows one real panel at a time; desktop keeps
  // the complete three-column workbench. This UI-only choice is not saved.
  const [mobilePane, setMobilePane] = useState<"materials" | "discoveries" | "world" | "atlas" | "archive">("materials");
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [lastMix, setLastMix] = useState("Pick two discoveries. Familiar mixes make familiar things; other pairs can make new species.");
  const [scene, setScene] = useState<SceneId | "custom">("garden");
  const [grains, setGrains] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const startedRef = useRef(false);
  startedRef.current = started;

  const checkpoint = useCallback(() => {
    const undoLimit = sim.w > 320 ? 5 : 20;
    undoRef.current = [
      ...undoRef.current.slice(-(undoLimit - 1)),
      { size: sim.w as PondSize, world: sim.snapshot(), residents: ecosystem.snapshot(), camera, atlas },
    ];
    setCanUndo(true);
    setScene("custom");
  }, [sim, ecosystem, camera, atlas]);

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    sim.resize(previous.size);
    sim.restore(previous.world);
    ecosystem.restore(previous.residents, sim);
    setPondSize(previous.size);
    setCamera(previous.camera);
    setAtlas(previous.atlas);
    setResidentCount(ecosystem.count);
    setScene("custom");
    setCanUndo(undoRef.current.length > 0);
    setPaused(true);
    setToast("Undone. Paused so you can inspect it.");
  }, [sim, ecosystem]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("pond-muted") !== "0");
      setRichGraphics(localStorage.getItem("pond-rich-graphics") !== "0");
      let savedDiscoveries: unknown = null;
      let legacyDiscoveries: unknown = null;
      try {
        const current = localStorage.getItem(DISCOVERY_STORAGE_KEY);
        const previous = localStorage.getItem("pond-discoveries-v1");
        if (current) savedDiscoveries = JSON.parse(current);
        if (previous) legacyDiscoveries = JSON.parse(previous);
      } catch { /* malformed discovery saves cannot affect the pond */ }
      setDiscovered(restoreDiscoveries(savedDiscoveries, legacyDiscoveries));
      setDiscoveryLoaded(true);
      const saved = localStorage.getItem(WORLD_KEY);
      if (saved) {
        const restored = decodePondAnySize(saved);
        sim.resize(restored.size);
        sim.restore(restored.particles);
        ecosystem.restore(restored.residents, sim);
        setPondSize(restored.size);
        const startingCamera = initialCamera(restored.size);
        setCamera(startingCamera);
        const restoredAtlas = restored.atlas ?? revealAtlas(blankAtlas(restored.size), startingCamera);
        atlasRef.current = restoredAtlas;
        setAtlas(restoredAtlas);
        setAtlasOpen(restored.size > 320);
        setResidentCount(ecosystem.count);
        setScene("custom");
        setPaused(true);
        setSaveMessage("Your saved world is ready. Press Play when you want it to move.");
      }
    } catch {
      setSaveMessage("A previous save could not be loaded. Your new dish is ready.");
    }
    const save = () => {
      if (!startedRef.current) return;
      try { localStorage.setItem(WORLD_KEY, encodeWorld(sim, ecosystem.snapshot(), atlasRef.current)); }
      catch { setSaveMessage("Browser saving is unavailable. Use Export world to keep this dish."); }
    };
    const hide = () => { if (document.hidden) save(); };
    const interval = window.setInterval(save, 16000);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => {
      save();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [sim, ecosystem]);

  useEffect(() => {
    setAtlas((current) => current.worldSize === pondSize ? revealAtlas(current, camera) : current);
  }, [camera, pondSize]);

  useEffect(() => {
    if (!discoveryLoaded) return;
    try { localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(discovered)); }
    catch { /* session discoveries remain usable if storage is disabled */ }
  }, [discovered, discoveryLoaded]);

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
      if (next !== undefined) { setTool(next); setSpecimenId(null); }
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
      setResidentCount(ecosystem.count);
      setEcosystemNews(ecosystem.lastInteraction);
      if (Date.now() - lastAtlasRefresh.current > 1200) {
        lastAtlasRefresh.current = Date.now();
        setAtlasRevision((value) => value + 1);
      }
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
    [sim, ecosystem],
  );

  const begin = () => {
    pondAudio.unlock();
    setStarted(true);
  };

  const stamp = (id: SceneId) => {
    checkpoint();
    loadScene(sim, id);
    ecosystem.clear();
    setResidentCount(0);
    setEcosystemNews(null);
    setAtlas(revealAtlas(blankAtlas(pondSize), camera));
    setScene(id);
    setPaused(false);
  };

  const shake = () => {
    checkpoint();
    sim.shake();
    pondAudio.unlock();
    pondAudio.shake();
  };

  const nextSize = POND_SIZES[POND_SIZES.indexOf(pondSize) + 1] ?? null;
  const panBy = (dx: number, dy: number) => {
    setCamera((before) => panCamera(pondSize, before, dx, dy));
  };
  const zoomBy = (direction: "in" | "out") => {
    setCamera((before) => zoomCamera(pondSize, before, direction));
  };
  const expandPond = () => {
    if (!nextSize) return;
    checkpoint();
    const offset = sim.resize(nextSize);
    ecosystem.translate(offset, offset, sim);
    setAtlas((previous) => expandAtlas(previous, nextSize));
    setCamera((before) => expandCamera(before, pondSize, nextSize));
    setPondSize(nextSize);
    setResidentCount(ecosystem.count);
    setScene("custom");
    if (nextSize > 320) { setPanMode(true); setAtlasOpen(true); }
    setToast("World expanded! Drag in Explore mode to discover the new territory.");
  };

  const clear = () => {
    checkpoint();
    sim.clearInterior();
    ecosystem.clear();
    setResidentCount(0);
    setEcosystemNews(null);
    setAtlas(revealAtlas(blankAtlas(pondSize), camera));
    setScene("blank");
    setToast("Dish cleared. Undo brings it back.");
  };

  const exportWorld = () => {
    const url = URL.createObjectURL(new Blob([encodeWorld(sim, ecosystem.snapshot(), atlasRef.current)], {type: "application/json"}));
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
      const restored = decodePondAnySize(await file.text());
      checkpoint();
      sim.resize(restored.size);
      sim.restore(restored.particles);
      ecosystem.restore(restored.residents, sim);
      setPondSize(restored.size);
      const startingCamera = initialCamera(restored.size);
      setCamera(startingCamera);
      setAtlas(restored.atlas ?? revealAtlas(blankAtlas(restored.size), startingCamera));
      setAtlasOpen(restored.size > 320);
      setPanMode(restored.size > 320);
      setResidentCount(ecosystem.count);
      setSpecimenId(null);
      setPaused(true);
      setSaveMessage("World imported and paused. Press Play to continue.");
    } catch {
      setSaveMessage("That file isn't a valid Pond world. Your current dish is still here.");
    } finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const jumpToAtlas = (x: number, y: number) => {
    setCamera((old) => clampCamera(pondSize, {
      ...old, x: x - old.size / 2, y: y - old.size / 2,
    }));
    if (pondSize > 320) setPanMode(true);
  };

  const mapResidents = useMemo(() => ecosystem.snapshot(), [ecosystem, atlasRevision, residentCount]);

  const placeSpecimen = (id: string, x: number, y: number) => {
    if (ecosystem.count >= MAX_RESIDENTS) {
      setToast("The pond is full. Clear or undo to make more room.");
      return;
    }
    if (!sim.inBounds(x, y) || !sim.inDish(x, y) || sim.locked[sim.idx(x, y)]) return;
    checkpoint();
    if (ecosystem.add(id, x, y, sim)) {
      setResidentCount(ecosystem.count);
      setToast((getOutcome(id)?.name ?? "Discovery") + " is now in the pond!");
    }
  };

  const chooseMix = (id: string) => {
    if (!firstMix) {
      setFeaturedId(id);
      setFirstMix(id);
      setLastMix("Choose a second discovery to combine with " + (getOutcome(id)?.name ?? id) + ".");
      return;
    }
    const result = combine(firstMix, id);
    if (!result) {
      setLastMix("That combination could not be made.");
      setFirstMix(null);
      return;
    }
    const firstName = getOutcome(firstMix)?.name ?? firstMix;
    const secondName = getOutcome(id)?.name ?? id;
    const alreadyKnown = discovered.includes(result.id);
    setDiscovered((previous) => {
      if (previous.includes(result.id)) return previous;
      const history = previous.length >= MAX_DISCOVERIES
        ? [...STARTERS, ...previous.filter((value) => !STARTERS.some((root) => root === value)).slice(-(MAX_DISCOVERIES - STARTERS.length - 1))]
        : previous;
      return [...history, result.id];
    });
    setFeaturedId(result.id);
    setLastMix(firstName + " + " + secondName + " = " + result.name +
      (alreadyKnown ? " (already discovered)" : " — new discovery!"));
    setFirstMix(null);
  };

  const visibleDiscoveries = useMemo(() => {
    const needle = mixSearch.trim().toLowerCase();
    return discovered.slice().reverse()
      .map((id) => getOutcome(id))
      .filter((outcome): outcome is NonNullable<ReturnType<typeof getOutcome>> => outcome !== null)
      .filter((outcome) => !needle || outcome.name.toLowerCase().includes(needle))
      .slice(0, mixSearch.trim() || showAllDiscoveries ? 72 : 12);
  }, [discovered, mixSearch, showAllDiscoveries]);
  const featured = featuredId ? getOutcome(featuredId) : null;
  const featuredProfile = featured ? residentProfile(featured) : null;

  const toggleGraphics = () => {
    setRichGraphics((current) => {
      const next = !current;
      try { localStorage.setItem("pond-rich-graphics", next ? "1" : "0"); } catch { /* optional */ }
      return next;
    });
  };

  // These buttons connect existing systems; they never mutate the simulation.
  const jumpToStation = (station: "materials" | "discoveries" | "inhabitants" | "atlas" | "archive" | "world-controls" | "atlas-map") => {
    const nextPane = station === "materials" ? "materials"
      : station === "discoveries" || station === "inhabitants" ? "discoveries"
      : station === "archive" ? "archive"
      : station === "world-controls" ? "world"
      : station === "atlas-map" ? "atlas"
      : pondSize === 192 ? "world" : "atlas";
    setMobilePane(nextPane);
    if (nextPane === "atlas") setAtlasOpen(true);
    const targetId = station === "materials" ? "pond-field-kit"
      : station === "archive" ? "pond-field-archive"
      : station === "world-controls" ? "pond-world-controls"
      : station === "atlas-map" ? "pond-field-atlas"
      : station === "atlas" ? (pondSize === 192 ? "pond-world-controls" : "pond-field-atlas")
      : station === "inhabitants" && specimenId ? "pond-field-canvas"
      : station === "inhabitants" && featured ? "pond-place-action"
      : "pond-discovery-lab";
    // Wait for React to reveal the selected pane before moving focus. Both
    // frames are bounded to direct user gestures, not a polling effect.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = targetId === "pond-field-canvas"
        ? dishRef.current?.querySelector<HTMLCanvasElement>("canvas")
        : document.getElementById(targetId);
      target?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
      target?.focus({ preventScroll: true });
    }));
  };
  const suggestedStation = discovered.length <= STARTERS.length ? "discoveries"
    : residentCount === 0 ? "inhabitants"
    : pondSize === 192 ? "atlas" : "archive";
  const suggestedText = suggestedStation === "discoveries"
    ? "Combine two discoveries to see what emerges."
    : suggestedStation === "inhabitants"
    ? "Choose a discovery and place it in the living pond."
    : suggestedStation === "atlas"
    ? "Expand the world, then open the Atlas to explore."
    : "Keep exploring. Export a copy when you want to take this world with you.";
  const paneLabel = {
    materials: "Field kit · paint",
    discoveries: "Discovery lab · combine",
    world: "World controls · shape",
    atlas: "World atlas · explore",
    archive: "Field archive · preserve",
  }[mobilePane];
  const selected = toolById(tool);

  return (
    <main className={cn("pond-environment field-station min-h-dvh bg-bg text-fg", !richGraphics && "pond-classic")} data-mobile-pane={mobilePane}>
      <div className="field-ambient-grain" aria-hidden="true" />
      {started ? (
        <header className="field-masthead">
          <div className="field-brand">
            <span className="field-brand-emblem" aria-hidden="true"><span className="field-monogram">P</span></span>
            <div>
              <p className="field-eyebrow">A SMALL PLACE FOR BIG EXPERIMENTS</p>
              <h1 className="field-brand-title">Pond<span className="field-brand-period">.</span></h1>
            </div>
          </div>
          <div className="field-masthead-meta" aria-label="World statistics">
            <span><span className="field-led-light" /> {paused ? "WORLD PAUSED" : "WORLD IN MOTION"}</span>
            <span>{discovered.length.toLocaleString()} <small>discoveries</small></span>
            <span>{residentCount} <small>living residents</small></span>
          </div>
          <div className="field-header-actions">
            <a href="/games/" className="field-return-link">← The Desk</a>
            <Button variant="quiet" size="icon" className="field-header-action" aria-label={paused ? "Play" : "Pause"} title={paused ? "Resume simulation" : "Pause simulation"} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play size={17}/> : <Pause size={17}/>}
            </Button>
            <Button variant="quiet" size="icon" className="field-header-action" aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Enable sound" : "Mute sound"} onClick={() => { pondAudio.unlock(); setMuted((m) => !m); }}>
              {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
            </Button>
            <Button variant="quiet" size="icon" className="field-header-action" aria-label="Open mixes" title="Recipe notebook" aria-pressed={guide} onClick={() => setGuide((g) => !g)}>
              <BookOpen size={18}/>
            </Button>
          </div>
        </header>
      ) : null}

      <div className="field-workspace">
        <section className="field-observation" aria-label="Living pond simulation">
          <div className="field-observation-heading">
            <div>
              <p className="field-eyebrow">THE POND · YOUR LITTLE WORLD</p>
              <h2>Begin with a drop<span className="field-heading-dot">.</span></h2>
              <p className="field-observation-sub">Pour water, scatter sand, and see what takes root.</p>
            </div>
            <span className="field-chamber-stamp" aria-label={`${residentCount} living residents`}><strong>{residentCount}</strong><small>living</small></span>
          </div>
          <div className="field-stage-plinth" ref={dishRef}>
            <span className="field-plinth-tick field-plinth-tick--top" aria-hidden="true">WORLD {pondSize} × {pondSize}</span>
            <span className="field-plinth-tick field-plinth-tick--left" aria-hidden="true">WATER · EARTH · LIFE</span>
            <span className="field-plinth-tick field-plinth-tick--right" aria-hidden="true">VIEW {camera.size} × {camera.size}</span>
            <div className={cn(
              "pond-glass-shell field-dish relative w-full aspect-square bg-dish p-2 transition-[border-radius] duration-300",
              camera.size === pondSize ? "rounded-full" : "rounded-[1.5rem]",
            )} style={{ boxShadow: "var(--shadow-dish)" }}>
              <div className={cn("pond-dish-interior absolute inset-2 overflow-hidden bg-dish-well", camera.size === pondSize ? "rounded-full" : "rounded-[1.1rem]")}>
                <PondCanvas
                  key={pondSize + ":" + camera.size}
                  sim={sim}
                  enhancedGraphics={richGraphics}
                  camera={camera}
                  panMode={panMode}
                  onPan={panBy}
                  ecosystem={ecosystem}
                  specimenId={specimenId}
                  onSpecimenPlace={placeSpecimen}
                  tool={tool}
                  brush={brush}
                  running={started}
                  onStats={onStats}
                  onStrokeStart={checkpoint}
                  className="size-full"
                />
              </div>
              <div aria-hidden="true" className="pond-glass-sheen pointer-events-none absolute inset-2" />
              {toast ? <div role="status" className="field-stage-toast pointer-events-none absolute left-1/2 top-8 z-10 -translate-x-1/2 pond-enter">{toast}</div> : null}
            </div>
            <span className="field-plinth-tick field-plinth-tick--bottom" aria-hidden="true">{discovered.length} DISCOVERIES · {residentCount} INHABITANTS</span>
          </div>
          {started ? (
            <div className="field-status-sill">
              <div className="field-live-state">
                <span className={cn("field-live-pulse", paused && "field-live-pulse--paused")} />
                <span>{paused ? "Simulation paused" : "World in motion"}</span>
              </div>
              <p><strong>{specimenId ? (getOutcome(specimenId)?.name ?? "Discovery") : panMode ? "Explore mode" : selected.name}</strong> <span className="field-status-separator">/</span> {specimenId ? "Tap to place a specimen" : panMode ? "Drag to navigate" : "Paint inside the glass"}</p>
              <span className="field-world-size">{pondSize} × {pondSize} · {grains.toLocaleString()} grains · {residentCount} living creations</span>
            </div>
          ) : null}
          {started ? (
            <nav className="field-route" aria-label="Pond field workflow">
              <div className="field-route-heading">
                <p className="field-eyebrow">FIVE WAYS TO TEND YOUR WORLD</p>
                <p>Your field notes are always nearby. Pick up wherever curiosity takes you.</p>
              </div>
              <div className="field-route-actions" role="group" aria-label="Jump to a Pond station">
                <button type="button" data-current={mobilePane === "materials"} onClick={() => jumpToStation("materials")} aria-label="Go to materials and painting">
                  <Layers3 size={16} aria-hidden="true"/><span>Paint</span>
                </button>
                <button type="button" data-current={mobilePane === "discoveries"} onClick={() => jumpToStation("discoveries")} aria-label="Go to discovery mixing" data-suggested={suggestedStation === "discoveries"}>
                  <FlaskConical size={16} aria-hidden="true"/><span>Discover</span>
                </button>
                <button type="button" onClick={() => jumpToStation("inhabitants")} aria-label="Go to placing living discoveries" data-suggested={suggestedStation === "inhabitants"}>
                  <Leaf size={16} aria-hidden="true"/><span>Populate</span>
                </button>
                <button type="button" data-current={mobilePane === "world" || mobilePane === "atlas"} onClick={() => jumpToStation("atlas")} aria-label="Go to world expansion or Atlas" data-suggested={suggestedStation === "atlas"}>
                  <Map size={16} aria-hidden="true"/><span>Explore</span>
                </button>
                <button type="button" data-current={mobilePane === "archive"} onClick={() => jumpToStation("archive")} aria-label="Go to world backups and imports" data-suggested={suggestedStation === "archive"}>
                  <Download size={16} aria-hidden="true"/><span>Preserve</span>
                </button>
              </div>
              <p className="field-route-suggestion"><strong>A place to start:</strong> {suggestedText} <span>Everything is optional.</span></p>
            </nav>
          ) : null}
          {started && ecosystemNews ? (
            <p className="field-ecosystem-ticker" aria-live="off"><Leaf size={14}/> <span>From the field:</span> {ecosystemNews}</p>
          ) : null}
        </section>

        {started ? (
          <>
            <div className="field-mobile-pane-status" role="status" aria-live="polite">
              <span className="field-eyebrow">YOUR WORKBENCH</span>
              <strong>{paneLabel}</strong>
              <small>Choose any station above to switch tools.</small>
            </div>
            <aside className="field-ledger" aria-label="Discovery notebook">
              <section id="pond-discovery-lab" tabIndex={-1} aria-label="Discovery workbench" className="field-panel field-discovery-panel">
                <div className="field-panel-header">
                  <p className="field-eyebrow">COLLECTED DISCOVERIES</p>
                  <div className="field-panel-heading">
                    <h2>Discovery lab</h2>
                    <FlaskConical size={23} strokeWidth={1.4} aria-hidden="true"/>
                  </div>
                  <p className="field-panel-description">Two discoveries make a third. Every combination leaves a trace.</p>
                </div>
                <div className="field-ledger-number">
                  <span className="field-count">{discovered.length.toLocaleString()} <small>found</small></span>
                  <span className="field-count-note">{OUTCOME_SPACE.toLocaleString()} possible identities</span>
                </div>
                <div className="field-mixing-tray" role="group" aria-label="Crafting slots">
                  <div className={cn("field-mix-slot", firstMix && "field-mix-slot--active")}>
                    <span className="field-slot-number">01 / FIRST ELEMENT</span>
                    <span>{firstMix ? (getOutcome(firstMix)?.name ?? firstMix) : "Choose a discovery"}</span>
                  </div>
                  <span className="field-mix-plus" aria-hidden="true">+</span>
                  <div className="field-mix-slot">
                    <span className="field-slot-number">02 / SECOND ELEMENT</span>
                    <span>{firstMix ? "Choose the next" : "Ready to combine"}</span>
                  </div>
                </div>
                <div className="field-mix-result">
                  {featured ? <DiscoveryGlyph outcome={featured} size={72} className="field-feature-glyph shrink-0" /> :
                    <span className="field-feature-placeholder" aria-hidden="true"><span className="field-unmixed-mark">?</span></span>}
                  <div className="min-w-0">
                    <p className="field-eyebrow">LATEST FIND</p>
                    <p role="status" aria-live="polite" className="field-mix-message">{lastMix}</p>
                  </div>
                </div>
                {featured ? (
                  <div className="field-specimen-actions">
                    <button type="button" onClick={() => {
                      const material = paintMaterial(featured);
                      setTool(material);
                      setSpecimenId(null);
                      setPanMode(false);
                      setLastMix("Brush selected: " + toolById(material).name + ". This is the closest existing physics material; your discovery's identity stays in the lab.");
                    }} className="field-primary-action">
                      <Layers3 size={15} aria-hidden="true"/> Paint using {toolById(paintMaterial(featured)).name}
                    </button>
                    <button type="button" onClick={() => {
                      setSpecimenId(featured.id);
                      setPanMode(false);
                      setLastMix("Place " + featured.name + ": tap or press Enter on the pond to add a living specimen. Each creation moves and affects its surroundings.");
                      if (window.matchMedia("(max-width: 800px)").matches) {
                        window.requestAnimationFrame(() => {
                          const canvas = dishRef.current?.querySelector("canvas");
                          canvas?.scrollIntoView({ block: "center", behavior: "instant" });
                          canvas?.focus({ preventScroll: true });
                        });
                      }
                    }} id="pond-place-action" className="field-secondary-action">
                      <Leaf size={15} aria-hidden="true"/> Place in pond
                    </button>
                    {featuredProfile ? <p className="field-specimen-profile">{featuredProfile.mode} · {featuredProfile.influence} · Size {featuredProfile.size}</p> : null}
                  </div>
                ) : null}
                <div className="field-search-row">
                  <label className="sr-only" htmlFor="pond-discovery-search">Search unlocked discoveries</label>
                  <input id="pond-discovery-search" type="search" value={mixSearch} onChange={(event) => setMixSearch(event.target.value)}
                    placeholder="Search the collection…" aria-label="Search unlocked discoveries" className="field-search-input"/>
                  {firstMix ? <button type="button" className="field-cancel-mix" onClick={() => { setFirstMix(null); setLastMix("Combination canceled."); }}>Cancel</button> : null}
                </div>
                <div className="field-specimen-grid" aria-label="Unlocked discoveries">
                  {visibleDiscoveries.map((outcome) => (
                    <button key={outcome.id} type="button" title={outcome.name} aria-label={"Mix " + outcome.name}
                      aria-pressed={firstMix === outcome.id} onClick={() => chooseMix(outcome.id)}
                      className={cn("field-specimen-card", firstMix === outcome.id && "field-specimen-card--selected")}>
                      <DiscoveryGlyph outcome={outcome} size={39} className="field-specimen-icon shrink-0"/>
                      <span>{outcome.name}</span>
                    </button>
                  ))}
                </div>
                <div className="field-discovery-footer">
                  <p className="field-ledger-footnote">{visibleDiscoveries.length} indexed · Search your discoveries or try mixing a find with itself. The marks are catalog symbols, not pictures of the species.</p>
                  {!mixSearch.trim() && discovered.length > 12 ? (
                    <button type="button" className="field-discovery-more"
                      aria-expanded={showAllDiscoveries} onClick={() => setShowAllDiscoveries(value => !value)}>
                      {showAllDiscoveries ? "Show fewer" : "Show up to 72 recent discoveries"}
                    </button>
                  ) : null}
                </div>
              </section>

              <section id="pond-field-atlas" tabIndex={-1} className="field-panel field-atlas-panel">
                <div className="field-panel-header field-atlas-heading">
                  <p className="field-eyebrow">THE EXPLORER'S MAP</p>
                  <div className="field-panel-heading">
                    <h2>World atlas</h2>
                    <Map size={23} strokeWidth={1.5} aria-hidden="true"/>
                  </div>
                  <p className="field-panel-description">Chart places, inhabitants and wild habitats.</p>
                </div>
                <button type="button" className="field-mobile-pane-jump" onClick={() => jumpToStation("world-controls")}>
                  <Compass size={16} aria-hidden="true"/> Shape or expand the world
                </button>
                <button type="button" className="field-atlas-toggle" aria-label={atlasOpen ? "Hide atlas" : "Open atlas"} aria-expanded={atlasOpen} aria-controls="pond-world-atlas"
                  onClick={() => setAtlasOpen((open) => !open)}>
                  <span>{atlasOpen ? "Fold the map" : "Unfold the map"}</span><span aria-hidden="true">{atlasOpen ? "−" : "+"}</span>
                  
                </button>
                {atlasOpen ? <div id="pond-world-atlas" className="field-atlas-content"><WorldAtlas
                  sim={sim} atlas={atlas} camera={camera} residents={mapResidents}
                  revision={atlasRevision} onJump={jumpToAtlas}/></div> : null}
              </section>
            </aside>

            <aside className="field-materials" aria-label="Materials and world controls">
              <section id="pond-field-kit" tabIndex={-1} className="field-panel field-tool-panel">
                <div className="field-panel-header">
                  <p className="field-eyebrow">MATERIALS · YOUR PALETTE</p>
                  <div className="field-panel-heading">
                    <h2>Field kit</h2>
                    <span className="field-kit-number">18 MATERIALS · 2 TOOLS</span>
                  </div>
                  <p className="field-panel-description">Choose a substance, then paint the world.</p>
                </div>
                <div className="field-palette-grid" role="group" aria-label="Materials">
                  {PALETTE.map((item) => {
                    const on = tool === item.id && !specimenId;
                    return (
                      <button key={item.name} type="button" title={item.blurb} aria-label={item.name} aria-pressed={on}
                        onClick={() => { setTool(item.id); setSpecimenId(null); setPanMode(false); }}
                        className={cn("pond-tool-button field-material-tile", on && "field-material-tile--active")}>
                        <span className={cn("pond-material-swatch field-material-dot", item.swatch, item.id === WIND && "flex items-center justify-center")}>
                          {item.id === WIND ? <Wind size={13} className="text-accent-fg"/> : null}
                        </span>
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
                {specimenId ? <div className="field-placement-banner" role="status">
                  <span><Leaf size={15}/> Placing <strong>{getOutcome(specimenId)?.name}</strong></span>
                  <button type="button" onClick={() => setSpecimenId(null)}>Done placing</button>
                </div> : null}
                <div className="field-brush-kit">
                  <div className="field-subhead"><span>BRUSH DIAMETER</span><span>{brush} PX</span></div>
                  <div className="field-brush-sizes" role="group" aria-label="Brush size">
                    {BRUSHES.map((b) => (
                      <button key={b} type="button" aria-label={"Brush " + b} aria-pressed={brush === b}
                        onClick={() => setBrush(b)} className={cn("field-brush-button", brush === b && "field-brush-button--active")}>
                        <span style={{width: 5 + b, height: 5 + b}}/>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field-utility-actions">
                  <Button variant="quiet" size="sm" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={15}/> Undo</Button>
                  <Button variant="quiet" size="sm" title="Shake the pond" onClick={shake}><Wind size={15}/> Shake</Button>
                  <Button variant="quiet" size="sm" aria-label="Clear dish" onClick={clear}><RotateCcw size={15}/> Clear</Button>
                </div>
              </section>

              <section id="pond-world-controls" tabIndex={-1} className="field-panel field-world-panel">
                <div className="field-panel-header">
                  <p className="field-eyebrow">TERRAIN & EXPLORATION</p>
                  <div className="field-panel-heading"><h2>Shape the world</h2><Compass size={22} strokeWidth={1.5}/></div>
                </div>
                <button type="button" className="field-mobile-pane-jump" onClick={() => jumpToStation("atlas-map")}>
                  <Map size={16} aria-hidden="true"/> Open the world Atlas
                </button>
                <div className="field-scene-presets" aria-label="World presets">
                  {SCENES.map((preset) => (
                    <button key={preset.id} type="button" onClick={() => stamp(preset.id)}
                      aria-pressed={scene === preset.id}
                      className={cn("field-scene-chip", scene === preset.id && "field-scene-chip--active")}>{preset.name}</button>
                  ))}
                </div>
                <div className="field-expand-readout">
                  <div><p className="field-subhead">CURRENT TERRITORY</p>
                    <strong>{pondSize} <span>×</span> {pondSize}</strong>
                    <small>{Math.round(Math.PI * Math.pow(pondSize / 2 - 1, 2)).toLocaleString()} playable cells</small>
                  </div>
                  <button type="button" className="field-expand-button" disabled={!nextSize} onClick={expandPond}>
                    {nextSize ? "Expand pond to " + nextSize + " × " + nextSize : "Maximum pond size"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
                {(pondSize > 320 || camera.size < pondSize) ? (
                  <section aria-label="World navigation" className="field-navigation">
                    <div className="field-nav-top">
                      <svg viewBox="0 0 100 100" width="58" height="58" aria-label="World overview and active viewport" role="img" className="field-nav-overview">
                        <circle cx="50" cy="50" r="48" fill="#182823" stroke="#779181" strokeWidth="1.5"/>
                        <rect x={camera.x / pondSize * 100} y={camera.y / pondSize * 100}
                          width={camera.size / pondSize * 100} height={camera.size / pondSize * 100}
                          fill="#cbddc8" fillOpacity=".18" stroke="#f1d9a1" strokeWidth="1.5" rx="2"/>
                      </svg>
                      <div><p className="field-subhead">VIEWPORT</p>
                        <strong>{camera.size} × {camera.size}</strong>
                        <small>{camera.x}, {camera.y} · Distant regions rest until explored</small>
                      </div>
                    </div>
                    <div className="field-nav-controls">
                      <Button variant={panMode ? "default" : "quiet"} size="sm" aria-pressed={panMode}
                        onClick={() => setPanMode((value) => !value)}>{panMode ? "Explore: on" : "Explore / drag"}</Button>
                      <Button variant="quiet" size="sm" aria-label="Pan world left" onClick={() => panBy(-64, 0)}>←</Button>
                      <Button variant="quiet" size="sm" aria-label="Pan world up" onClick={() => panBy(0, -64)}>↑</Button>
                      <Button variant="quiet" size="sm" aria-label="Pan world down" onClick={() => panBy(0, 64)}>↓</Button>
                      <Button variant="quiet" size="sm" aria-label="Pan world right" onClick={() => panBy(64, 0)}>→</Button>
                      <Button variant="quiet" size="sm" aria-label="Center world view" onClick={() => setCamera(initialCamera(pondSize))}>Center</Button>
                      <Button variant="quiet" size="sm" aria-label="Zoom in" disabled={camera.size === 192} onClick={() => zoomBy("in")}>Zoom +</Button>
                      <Button variant="quiet" size="sm" aria-label="Zoom out" disabled={camera.size === Math.min(320, pondSize)} onClick={() => zoomBy("out")}>Zoom −</Button>
                    </div>
                  </section>
                ) : <p className="field-world-hint">Expand the basin to unlock cartographic navigation.</p>}
                <div className="field-world-footer">
                  <button type="button" aria-label="Rich pixel graphics"
                    aria-pressed={richGraphics} onClick={toggleGraphics} className="field-graphics-toggle">
                    <Sparkles size={15}/> Visuals: {richGraphics ? "Rich" : "Classic"}
                  </button>
                </div>
              </section>
              <section id="pond-field-archive" tabIndex={-1} className="field-panel field-storage-panel">
                <div className="field-panel-header">
                  <p className="field-eyebrow">THE FIELD ARCHIVE</p>
                  <div className="field-panel-heading"><h2>Preserve your pond</h2><BookOpen size={19} strokeWidth={1.5}/></div>
                </div>
                <div className="field-archive-actions">
                  <Button variant="quiet" size="sm" onClick={exportWorld}><Download size={16}/> Export world</Button>
                  <Button variant="quiet" size="sm" onClick={() => fileRef.current?.click()}><Upload size={16}/> Import world</Button>
                  <Button variant="quiet" size="sm" disabled={residentCount === 0} onClick={() => { checkpoint(); if (ecosystem.removeLast()) setResidentCount(ecosystem.count); }}>Remove last resident</Button>
                </div>
                <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Import Pond world"
                  className="sr-only" onChange={(event) => void importWorld(event.target.files?.[0])}/>
                <p role="status" className="field-save-status">{saveMessage}</p>
                <p className="field-hint"><strong>{selected.name}</strong> · {HINTS[hintIndex]}</p>
              </section>
            </aside>
          </>
        ) : null}
      </div>


      {started ? (
        <nav className="field-mobile-dock" aria-label="Quick material tools">
          {QUICK_TOOLS.map((id) => {
            const item = toolById(id);
            return (
              <button key={id} type="button" aria-label={"Quick " + item.name} title={"Paint " + item.name}
                aria-pressed={tool === id && !specimenId}
                onClick={() => { setTool(id); setSpecimenId(null); setPanMode(false); }}
                className={cn("field-mobile-dock-tool", tool === id && !specimenId && "field-mobile-dock-tool--active")}>
                <span className={cn("pond-material-swatch field-mobile-dock-color", item.swatch)} aria-hidden="true"/>
                <span>{item.name}</span>
              </button>
            );
          })}
          <button type="button" className="field-mobile-dock-more" aria-label="Open full material kit"
            onClick={() => jumpToStation("materials")}>
            <Layers3 size={20} aria-hidden="true"/><span>All tools</span>
          </button>
        </nav>
      ) : null}

      {guide ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#07100f]/85 p-3 sm:items-center" onClick={() => setGuide(false)}>
          <div ref={guideRef} role="dialog" aria-modal="true" aria-label="Mixes" tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") setGuide(false);
              if (event.key === "Tab") { event.preventDefault(); guideRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
            }}
            className="field-recipe-dialog pond-enter max-h-[85dvh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}>
            <div className="field-panel-heading mb-3">
              <div><p className="field-eyebrow">THE POND RECIPE BOOK</p><h2 className="text-2xl font-display">Things to try</h2></div>
              <Button variant="ghost" size="sm" onClick={() => setGuide(false)}>Close</Button>
            </div>
            <p className="field-panel-description mb-4">These are only the beginning. There are no required recipes.</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {RECIPES.map((recipe) => <li key={recipe.id} className="field-recipe-card">
                <p className="font-medium">{recipe.title}</p><p className="text-sm opacity-75">{recipe.body}</p>
              </li>)}
            </ul>
          </div>
        </div>
      ) : null}

      {!started ? (
        <div className="field-start-overlay">
          <div className="field-start-card pond-enter">
            <span className="field-start-emblem" aria-hidden="true"><Leaf size={30} strokeWidth={1.3}/></span>
            <p className="field-eyebrow">POUR · PLANT · COMBINE · WANDER</p>
            <h1>A little water. <em>A whole world.</em></h1>
            <p>Start with a handful of sand and a drop of water. Then follow whatever grows. There is no score to chase and no wrong way to play.</p>
            <button type="button" onClick={begin} className="field-start-button">Make a mess <span aria-hidden="true">↗</span></button>
            <small>AN OPEN-ENDED WORLD YOU CAN SAVE AND RETURN TO</small>
          </div>
        </div>
      ) : null}
    </main>
  );
}
