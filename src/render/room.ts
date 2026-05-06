import { COLORS } from './palette';
import { BIOMES, type BiomeId, type BiomePalette } from '../data/biomes';
import { drawProp, onPropsSheetLoad, PROP_COUNT } from './propSprites';

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
let cachedBiome: BiomeId | null = null;

/** Current biome set by the game. Call `setBiome` before the first
 *  `getRoomBackdrop` to switch palettes; the cache is invalidated
 *  automatically when the biome changes. */
let activeBiome: BiomeId = 'workshop';

export function setBiome(id: BiomeId): void {
  if (id !== activeBiome) {
    activeBiome = id;
    cached = null;        // force re-render on next call
    cachedBiome = null;
  }
}

export function getActiveBiomePalette(): BiomePalette {
  return BIOMES[activeBiome].palette;
}

export function getRoomBackdrop(width: number, height: number): HTMLCanvasElement {
  if (cached && cachedSize && cachedSize.w === width && cachedSize.h === height && cachedBiome === activeBiome) {
    return cached;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const pal = BIOMES[activeBiome].palette;
  // Every biome — including workshop — now uses the iso-rhombus stone
  // tile floor with the biome's palette. The wooden plank texture that
  // workshop used to draw was removed per design request; the warm
  // amber palette + workshop decor (shelves, candles, props) are still
  // enough to read the room as the alchemist's lab.
  drawFloor(ctx, width, height, pal);
  // Walls removed per design request — open arena feel.
  // All previous biome / workshop decor (programmatic potion bottles,
  // books, scrolls, candles, mortar, ink, herb bundles, crates, plus
  // the per-biome ember / bone scatter) has been replaced by the new
  // painted props spritesheet — see `drawSpritesheetProps` below.
  drawSpritesheetProps(ctx, width, height);

  cached = c;
  cachedSize = { w: width, h: height };
  cachedBiome = activeBiome;
  return c;
}

// When the painted props sheet finishes loading, invalidate the cached
// backdrop so the next call to `getRoomBackdrop` re-bakes with the
// props now visible. Without this, the first room render happens
// before the PNG resolves and the props stay invisible until the
// player triggers a biome / size change.
onPropsSheetLoad(() => {
  cached = null;
  cachedSize = null;
  cachedBiome = null;
});

/**
 * Scatters painted props randomly across the floor.
 *
 * Each prop is:
 *   - placed at a deterministic position (hash-driven so the layout
 *     stays stable between renders, but reads as random),
 *   - kept clear of the central rune ring (`excludeRX × excludeRY`
 *     ellipse) so the gameplay area around the dais stays readable,
 *   - sometimes mirrored horizontally (50% chance, drawn around the
 *     prop's anchor x — gives variety without re-baking sprites),
 *   - tilted by ±10° around its base anchor so the floor doesn't
 *     read like a tidy product shelf,
 *   - rendered with a soft elliptical shadow on the floor first so the
 *     prop stays visually grounded even when tilted.
 *
 * Caller (`getRoomBackdrop`) bakes this into the cached canvas; the
 * `onPropsSheetLoad` hook above invalidates the cache the moment the
 * PNG finishes loading so the props become visible without waiting
 * for a biome / size change.
 */
function drawSpritesheetProps(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  // Same exclusion ellipse the previous decor passes used so props
  // never land on top of the rune ring / dais.
  const excludeRX = 280;
  const excludeRY = 150;
  const PROPS = 28;

  for (let i = 0; i < PROPS; i++) {
    // Two independent hashes so position and prop-pick don't correlate.
    const r1 = hash2(i * 73 + 19, 41 + i * 5);
    const r2 = hash2(i * 31 + 211, 7 + i * 11);
    const x = ((r1 >>> 5) & 0xffff) / 0xffff * (w - 120) + 60;
    const y = ((r1 >>> 13) & 0xffff) / 0xffff * (h - 140) + 70;

    const dx = (x - cx) / excludeRX;
    const dy = (y - cy) / excludeRY;
    if (dx * dx + dy * dy < 1) continue;

    const id = (r2 >>> 1) % PROP_COUNT;
    // ±10° tilt. (r2 >>> 9) gives independent randomness from id.
    const tiltSeed = ((r2 >>> 9) & 0xffff) / 0xffff;
    const rotation = (tiltSeed - 0.5) * (Math.PI / 9);
    // 50% mirror flip.
    const flipX = ((r2 >>> 25) & 1) === 1;
    // Slight scale variance keeps the floor from reading too uniform.
    const scaleSeed = ((r2 >>> 17) & 0xff) / 255;
    const scale = 0.20 + scaleSeed * 0.06; // 0.20..0.26

    // Soft elliptical shadow under the prop, drawn flat on the floor
    // (not rotated with the prop) so the shadow always reads as ground
    // contact even for tilted bodies.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * scale * 4, 6 * scale * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawProp(ctx, x, y, id, { scale, flipX, rotation });
  }
}


// `drawPlankFloor` and `addPlankDetails` (the wooden plank renderer
// used by the workshop biome) used to live here. They were removed
// when the workshop biome was switched back to the shared
// iso-rhombus stone-tile floor; restore them from git history if a
// future build wants to bring wooden floors back.

// Iso rhombus tile floor covering the entire canvas.
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomePalette): void {
  const TILE_W = 64;
  const TILE_H = 32;

  // Base fill.
  ctx.fillStyle = pal.tileA;
  ctx.fillRect(0, 0, w, h);

  let row = 0;
  for (let cy = -TILE_H; cy <= h + TILE_H; cy += TILE_H / 2) {
    const rowOffset = (row % 2 === 0) ? 0 : TILE_W / 2;
    let col = 0;
    for (let cx = -TILE_W + rowOffset; cx <= w + TILE_W; cx += TILE_W) {
      const seed = hash2(col + (row << 8), row);
      const checker = ((row >> 1) + col) & 1;
      const base = checker === 0 ? pal.tileA : pal.tileB;
      fillRhombus(ctx, cx, cy, TILE_W, TILE_H, base);
      strokeRhombus(ctx, cx, cy, TILE_W, TILE_H, pal.tileCrack);

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
  grad.addColorStop(1, `rgba(0,0,0,${pal.vignetteAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle centre spotlight.
  const spotlight = ctx.createRadialGradient(w / 2, h / 2 - 30, 0, w / 2, h / 2 - 30, 220);
  spotlight.addColorStop(0, pal.spotlight);
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


// Pixel helper: 1 "cell" is 3 screen px. Props end up roughly 24×12 which
// reads clearly next to the 34-px-wide alchemist sprite.


/* ============================================================
 *  Workshop alchemy decor — intact props that lean into the cosy
 *  alchemist's-lab vibe (bottles full of glowing liquid, stacked
 *  books, scrolls, candle stubs, mortar & pestle, ink + quill,
 *  herb bundles, small wooden crates).
 *
 *  All props share these conventions:
 *   - drawn inside `applyIsoTransform`, so x/y are world coords
 *   - first paint a soft elliptical shadow under the prop
 *   - silhouette outline in pal `tileCrack` for a chunky readable
 *     pixel-art look against the warm wooden floor
 *   - colour pulled from the existing `COLORS` palette so the
 *     props stay visually coherent with the rest of the game
 * ============================================================ */

/** Liquid-tint pairs for `drawPotionBottle` — `body` is the saturated
 *  fill, `shine` is a brighter tone used for the glass highlight, and
 *  `cap` is the cork / stopper colour drawn on top. */


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
  ctx: CanvasRenderingContext2D,
  entranceX: number,
  entranceY: number,
  pulse: number,
  w: number,
  h: number,
): void {
  const x = Math.max(22, Math.min(w - 22, entranceX));
  const y = Math.max(26, Math.min(h - 26, entranceY));
  const horizontal = entranceY < 0 || entranceY > h;
  const glow = 0.28 + pulse * 0.32;
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = COLORS.fireC;
  ctx.beginPath();
  ctx.ellipse(x, y, horizontal ? 55 : 22, horizontal ? 18 : 58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.woodDark;
  if (horizontal) {
    ctx.fillRect(x - 34, y - 10, 68, 20);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x - 28, y - 6, 56, 5);
    ctx.fillRect(x - 28, y + 2, 56, 5);
  } else {
    ctx.fillRect(x - 10, y - 34, 20, 68);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x - 6, y - 28, 5, 56);
    ctx.fillRect(x + 2, y - 28, 5, 56);
  }
  ctx.restore();
}
