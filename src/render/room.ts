import { COLORS } from './palette';
import { BIOMES, type BiomeId, type BiomePalette } from '../data/biomes';
import { drawProp, onPropsSheetLoad, PROP_COUNT } from './propSprites';
import { getFloorTileRhombus, onFloorSheetLoad, FLOOR_TILE_COUNT } from './floorSheet';

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

// When either the painted-props sheet or the floor-tiles sheet
// finishes loading, invalidate the cached backdrop so the next call
// to `getRoomBackdrop` re-bakes with the now-loaded artwork. Without
// this, the first room render happens before the PNGs resolve and
// the props / floor textures stay invisible until the player
// triggers a biome / size change.
const invalidateRoomCache = (): void => {
  cached = null;
  cachedSize = null;
  cachedBiome = null;
};
onPropsSheetLoad(invalidateRoomCache);
onFloorSheetLoad(invalidateRoomCache);

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

// Iso rhombus tile floor covering the entire canvas. Tiles are now
// pre-baked from the painted spritesheet (`floor-tiles.png` → 6 tile
// variants of a 1 m × 1 m top-down stone block, projected into the iso
// rhombus shape by `getFloorTileRhombus`). Each cell deterministically
// picks one of the 6 variants + a 50% mirror flip from its (col, row)
// hash so the grid reads as varied tiled stone instead of a single
// repeating motif. The 45° iso angle is preserved by the projection
// (rhombus aspect 2:1, vertices on the cell axis, exactly the look the
// previous procedural floor had).
//
// `TILE_W × TILE_H = 128 × 64`: a 1 m world tile becomes a 128-wide
// rhombus on screen, so the painted detail (cracks, mortar, moss) is
// readable. The mannequin is ~50 px wide → ~0.5 m, matching the 1 m
// tile size called out in the design brief.
//
// Until the spritesheet PNG resolves, each cell falls back to a flat
// biome-coloured rhombus drawn with `fillRhombus`; once `onFloorSheetLoad`
// fires the room cache is invalidated and the next bake uses the
// painted tiles.
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomePalette): void {
  const TILE_W = 128;
  const TILE_H = 64;

  // Base fill (visible only behind transparent rhombus corners and as
  // a fallback before the painted sheet loads).
  ctx.fillStyle = pal.tileA;
  ctx.fillRect(0, 0, w, h);

  let row = 0;
  for (let cy = -TILE_H; cy <= h + TILE_H; cy += TILE_H / 2) {
    const rowOffset = (row % 2 === 0) ? 0 : TILE_W / 2;
    let col = 0;
    for (let cx = -TILE_W + rowOffset; cx <= w + TILE_W; cx += TILE_W) {
      const seed = hash2(col + (row << 8), row);
      const tileIdx = (seed >>> 3) % FLOOR_TILE_COUNT;
      const flipX = ((seed >>> 17) & 1) === 1;
      const baked = getFloorTileRhombus(tileIdx, TILE_W, TILE_H, flipX);
      if (baked) {
        // Baked rhombus has its top vertex at (TILE_W/2, 0) within its
        // own bbox, so we anchor the bbox top-left at (cx - TILE_W/2,
        // cy - TILE_H/2) to land the rhombus centre at (cx, cy).
        ctx.drawImage(baked, cx - TILE_W / 2, cy - TILE_H / 2);
      } else {
        // Sheet not loaded yet — fall back to a flat biome-colour
        // rhombus so the floor isn't blank during the first paint.
        const checker = ((row >> 1) + col) & 1;
        const base = checker === 0 ? pal.tileA : pal.tileB;
        fillRhombus(ctx, cx, cy, TILE_W, TILE_H, base);
        strokeRhombus(ctx, cx, cy, TILE_W, TILE_H, pal.tileCrack);
      }

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

// `addTileDetails` (per-cell pebbles / cracks / scuffs / stains) used
// to paint procedural wear on top of every flat-coloured rhombus.
// It was removed when the floor switched to the painted spritesheet
// tiles — the painted tiles already supply that level of detail.

// Filled 2:1 diamond (rhombus) centred at (cx, cy). Used as a fallback
// when the painted floor sheet hasn't loaded yet.
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
