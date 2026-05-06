// Painted floor-decals spritesheet (`public/sprites/decals.png`).
//
// 8 hand-drawn top-down decal sprites (cracks, ash scatter, scorch
// stains, dropped foliage, etc.) used as static dressing baked into
// the room backdrop. The room loop picks 2-3 random decals per
// session and scatters them on the floor at the same iso angle as
// the painted floor tiles, so they read as lying on the surface.
//
// The sheet is a 1200 × 654 PNG containing the 8 decals at varied
// positions (no clean grid — frame rects below were derived offline
// from the alpha mask via connected-component bbox detection).
//
// Render position: between the painted floor tiles and the painted
// props in `room.ts → getRoomBackdrop`. The decals end up baked into
// the cached room canvas so they stay below all dynamic gameplay
// objects (towers, enemies, projectiles) but on top of the floor —
// exactly the layering the design brief asked for.

import { loadSheet, isSheetReady, type AnimSheet } from './animatedSprite';

/* ── Sheet ──────────────────────────────────────────────────────── */
export const decalSheet: AnimSheet = loadSheet('sprites/decals.png');

/** Subscribe to load — used by `room.ts` to invalidate the cached
 *  backdrop the moment the decal PNG resolves so the scattered
 *  decals appear on the floor without waiting for a biome / size
 *  change. */
export function onDecalSheetLoad(cb: () => void): void {
  if (isSheetReady(decalSheet)) {
    cb();
    return;
  }
  decalSheet.image.addEventListener('load', cb, { once: true });
}

/* ── Frame table ───────────────────────────────────────────────── */

export interface DecalFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** 8 decals, ordered top-row-then-bottom-row (matches the source PNG
 *  layout). Bbox derived from connected-component analysis of α > 200. */
export const DECAL_FRAMES: readonly DecalFrame[] = [
  { sx:  45, sy:  62, sw: 210, sh: 210 },
  { sx: 354, sy:  53, sw: 200, sh: 218 },
  { sx: 637, sy:  50, sw: 225, sh: 227 },
  { sx: 940, sy:  40, sw: 220, sh: 249 },
  { sx:  66, sy: 394, sw: 158, sh: 165 },
  { sx: 368, sy: 394, sw: 177, sh: 171 },
  { sx: 637, sy: 381, sw: 217, sh: 205 },
  { sx: 989, sy: 402, sw: 121, sh: 166 },
];

export const DECAL_COUNT = DECAL_FRAMES.length;

/* ── Drawing ──────────────────────────────────────────────────── */

export interface DrawDecalOptions {
  /** Output footprint half-width (px). The decal is projected into a
   *  `(2 · halfW) × halfW` iso rhombus footprint so it reads as lying
   *  on the floor (same 45° camera angle as the floor tiles). */
  halfW?: number;
  /** Horizontal mirror around the anchor x. */
  flipX?: boolean;
  /** Tint multiplier — used to fade decals into the floor. */
  alpha?: number;
}

/**
 * Renders decal #idx with its centre at world (x, y), iso-projected
 * to look like it lies flat on the floor at a 45° viewing angle.
 *
 * The source square is mapped onto a 2:1 rhombus footprint identical
 * to the floor tile projection in `floorSheet.ts`:
 *   src (0, 0)        → dst (0,        -halfW / 2)   (top vertex)
 *   src (sw, 0)       → dst (halfW,     0)           (right vertex)
 *   src (0, sh)       → dst (-halfW,    0)           (left vertex)
 *   src (sw, sh)      → dst (0,         halfW / 2)   (bottom vertex)
 *
 * Returns false if the sheet hasn't loaded yet (caller can no-op or
 * the room cache will be re-baked once the load event fires).
 */
export function drawDecal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  opts?: DrawDecalOptions,
): boolean {
  if (!isSheetReady(decalSheet)) return false;
  const frame = DECAL_FRAMES[((id % DECAL_COUNT) + DECAL_COUNT) % DECAL_COUNT]!;
  const halfW = opts?.halfW ?? 60;
  const halfH = halfW / 2;
  const alpha = opts?.alpha ?? 0.85;
  const flip = opts?.flipX === true;

  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  // Build the iso projection matrix — same shape (45° rotation + 2:1
  // Y-compress) the floor tiles use, sized so the rhombus footprint
  // is `(2 · halfW) × (2 · halfH)` and centred on (x, y):
  //
  //   src (0,0)    → dst (0,     -halfH)
  //   src (sw,0)   → dst (halfW,  0)
  //   src (0,sh)   → dst (-halfW, 0)
  //   src (sw,sh)  → dst (0,      halfH)
  //
  // M · src + t with
  //   M = [ halfW / sw   -halfW / sh ;  halfH / sw   halfH / sh ]
  //   t = (0, -halfH)
  ctx.transform(
    halfW / frame.sw,
    halfH / frame.sw,
    -halfW / frame.sh,
    halfH / frame.sh,
    0,
    -halfH,
  );
  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(
    decalSheet.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    0, 0, frame.sw, frame.sh,
  );
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
  ctx.restore();
  return true;
}
