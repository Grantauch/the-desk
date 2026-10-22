import { useEffect, useRef, useState } from "react";
import { COLS, ERASER, ROWS, WIND, type ToolId } from "@/lib/pond/elements";
import { pondAudio } from "@/lib/pond/audio";
import type { PondSim } from "@/lib/pond/sim";
import { cn } from "@/lib/utils";

type PondCanvasProps = {
  sim: PondSim;
  tool: ToolId;
  brush: number;
  running: boolean;
  className?: string;
  onStats?: (grains: number, fire: number) => void;
  onStrokeStart?: () => void;
};

export function PondCanvas({ sim, tool, brush, running, className, onStats, onStrokeStart }: PondCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const painting = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef(tool);
  const brushRef = useRef(brush);
  const runningRef = useRef(running);
  const onStatsRef = useRef(onStats);
  const onStrokeRef = useRef(onStrokeStart);
  const cursor = useRef({ x: COLS / 2, y: ROWS / 2 });
  const [position, setPosition] = useState(cursor.current);
  const [focused, setFocused] = useState(false);
  toolRef.current = tool;
  brushRef.current = brush;
  runningRef.current = running;
  onStatsRef.current = onStats;
  onStrokeRef.current = onStrokeStart;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = COLS;
    canvas.height = ROWS;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const image = ctx.createImageData(COLS, ROWS);
    let raf = 0;
    let acc = 0;
    let lastT = performance.now();
    let statsAt = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const STEP = 1000 / 45;
    const MAX_DT = 100;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { lastT = now; acc = 0; pondAudio.setFireLevel(0); return; }
      let dt = now - lastT;
      lastT = now;
      if (dt > MAX_DT) dt = MAX_DT;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 2) {
        if (runningRef.current) sim.step();
        acc -= STEP;
        steps++;
      }
      sim.render(image);
      ctx.putImageData(image, 0, 0);
      const wrap = wrapRef.current;
      if (wrap) {
        const shake = reduce.matches ? 0 : sim.trauma * sim.trauma;
        const ox = shake ? (Math.random() * 2 - 1) * shake * 7 : 0;
        const oy = shake ? (Math.random() * 2 - 1) * shake * 7 : 0;
        wrap.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
      }
      pondAudio.setFireLevel(sim.paused || !runningRef.current ? 0 : sim.fireCount);
      if (now - statsAt > 200) {
        statsAt = now;
        onStatsRef.current?.(sim.grainCount, sim.fireCount);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCell = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
      const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
      return { x, y };
    };

    const apply = (clientX: number, clientY: number) => {
      const { x, y } = toCell(clientX, clientY);
      cursor.current = { x, y };
      setPosition({ x, y });
      const t = toolRef.current;
      const r = brushRef.current;
      if (t === WIND) {
        const prev = last.current;
        if (prev) sim.wind(x, y, x - prev.x, y - prev.y, r);
      } else if (t === ERASER) {
        sim.paint(x, y, 0, r);
      } else {
        sim.paint(x, y, t, r);
      }
      last.current = { x, y };
      pondAudio.paint(t === ERASER ? 0 : t, x / COLS);
    };

    const down = (e: PointerEvent) => {
      if (!runningRef.current) return;
      if (e.button !== undefined && e.button !== 0) return;
      painting.current = true;
      onStrokeRef.current?.();
      last.current = null;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      pondAudio.unlock();
      apply(e.clientX, e.clientY);
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (!painting.current) return;
      apply(e.clientX, e.clientY);
      e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      painting.current = false;
      last.current = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    const contextMenu = (e: MouseEvent) => e.preventDefault();
    canvas.addEventListener("contextmenu", contextMenu);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("contextmenu", contextMenu);
    };
  }, [sim]);

  return (
    <div ref={wrapRef} className={cn("relative will-change-transform", className)}>
      <canvas
        ref={canvasRef}
        width={COLS}
        height={ROWS}
        className="pixelated block size-full rounded-full touch-none select-none"
        aria-label="Living dish. Draw to paint. Keyboard: arrows move the brush, Enter paints."
        role="application"
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] };
          const move = moves[event.key];
          if (move) {
            event.preventDefault();
            cursor.current = { x: Math.max(2, Math.min(COLS - 3, cursor.current.x + move[0])), y: Math.max(2, Math.min(ROWS - 3, cursor.current.y + move[1])) };
            setPosition(cursor.current);
          }
          if (event.key === "Enter" && runningRef.current && !event.repeat) {
            event.preventDefault();
            onStrokeRef.current?.();
            const { x, y } = cursor.current;
            if (toolRef.current === WIND) sim.wind(x, y, 2, -1, brushRef.current);
            else sim.paint(x, y, toolRef.current === ERASER ? 0 : toolRef.current, brushRef.current);
          }
        }}
      />
      {focused && <span aria-hidden="true" className="pointer-events-none absolute size-3 rounded-full border border-white" style={{left: `${position.x / COLS * 100}%`, top: `${position.y / ROWS * 100}%`, transform: "translate(-50%, -50%)"}} />}
    </div>
  );
}
