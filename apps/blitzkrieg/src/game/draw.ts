import { CELL, COLS, ENEMIES, PROPS, ROWS, TOWERS, WAYPOINTS, WORLD_H, WORLD_W, type TowerKind } from "./data";
import type { Game } from "./game";

const CREAM = "#f4ead7";
const CRIMSON = "#c8102e";
const BRASS = "#d4a017";
const INK = "#14110e";

export function paint(game: Game, ctx: CanvasRenderingContext2D): void {
  const { cssW, cssH, dpr, camX, camY, camZoom } = game;
  const viewW = WORLD_W / camZoom;
  const viewH = WORLD_H / camZoom;
  const scale = Math.min(cssW / viewW, cssH / viewH);
  const ox = (cssW - viewW * scale) / 2;
  const oy = (cssH - viewH * scale) / 2;
  const shake = game.reduce ? 0 : Math.sin(performance.now() * 0.05) * game.shake;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.translate(ox + shake, oy);
  ctx.scale(scale, scale);
  ctx.translate(-(camX - viewW / 2), -(camY - viewH / 2));

  const terrain = game.images.get("terrain");
  if (terrain) ctx.drawImage(terrain, 0, 0, WORLD_W, WORLD_H);
  else {
    ctx.fillStyle = "#6a6238";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  ctx.fillStyle = "rgba(20, 16, 12, 0.12)";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  drawRoad(ctx);
  drawProps(game, ctx);

  if (game.armed && game.phase !== "briefing") drawBuildGrid(game, ctx);

  const manned = game.towers.find((t) => t.id === game.mannedId);
  const selected = game.towers.find((t) => t.id === game.selectedId);
  if (game.armed && game.hover && game.phase !== "briefing" && game.phase !== "victory" && game.phase !== "defeat") {
    drawRange(ctx, (game.hover.c + 0.5) * CELL, (game.hover.r + 0.5) * CELL, TOWERS[game.armed].range, TOWERS[game.armed].minRange, true);
    drawSprite(ctx, game, `tower-${game.armed}`, (game.hover.c + 0.5) * CELL, (game.hover.r + 0.5) * CELL, CELL * 1.05, -Math.PI / 2, game.canBuild(game.hover.c, game.hover.r) ? 0.75 : 0.35);
  }
  if (selected) {
    drawRange(ctx, selected.x, selected.y, TOWERS[selected.kind].range, TOWERS[selected.kind].minRange, false);
  }

  const layers: { y: number; draw: () => void }[] = [];
  for (const e of game.creeps) {
    const visual = creepVisual(e);
    layers.push({ y: visual.y, draw: () => drawCreep(game, ctx, e) });
  }
  for (const t of game.towers) {
    layers.push({ y: t.y, draw: () => drawTower(game, ctx, t) });
  }
  layers.sort((a, b) => a.y - b.y);
  for (const layer of layers) layer.draw();

  for (const shot of game.shots) drawShot(game, ctx, shot);
  for (const boom of game.booms) drawBoom(game, ctx, boom);
  drawParticles(game, ctx);
  drawFloaters(ctx, game);

  if (manned) {
    const def = TOWERS[manned.kind];
    const dist = Math.hypot(game.aim.x - manned.x, game.aim.y - manned.y);
    const ok = dist <= def.range && dist >= def.minRange;
    ctx.save();
    ctx.translate(game.aim.x, game.aim.y);
    ctx.strokeStyle = ok ? BRASS : CRIMSON;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(200, 16, 46, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(manned.x, manned.y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (game.flash > 0 && game.phase !== "briefing") {
    ctx.fillStyle = `rgba(200, 16, 46, ${Math.min(0.35, game.flash * 0.28)})`;
    ctx.fillRect(0, 0, cssW, cssH);
  }
  if (manned) {
    const g = ctx.createRadialGradient(cssW / 2, cssH / 2, cssW * 0.2, cssW / 2, cssH / 2, cssW * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(12, 8, 6, 0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }
}

function drawRoad(ctx: CanvasRenderingContext2D): void {
  if (WAYPOINTS.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#5a4328";
  ctx.lineWidth = CELL * 0.78;
  strokePath(ctx);
  ctx.strokeStyle = "#b08958";
  ctx.lineWidth = CELL * 0.56;
  strokePath(ctx);
  ctx.strokeStyle = "rgba(90, 67, 40, 0.35)";
  ctx.lineWidth = CELL * 0.08;
  strokePath(ctx);
  ctx.fillStyle = "rgba(36, 24, 14, 0.55)";
  for (let i = 2; i < WAYPOINTS.length - 1; i += 3) {
    const a = WAYPOINTS[i - 1]!;
    const b = WAYPOINTS[i]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const start = WAYPOINTS[0]!;
  const end = WAYPOINTS[WAYPOINTS.length - 1]!;
  drawBanner(ctx, end.x + 8, end.y - 8);
  ctx.fillStyle = "rgba(20, 16, 12, 0.72)";
  ctx.beginPath();
  ctx.arc(start.x - 8, start.y, 7, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, start.x, start.y - 28, "BORDER");
  label(ctx, end.x, end.y + 36, "HOLD");
}

function strokePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(WAYPOINTS[0]!.x, WAYPOINTS[0]!.y);
  for (let i = 1; i < WAYPOINTS.length; i++) ctx.lineTo(WAYPOINTS[i]!.x, WAYPOINTS[i]!.y);
  ctx.stroke();
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(-2, -4, 4, 34);
  ctx.fillStyle = CREAM;
  ctx.fillRect(2, -30, 22, 11);
  ctx.fillStyle = CRIMSON;
  ctx.fillRect(2, -19, 22, 11);
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.save();
  ctx.font = "600 13px Barlow Condensed, sans-serif";
  ctx.fillStyle = "rgba(244, 234, 215, 0.88)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawProps(game: Game, ctx: CanvasRenderingContext2D): void {
  for (const prop of PROPS) {
    const x = (prop.c + 0.5) * CELL;
    const y = (prop.r + 0.5) * CELL;
    shadow(ctx, x, y + 10, 26, 8);
    drawSprite(ctx, game, `prop-${prop.kind}`, x, y, prop.kind === "sand" ? 78 : 108, -Math.PI / 2, 1);
  }
}

function drawBuildGrid(game: Game, ctx: CanvasRenderingContext2D): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ok = game.canBuild(c, r);
      ctx.fillStyle = ok ? "rgba(212, 160, 23, 0.13)" : "rgba(200, 16, 46, 0.08)";
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
    }
  }
}

function drawRange(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  range: number,
  minRange: number,
  ghost: boolean,
): void {
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fillStyle = ghost ? "rgba(212, 160, 23, 0.1)" : "rgba(212, 160, 23, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(212, 160, 23, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (minRange > 0) {
    ctx.beginPath();
    ctx.arc(x, y, minRange, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200, 16, 46, 0.7)";
    ctx.stroke();
  }
}

function drawTower(game: Game, ctx: CanvasRenderingContext2D, tower: { x: number; y: number; angle: number; kind: TowerKind; id: number; dmgRank: number; rateRank: number }): void {
  shadow(ctx, tower.x, tower.y + 12, 24, 9);
  drawSprite(ctx, game, `tower-${tower.kind}`, tower.x, tower.y, CELL * 1.12, tower.angle, 1);
  if (tower.id === game.selectedId) {
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.strokeRect(tower.x - CELL * 0.42, tower.y - CELL * 0.42, CELL * 0.84, CELL * 0.84);
  }
  const pips = tower.dmgRank + tower.rateRank;
  if (pips > 0) {
    ctx.fillStyle = BRASS;
    for (let i = 0; i < pips; i++) {
      ctx.fillRect(tower.x - 12 + i * 5, tower.y + 30, 3, 3);
    }
  }
}

function drawCreep(game: Game, ctx: CanvasRenderingContext2D, e: (typeof game.creeps)[number]): void {
  const def = ENEMIES[e.kind];
  const visual = creepVisual(e);
  if (def.air) {
    ctx.fillStyle = "rgba(20, 16, 12, 0.28)";
    ctx.beginPath();
    ctx.ellipse(visual.shadowX, visual.shadowY, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    shadow(ctx, visual.x, visual.y + 8, def.draw * 0.22, 7);
  }
  if (e.flash > 0) ctx.globalAlpha = 0.65;
  drawSprite(ctx, game, def.art, visual.x, visual.y, def.draw, e.angle, 1);
  ctx.globalAlpha = 1;
  const bw = 28;
  const bh = 4;
  const bx = visual.x - bw / 2;
  const by = visual.y - def.draw * 0.48;
  ctx.fillStyle = "rgba(20,16,12,0.7)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = e.hp / e.maxHp > 0.45 ? BRASS : CRIMSON;
  ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
  if (e.slow > 0) {
    ctx.fillStyle = CREAM;
    ctx.fillRect(bx, by + 5, bw * 0.45, 2);
  }
}

function creepVisual(e: { x: number; y: number; angle: number; lane: number; kind: (typeof ENEMIES)[keyof typeof ENEMIES]["kind"] }): {
  x: number;
  y: number;
  shadowX: number;
  shadowY: number;
} {
  const px = -Math.sin(e.angle) * e.lane;
  const py = Math.cos(e.angle) * e.lane;
  const air = ENEMIES[e.kind].air;
  return {
    x: e.x + px,
    y: e.y + py - (air ? 34 : 0),
    shadowX: e.x + px,
    shadowY: e.y + py,
  };
}

function drawShot(game: Game, ctx: CanvasRenderingContext2D, shot: (typeof game.shots)[number]): void {
  if (shot.mortar) {
    const t = Math.min(1, shot.age / Math.max(0.01, shot.duration));
    const lift = Math.sin(t * Math.PI) * 78;
    ctx.fillStyle = "rgba(20,16,12,0.3)";
    ctx.beginPath();
    ctx.ellipse(shot.x, shot.y, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const ang = Math.atan2(shot.ty - shot.sy, shot.tx - shot.sx);
    drawSprite(ctx, game, "shot-mortar", shot.x, shot.y - lift, 42, ang, 1);
    return;
  }
  const ang = Math.atan2(shot.vy, shot.vx);
  const size = shot.kind === "ckm" ? 46 : shot.kind === "aa" ? 40 : 36;
  drawSprite(ctx, game, `shot-${shot.kind}`, shot.x, shot.y, size, ang, 1);
}

function drawBoom(game: Game, ctx: CanvasRenderingContext2D, boom: (typeof game.booms)[number]): void {
  const frame = Math.min(3, Math.floor((boom.age / boom.life) * 4));
  const img = game.images.get(`fx-${frame}`);
  const size = 86 * boom.scale;
  if (!img) {
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.drawImage(img, boom.x - size / 2, boom.y - size / 2, size, size);
}

function drawParticles(game: Game, ctx: CanvasRenderingContext2D): void {
  for (const p of game.particles) {
    const alpha = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.tone === "brass" ? BRASS : p.tone === "cream" ? CREAM : CRIMSON;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.font = "700 16px Barlow Condensed, sans-serif";
  ctx.textAlign = "center";
  for (const f of game.floaters) {
    const alpha = 1 - f.age / f.life;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = f.tone === "accent" ? BRASS : f.tone === "primary" ? CRIMSON : CREAM;
    ctx.fillText(f.text, f.x, f.y - f.age * 28);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  game: Game,
  key: string,
  x: number,
  y: number,
  size: number,
  angle: number,
  alpha: number,
): void {
  const img = game.images.get(key);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.globalAlpha = alpha;
  if (img) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(20, 16, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
