import { COLORS } from './palette';

// Room backdrop — walls and door frames have been removed so enemies can walk
// in from off-screen. The backdrop is now purely an iso-rhombic floor that
// covers the full canvas. Everything else (mannequin, dais, rune points,
// enemies, towers, projectiles) is drawn on top per-frame.

// Retained as 0 so call-sites that used to offset decor/spawns by wall
// thickness keep compiling. There are no walls any more.
export const WALL_TOP = 0;
export const WALL_SIDE = 0;
export const WALL_BOTTOM = 0;

let cached: HTMLCanvasElement | null = null;
let cachedSize: { w: number; h: number } | null = null;

export function getRoomBackdrop(width: number, height: number): HTMLCanvasElement {
  if (cached && cachedSize && cachedSize.w === width && cachedSize.h === height) {
    return cached;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  drawFloor(ctx, width, height);
  drawScatteredDecor(ctx, width, height);

  cached = c;
  cachedSize = { w: width, h: height };
  return c;
}

// Iso rhombus tile floor covering the entire canvas.
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const TILE_W = 64;
  const TILE_H = 32;

  // Base fill.
  ctx.fillStyle = COLORS.tileA;
  ctx.fillRect(0, 0, w, h);

  let row = 0;
  for (let cy = -TILE_H; cy <= h + TILE_H; cy += TILE_H / 2) {
    const rowOffset = (row % 2 === 0) ? 0 : TILE_W / 2;
    let col = 0;
    for (let cx = -TILE_W + rowOffset; cx <= w + TILE_W; cx += TILE_W) {
      const seed = hash2(col + (row << 8), row);
      const checker = ((row >> 1) + col) & 1;
      const base = checker === 0 ? COLORS.tileA : COLORS.tileB;
      fillRhombus(ctx, cx, cy, TILE_W, TILE_H, base);
      strokeRhombus(ctx, cx, cy, TILE_W, TILE_H, COLORS.tileCrack);

      // Extra detail: each tile may pick up a number of small wear marks
      // based on its deterministic seed. This keeps the grid lively without
      // looking patterned.
      addTileDetails(ctx, cx, cy, TILE_W, TILE_H, seed);

      col++;
    }
    row++;
  }

  // Soft edge vignette pushing focus toward the centre.
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle centre spotlight.
  const spotlight = ctx.createRadialGradient(w / 2, h / 2 - 30, 0, w / 2, h / 2 - 30, 220);
  spotlight.addColorStop(0, 'rgba(125, 249, 255, 0.04)');
  spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, w, h);
}

// Per-tile wear: small cracks, pock marks, dust smudges. Deterministic.
function addTileDetails(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tw: number,
  th: number,
  seed: number,
): void {
  const bits = seed;

  // Stud / pebble (center).
  if ((bits & 0b111) === 0b101) {
    ctx.fillStyle = COLORS.tileC;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  // Horizontal crack across the tile.
  if ((bits & 0b11) === 0b11) {
    ctx.fillStyle = COLORS.tileCrack;
    ctx.fillRect(cx - 6, cy, 12, 1);
  }

  // Diagonal hairline cracks that follow the rhombus edges.
  if (((bits >> 3) & 0b1111) === 0b1010) {
    ctx.strokeStyle = COLORS.tileCrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.25, cy - th * 0.12);
    ctx.lineTo(cx + tw * 0.15, cy + th * 0.18);
    ctx.stroke();
  }
  if (((bits >> 7) & 0b1111) === 0b0110) {
    ctx.strokeStyle = COLORS.tileCrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + tw * 0.25, cy - th * 0.18);
    ctx.lineTo(cx - tw * 0.10, cy + th * 0.10);
    ctx.stroke();
  }

  // Scuff smudge — a lighter blob suggesting worn stone.
  if (((bits >> 11) & 0b111) === 0b001) {
    ctx.fillStyle = 'rgba(160, 140, 150, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 3, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark stain.
  if (((bits >> 14) & 0b1111) === 0b0011) {
    ctx.fillStyle = 'rgba(20, 10, 15, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy + 4, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny highlight speck.
  if (((bits >> 18) & 0b11111) === 0b10101) {
    ctx.fillStyle = 'rgba(255, 240, 220, 0.10)';
    ctx.fillRect(cx + 6, cy - 2, 1, 1);
  }
}

// Decorative junk scattered across the floor: broken potions, books, papers,
// and shards. Deterministic placement so it doesn't re-shuffle on refresh.
function drawScatteredDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  // Avoid the mannequin's dais (centre) and some breathing room around it.
  const cx = w / 2;
  const cy = h / 2;
  const excludeR = 120;

  const PROPS = 48;
  for (let i = 0; i < PROPS; i++) {
    const r = hash2(i * 31 + 7, 13 + i);
    const x = (r & 0xffff) % (w - 60) + 30;
    const y = ((r >> 16) & 0xffff) % (h - 60) + 30;
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < excludeR * excludeR) continue;

    const pick = r % 6;
    switch (pick) {
      case 0: drawBrokenPotion(ctx, x, y, 'cyan'); break;
      case 1: drawBrokenPotion(ctx, x, y, 'green'); break;
      case 2: drawBrokenPotion(ctx, x, y, 'purple'); break;
      case 3: drawBook(ctx, x, y, (r >> 3) & 1); break;
      case 4: drawPaperSheet(ctx, x, y, (r >> 5) & 3); break;
      default: drawDustPile(ctx, x, y); break;
    }
  }
}

function drawBrokenPotion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: 'cyan' | 'green' | 'purple',
): void {
  const liquidA = tint === 'cyan' ? COLORS.shardA : tint === 'green' ? COLORS.shardGreenA : COLORS.shardPurpleA;
  const liquidB = tint === 'cyan' ? COLORS.shardB : tint === 'green' ? COLORS.shardGreenB : COLORS.shardPurpleB;
  // Liquid splash.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = liquidA;
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = liquidB;
  ctx.fillRect(x - 4, y - 1, 3, 1);
  ctx.fillRect(x + 1, y, 3, 1);
  // Glass shards.
  ctx.fillStyle = COLORS.shardC;
  ctx.fillRect(x - 3, y - 2, 2, 1);
  ctx.fillRect(x + 2, y - 2, 2, 1);
  ctx.fillRect(x - 1, y + 2, 2, 1);
}

function drawBook(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  // Small flat book seen from above.
  const w = 10;
  const h = 7;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - w / 2 + 1, y - h / 2 + 1, w, h);
  ctx.fillStyle = variant === 0 ? COLORS.bookA : COLORS.woodMid;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = variant === 0 ? COLORS.bookB : COLORS.woodHi;
  ctx.fillRect(x - w / 2, y - h / 2, w, 1);
  // Pages visible on one edge.
  ctx.fillStyle = COLORS.paperA;
  ctx.fillRect(x + w / 2 - 1, y - h / 2 + 1, 1, h - 2);
  // Spine shadow.
  ctx.fillStyle = COLORS.bookC;
  ctx.fillRect(x - w / 2, y + h / 2 - 1, w, 1);
}

function drawPaperSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  // Crumpled paper or scroll.
  if (variant === 0) {
    // Flat sheet
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 3, y, 8, 4);
    ctx.fillStyle = COLORS.paperA;
    ctx.fillRect(x - 4, y - 1, 8, 4);
    ctx.fillStyle = COLORS.paperB;
    ctx.fillRect(x - 3, y + 1, 6, 1);
    ctx.fillRect(x - 3, y - 1, 3, 1);
  } else if (variant === 1) {
    // Scroll
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 5, y + 1, 12, 3);
    ctx.fillStyle = COLORS.paperA;
    ctx.fillRect(x - 6, y - 1, 12, 4);
    ctx.fillStyle = COLORS.paperB;
    ctx.fillRect(x - 6, y, 1, 2);
    ctx.fillRect(x + 5, y, 1, 2);
  } else {
    // Torn piece
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 2, y + 1, 6, 3);
    ctx.fillStyle = COLORS.paperA;
    ctx.fillRect(x - 3, y, 6, 3);
    ctx.fillStyle = COLORS.paperB;
    ctx.fillRect(x - 2, y + 1, 1, 1);
    ctx.fillRect(x + 1, y, 1, 1);
  }
}

function drawDustPile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.dustB;
  ctx.beginPath();
  ctx.ellipse(x, y, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.dustA;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 3, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Filled 2:1 diamond (rhombus) centred at (cx, cy).
function fillRhombus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string,
): void {
  const hw = w / 2;
  const hh = h / 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
}

function strokeRhombus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  stroke: string,
): void {
  const hw = w / 2;
  const hh = h / 2;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();
}

function hash2(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  return h * 2654435761 >>> 0;
}

// Walls have been removed, so there are no door overlays. Kept as a no-op so
// existing call-sites compile; the active entrance is still communicated via
// a subtle glow hint drawn by render.ts.
export function drawActiveDoor(
  _ctx: CanvasRenderingContext2D,
  _entranceX: number,
  _entranceY: number,
  _pulse: number,
  _w: number,
  _h: number,
): void {
  /* no-op — walls removed */
}
