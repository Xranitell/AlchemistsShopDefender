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
  // Avoid the mannequin's dais + tower rune ring. Exclusion is an ellipse
  // matching the iso rune ring (wide × short) so decor fills the outer area.
  const cx = w / 2;
  const cy = h / 2;
  const excludeRX = 280;
  const excludeRY = 150;

  const PROPS = 42;
  for (let i = 0; i < PROPS; i++) {
    const r = hash2(i * 31 + 7, 13 + i);
    const x = (r & 0xffff) % (w - 60) + 30;
    const y = ((r >> 16) & 0xffff) % (h - 60) + 30;
    const dx = (x - cx) / excludeRX;
    const dy = (y - cy) / excludeRY;
    if (dx * dx + dy * dy < 1) continue;

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

// Pixel helper: 1 "cell" is 3 screen px. Props end up roughly 24×12 which
// reads clearly next to the 34-px-wide alchemist sprite.
const P = 3;

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cw: number,
  ch: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), cw * P, ch * P);
}

// Broken potion: a clear bottle silhouette lying on its side with a spilled
// puddle, a cracked neck, and 3-4 chunky glass shards radiating outwards.
function drawBrokenPotion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: 'cyan' | 'green' | 'purple',
): void {
  const liquidA = tint === 'cyan' ? COLORS.shardA : tint === 'green' ? COLORS.shardGreenA : COLORS.shardPurpleA;
  const liquidB = tint === 'cyan' ? COLORS.shardB : tint === 'green' ? COLORS.shardGreenB : COLORS.shardPurpleB;
  const liquidHi = '#ffffff';
  const glass = COLORS.shardC;

  // Ground shadow (spilled puddle outline).
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x + P, y + 2 * P, 8 * P, 3 * P, 0, 0, Math.PI * 2);
  ctx.fill();

  // Liquid splash (2:1 blob in liquid colour).
  ctx.fillStyle = liquidA;
  ctx.beginPath();
  ctx.ellipse(x + P, y + P, 7 * P, 2.5 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = liquidB;
  ctx.beginPath();
  ctx.ellipse(x - P, y + P, 3 * P, 1.2 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specular highlight dot on the puddle.
  px(ctx, x - P, y, 1, 1, liquidHi);

  // Bottle body (round base + narrowing shoulder + neck lying to the left).
  // Base (3x2):
  px(ctx, x + P, y - P, 3, 2, glass);
  // Shoulder (narrower):
  px(ctx, x, y - 2 * P, 2, 1, glass);
  // Neck (1 cell tall) lying flat to the left with a cracked tip.
  px(ctx, x - 2 * P, y - 2 * P, 2, 1, glass);
  // Cork popped off.
  px(ctx, x - 3 * P, y - 2 * P, 1, 1, COLORS.woodMid);

  // Rim highlight on the body.
  px(ctx, x + 2 * P, y - P, 2, 1, liquidA);

  // Shards radiating out.
  px(ctx, x + 4 * P, y - 2 * P, 1, 1, glass);
  px(ctx, x + 4 * P, y, 1, 1, glass);
  px(ctx, x - 4 * P, y + 2 * P, 1, 1, glass);
  px(ctx, x + 2 * P, y + 3 * P, 1, 1, glass);
}

// Book with a clear spine, cover, and visible page edges. Optionally drawn
// lying open so the pages are legible.
function drawBook(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  if (variant === 0) {
    // Closed book seen from a 3/4 angle. 8x4 cells + shadow.
    const w = 8 * P;
    const h = 4 * P;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - w / 2 + P, y - h / 2 + P, w, h);
    // Cover.
    px(ctx, x - w / 2, y - h / 2, 8, 4, COLORS.bookA);
    // Spine band (top edge).
    px(ctx, x - w / 2, y - h / 2, 8, 1, COLORS.bookB);
    // Cover detail: embossed rectangle.
    px(ctx, x - w / 2 + 2 * P, y - h / 2 + 2 * P, 4, 1, COLORS.bookB);
    // Page edges on the right side.
    px(ctx, x + w / 2 - P, y - h / 2 + P, 1, 3, COLORS.paperA);
    // Bottom shadow line.
    px(ctx, x - w / 2, y + h / 2 - P, 8, 1, COLORS.bookC);
  } else {
    // Open book with two pages and a spine down the middle.
    const w = 10 * P;
    const h = 5 * P;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - w / 2 + P, y - h / 2 + P, w, h);
    // Pages (paper colour).
    px(ctx, x - w / 2, y - h / 2, 10, 5, COLORS.paperA);
    // Spine shadow down the middle.
    px(ctx, x - P / 2, y - h / 2, 1, 5, COLORS.bookC);
    // Page wrinkle / text lines.
    px(ctx, x - w / 2 + P, y - h / 2 + P, 3, 1, COLORS.paperB);
    px(ctx, x - w / 2 + P, y - h / 2 + 2 * P, 3, 1, COLORS.paperB);
    px(ctx, x + P, y - h / 2 + P, 3, 1, COLORS.paperB);
    px(ctx, x + P, y - h / 2 + 3 * P, 3, 1, COLORS.paperB);
    // Cover poking out behind the open pages.
    px(ctx, x - w / 2 - P, y - h / 2, 1, 5, COLORS.bookA);
    px(ctx, x + w / 2, y - h / 2, 1, 5, COLORS.bookA);
  }
}

// Paper variants: flat sheet w/ text, scroll with rolled ends, torn piece.
function drawPaperSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  if (variant === 0) {
    // Flat sheet with 3 lines of "text".
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 4 * P + P, y - 3 * P + P, 8 * P, 6 * P);
    px(ctx, x - 4 * P, y - 3 * P, 8, 6, COLORS.paperA);
    // Corners folded (shading).
    px(ctx, x - 4 * P, y - 3 * P, 1, 1, COLORS.paperB);
    px(ctx, x + 3 * P, y + 2 * P, 1, 1, COLORS.paperB);
    // Text lines.
    px(ctx, x - 3 * P, y - 2 * P, 5, 1, COLORS.paperB);
    px(ctx, x - 3 * P, y, 6, 1, COLORS.paperB);
    px(ctx, x - 3 * P, y + 2 * P, 4, 1, COLORS.paperB);
  } else if (variant === 1) {
    // Scroll seen from above: tan tube with darker rolled ends.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 6 * P + P, y - P + P, 12 * P, 3 * P);
    // Main paper body.
    px(ctx, x - 5 * P, y - P, 10, 3, COLORS.paperA);
    // Text strip.
    px(ctx, x - 4 * P, y, 8, 1, COLORS.paperB);
    // Rolled ends — darker, rounded.
    px(ctx, x - 6 * P, y - 2 * P, 2, 5, COLORS.paperB);
    px(ctx, x + 4 * P, y - 2 * P, 2, 5, COLORS.paperB);
    // End highlight (inside of roll).
    px(ctx, x - 6 * P + P, y - P, 1, 1, COLORS.paperA);
    px(ctx, x + 4 * P + P, y - P, 1, 1, COLORS.paperA);
  } else {
    // Torn page — jagged edges.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 3 * P + P, y - 2 * P + P, 6 * P, 4 * P);
    px(ctx, x - 3 * P, y - 2 * P, 6, 4, COLORS.paperA);
    // Jagged top.
    px(ctx, x - 2 * P, y - 3 * P, 1, 1, COLORS.paperA);
    px(ctx, x, y - 3 * P, 1, 1, COLORS.paperA);
    px(ctx, x + 2 * P, y - 3 * P, 1, 1, COLORS.paperA);
    // Jagged bottom.
    px(ctx, x - 2 * P, y + 2 * P, 1, 1, COLORS.paperA);
    px(ctx, x + P, y + 2 * P, 1, 1, COLORS.paperA);
    // Text line.
    px(ctx, x - 2 * P, y, 4, 1, COLORS.paperB);
  }
}

function drawDustPile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Fluffy dust bunny: soft ellipse body with a few specks sticking out.
  ctx.fillStyle = COLORS.dustB;
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * P / P, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.dustA;
  ctx.beginPath();
  ctx.ellipse(x - 1, y - 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specks.
  px(ctx, x - 4 * P, y, 1, 1, COLORS.dustB);
  px(ctx, x + 3 * P, y - P, 1, 1, COLORS.dustB);
  px(ctx, x + P, y + P, 1, 1, COLORS.dustA);
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
