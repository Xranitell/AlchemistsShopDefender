// Painted turret-stands spritesheet (`public/sprites/turret-stands.png`).
//
// 6 hand-drawn alchemy-tower variants — each a complete tower (stone
// pedestal + machinery on top) mapped 1-to-1 onto the game's six
// in-data tower kinds:
//
//   0  needler          → multi-barrel brass cannon
//   1  mortar           → bubbling alchemy cauldron
//   2  mercury_sprayer  → steam-pump pressure rig
//   3  acid_injector    → green-liquid test-tube refinery
//   4  ether_coil       → purple Tesla coil
//   5  watch_tower      → glass-and-brass alchemist's lantern
//
// The sheet is a 1200 × 960 PNG laid out as a 3 × 2 grid of 400 × 480
// cells. The frame rects below were tightened to the painted pixels of
// each cell (alpha > 200) so we sample only the body, not the
// speckled cell margin.
//
// Anchor convention: each tower is centred horizontally on its bbox
// and bottom-aligned to the base of its stone pedestal (i.e.
// `ax = sw / 2`, `ay = sh`). Drawing `drawTurret(ctx, x, y, kindId)`
// then plants the pedestal's bottom on the world (x, y) — same anchor
// the rune-point chalk circle is drawn at, so the tower sits cleanly
// over the rune slot.

import { loadSheet, isSheetReady, type AnimSheet } from './animatedSprite';

/* ── Sheet ──────────────────────────────────────────────────────── */
export const turretSheet: AnimSheet = loadSheet('sprites/turret-stands.png');

/** Subscribe to load — used by the in-game render pipeline to know
 *  when to start drawing painted turrets instead of the baked
 *  pixel-art fallbacks. Currently no caller has to invalidate a
 *  cache (turrets are drawn per-frame, not baked into the room),
 *  but the hook is exported for symmetry with `propSprites` /
 *  `floorSheet` and to give future call-sites a single load gate. */
export function onTurretSheetLoad(cb: () => void): void {
  if (isSheetReady(turretSheet)) {
    cb();
    return;
  }
  turretSheet.image.addEventListener('load', cb, { once: true });
}

/* ── Frame table ───────────────────────────────────────────────── */

export interface TurretFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Body horizontal centre within the source rect (cell-local px). */
  ax: number;
  /** Body bottom within the source rect — implicit `sh`. Stored so
   *  the rendering helper doesn't have to special-case the anchor
   *  convention. */
  ay: number;
}

/** Tower-kind id (matches `TowerKind.id` in `data/towers.ts`) to
 *  painted-frame index. Used by the renderer to pick the right
 *  painted sprite for each tower. */
export const TURRET_KIND_TO_FRAME: Readonly<Record<string, number>> = {
  needler: 0,
  mortar: 1,
  mercury_sprayer: 2,
  acid_injector: 3,
  ether_coil: 4,
  watch_tower: 5,
};

export const TURRET_FRAMES: readonly TurretFrame[] = [
  // 0  needler           — multi-barrel brass cannon
  { sx:  87, sy: 152, sw: 276, sh: 328, ax: 276 / 2, ay: 328 },
  // 1  mortar            — bubbling alchemy cauldron
  { sx: 453, sy:  90, sw: 277, sh: 390, ax: 277 / 2, ay: 390 },
  // 2  mercury_sprayer   — steam-pump pressure rig
  { sx: 806, sy: 120, sw: 302, sh: 360, ax: 302 / 2, ay: 360 },
  // 3  acid_injector     — green-liquid test-tube refinery
  { sx:  45, sy: 480, sw: 307, sh: 374, ax: 307 / 2, ay: 374 },
  // 4  ether_coil        — purple Tesla coil
  { sx: 458, sy: 480, sw: 277, sh: 373, ax: 277 / 2, ay: 373 },
  // 5  watch_tower       — glass-and-brass alchemist's lantern
  { sx: 854, sy: 480, sw: 251, sh: 375, ax: 251 / 2, ay: 375 },
];

export const TURRET_COUNT = TURRET_FRAMES.length;

/* ── Drawing ──────────────────────────────────────────────────── */

export interface DrawTurretOptions {
  scale?: number;
  /** Horizontal mirror around the anchor x. */
  flipX?: boolean;
  /** Tint multiplier — used for the soft drop-shadow pass at 0..0.4. */
  alpha?: number;
}

/**
 * Renders the painted turret for the given tower-kind id with its
 * pedestal base at world (x, y). Returns false if the painted sheet
 * hasn't loaded yet so the caller can fall back to the baked
 * pixel-art tower (see `drawTowers` in `game/render.ts`).
 */
export function drawTurret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kindId: string,
  opts?: DrawTurretOptions,
): boolean {
  if (!isSheetReady(turretSheet)) return false;
  const idx = TURRET_KIND_TO_FRAME[kindId] ?? 0;
  const frame = TURRET_FRAMES[idx]!;
  const scale = opts?.scale ?? 0.25;
  const flip = opts?.flipX === true;
  const alpha = opts?.alpha ?? 1;
  const drawW = frame.sw * scale;
  const drawH = frame.sh * scale;
  const dx = -frame.ax * scale;
  const dy = -frame.ay * scale;

  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(
    turretSheet.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    dx, dy, drawW, drawH,
  );
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
  ctx.restore();
  return true;
}

/** Painted turret bbox (in screen pixels at the given scale) from the
 *  pedestal base — useful for sizing the drop shadow and the level pip
 *  row beneath the painted sprite. */
export function getTurretFootprint(
  kindId: string,
  scale = 0.25,
): { width: number; height: number } {
  const idx = TURRET_KIND_TO_FRAME[kindId] ?? 0;
  const frame = TURRET_FRAMES[idx]!;
  return { width: frame.sw * scale, height: frame.sh * scale };
}
