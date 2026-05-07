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

/** Default render scale for painted turret stands. The 0.25 factor maps
 *  the largest 390-px frame down to ~98 px tall on the canvas — roughly
 *  the same screen footprint as the older baked pixel-art tower at
 *  TOWER_SCALE = 3. Shared between `drawTowers` (rendering) and
 *  `updateTowers` (firing-height math) so both call-sites agree on the
 *  on-screen size of the turret. */
export const PAINTED_TURRET_SCALE = 0.25;

/** World-space Y offset (negative = down in screen space because the
 *  caller does `t.pos.y - LIFT_Y`) used to plant the painted turret
 *  stand on its rune. Negative ⇒ the pedestal base is pushed *past* the
 *  centre of the chalk circle and onto its front edge, so the rune
 *  reads as the floor the stand is standing *on* rather than a halo the
 *  body is hovering *above*. The chalk circle is a 2:1 floor ellipse
 *  with horizontal radius 22 (see `drawRunePoints`) — its iso-front
 *  edge sits at `rp.pos.y + 11`, so we drop the body well past that
 *  (-42) so the bottom contour of the body lands cleanly on the floor
 *  instead of hovering above the player's selected rune.
 *  The drop shadow + lantern halos still anchor at `t.pos.y` so the
 *  floor decals stay readable. */
export const PAINTED_TURRET_LIFT_Y = -42;

/** World-space Y offset from the painted turret's pedestal base (where
 *  `t.pos` sits) to the vertical mid-point of the turret body. Used by
 *  the firing pipeline so projectiles spawn from roughly the centre of
 *  the stand instead of from the ground at its feet. Negative because
 *  Y increases downward in screen space. The lift offset is added on
 *  top so projectiles spawn from the centre of the *floating* stand,
 *  not the ground beneath it. */
export function getTurretFireOriginOffsetY(
  kindId: string,
  scale: number = PAINTED_TURRET_SCALE,
): number {
  return -getTurretFootprint(kindId, scale).height / 2 - PAINTED_TURRET_LIFT_Y;
}

/** True once the painted turret-stands PNG has finished loading. The
 *  `drawTurret` helper falls back to baked pixel-art when the sheet is
 *  not yet ready, so call-sites that need to know in advance whether
 *  the painted footprint will be drawn (e.g. the elevation lift in
 *  `drawTowers`) can branch on this instead of post-hoc on the return
 *  value of `drawTurret`. */
export function isPaintedTurretSheetReady(): boolean {
  return isSheetReady(turretSheet);
}

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

/** Returns an `HTMLCanvasElement` with the painted turret body fitted
 *  into a `size × size` box. The painted frame is scaled so its longer
 *  side fills `size * fitScale`, then centred horizontally and
 *  vertically within the canvas. Used by the Alchemist's Diary to show
 *  the actual game sprite for each tower (instead of a placeholder
 *  pixel-art icon).
 *
 *  When the painted sheet has not finished loading yet, the canvas is
 *  returned empty and a `load` listener is attached that paints the
 *  turret as soon as the PNG resolves — same lazy-paint pattern as
 *  `animatedSpriteIcon`. The canvas always returns immediately so the
 *  DOM layout is stable. */
export function paintedTurretIcon(
  kindId: string,
  size: number,
  opts: { fitScale?: number; extraClass?: string; title?: string } = {},
): HTMLCanvasElement {
  const idx = TURRET_KIND_TO_FRAME[kindId];
  const frame = idx != null ? TURRET_FRAMES[idx] : undefined;
  const fitScale = opts.fitScale ?? 0.94;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.className = ('turret-icon ' + (opts.extraClass ?? '')).trim();
  if (opts.title) canvas.title = opts.title;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  if (!frame) return canvas;

  const paint = (): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    // Fit the painted body into the icon canvas, preserving aspect ratio
    // and reserving `(1 - fitScale)` worth of padding on every side.
    const targetH = size * fitScale;
    const targetW = size * fitScale;
    const scale = Math.min(targetW / frame.sw, targetH / frame.sh);
    const drawW = frame.sw * scale;
    const drawH = frame.sh * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;
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
  };

  if (isSheetReady(turretSheet)) {
    paint();
  } else {
    onTurretSheetLoad(paint);
  }
  return canvas;
}
