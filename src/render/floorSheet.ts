// Painted floor-tile spritesheet (`public/sprites/floor-tiles.png`).
//
// 6 hand-drawn 1 m × 1 m top-down stone tile variants laid out in a
// 3 × 2 grid of 400 × 400 cells. Each cell paints a slightly different
// brick / cobble pattern (mossy slabs, dark tight pavers, sandy cracked
// stone, dark-mossy mix, dark grid pavers, herringbone cobble) so the
// floor reads as varied tiled stone instead of a single repeating motif.
//
// Render path (`floorSheet.ts` ↔ `room.ts`):
//   1. The sheet is loaded asynchronously via the standard `AnimSheet`
//      machinery (so the room backdrop falls back to a flat colour
//      until the PNG resolves, then re-bakes once and caches).
//   2. For each iso cell, `getFloorTileRhombus(idx, w, h)` returns a
//      pre-baked canvas containing that tile projected into the iso
//      rhombus shape (vertices at top-centre, right-mid, bottom-centre,
//      left-mid of a `w × h` axis-aligned bbox).
//   3. The room loop just `drawImage`s the baked rhombus at each cell.
//
// The tile bboxes below were derived offline from the supplied PNG by
// alpha-thresholding (α > 200) and taking the connected-component bbox
// per cell — this trims the speckled cell margin so we sample only the
// painted body.

import { loadSheet, isSheetReady, type AnimSheet } from './animatedSprite';

export const floorSheet: AnimSheet = loadSheet('sprites/floor-tiles.png');

export interface FloorTileFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Tight bbox per tile (alpha > 200, connected-component bbox). Order
 * mirrors the sheet left-to-right, top-to-bottom:
 *   0 mossy brown slabs        3 dark mossy brick
 *   1 dark tight pavers        4 dark grid pavers
 *   2 sandy cracked stone      5 herringbone cobble
 */
export const FLOOR_TILE_FRAMES: readonly FloorTileFrame[] = [
  { sx:  21, sy:  23, sw: 372, sh: 371 },
  { sx: 418, sy:  22, sw: 365, sh: 374 },
  { sx: 807, sy:  23, sw: 371, sh: 372 },
  { sx:  25, sy: 415, sw: 371, sh: 356 },
  { sx: 418, sy: 415, sw: 364, sh: 356 },
  { sx: 807, sy: 415, sw: 371, sh: 355 },
];

export const FLOOR_TILE_COUNT = FLOOR_TILE_FRAMES.length;

/** `${idx}_${tileW}_${tileH}_${flipX ? 1 : 0}` → baked rhombus canvas. */
const tileCache = new Map<string, HTMLCanvasElement>();

/**
 * Returns a baked iso-rhombus version of tile #idx, sized exactly
 * `tileW × tileH` (the rhombus's axis-aligned bbox). The rhombus has
 * its four vertices at:
 *   top    = (tileW / 2, 0)
 *   right  = (tileW,     tileH / 2)
 *   bottom = (tileW / 2, tileH)
 *   left   = (0,         tileH / 2)
 *
 * To draw at iso cell-centre `(cx, cy)`:
 *   ctx.drawImage(baked, cx - tileW / 2, cy - tileH / 2);
 *
 * Returns `null` until the sheet has loaded (callers should fall back
 * to a flat-colour rhombus). When `flipX` is true the source square is
 * mirrored horizontally before being projected — gives 12 visual
 * variants from 6 source tiles without doubling the sheet size.
 */
export function getFloorTileRhombus(
  idx: number,
  tileW: number,
  tileH: number,
  flipX = false,
): HTMLCanvasElement | null {
  if (!isSheetReady(floorSheet)) return null;
  const f = FLOOR_TILE_FRAMES[((idx % FLOOR_TILE_COUNT) + FLOOR_TILE_COUNT) % FLOOR_TILE_COUNT]!;
  const key = `${idx}_${tileW}_${tileH}_${flipX ? 1 : 0}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = tileW;
  c.height = tileH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Affine map from the source square (sw × sh) onto the iso rhombus
  // listed above. The rhombus is the iso projection of a top-down 1 m
  // square: world x-axis maps to screen (1, 0.5), world y-axis maps to
  // screen (-1, 0.5).
  //
  //   src (0, 0)        → dst (tileW / 2, 0)            (top vertex)
  //   src (sw, 0)       → dst (tileW,     tileH / 2)    (right vertex)
  //   src (0, sh)       → dst (0,         tileH / 2)    (left vertex)
  //   src (sw, sh)      → dst (tileW / 2, tileH)        (bottom vertex)
  //
  // M = [ tileW/(2·sw)  -tileW/(2·sh) ;  tileH/(2·sw)   tileH/(2·sh) ]
  // t = (tileW / 2, 0)
  //
  // ctx.transform is laid out as (a, b, c, d, e, f) → matrix
  //   [ a c e ]
  //   [ b d f ]
  // so we pass (a, b, c, d, e, f) =
  //   ( tileW/(2·sw),  tileH/(2·sw),  -tileW/(2·sh),  tileH/(2·sh),  tileW/2, 0 ).
  ctx.setTransform(
    tileW / (2 * f.sw),
    tileH / (2 * f.sw),
    -tileW / (2 * f.sh),
    tileH / (2 * f.sh),
    tileW / 2,
    0,
  );
  if (flipX) {
    // Mirror the source-square's x axis. Translating by sw first keeps
    // the post-mirror content lined up with the rhombus's right vertex.
    ctx.translate(f.sw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    floorSheet.image,
    f.sx, f.sy, f.sw, f.sh,
    0, 0, f.sw, f.sh,
  );
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  tileCache.set(key, c);
  return c;
}

/** Subscribe to load — used by `room.ts` to invalidate the baked
 *  backdrop the moment the sheet PNG resolves so the floor swaps from
 *  the flat-colour fallback to the painted tiles. */
export function onFloorSheetLoad(cb: () => void): void {
  if (isSheetReady(floorSheet)) {
    cb();
    return;
  }
  floorSheet.image.addEventListener('load', cb, { once: true });
}
