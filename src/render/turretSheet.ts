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
// Anchor convention: each tower's anchor sits at the visual centre +
// bottom of its **pedestal-ring base** (the wide brick disc at the
// foot of the body), NOT at the bbox centre / bbox bottom. The bbox is
// tight to all opaque pixels of the painted body — including hanging
// detail like the mortar's red flask, the mercury sprayer's bottle,
// the cannon barrels poking out, the ether coil's curling pipes, etc.
// Those off-pedestal elements push the bbox left/right/down beyond the
// pedestal disc, so anchoring at `(sw / 2, sh)` would offset the
// pedestal away from the rune-point centre and leave the visible feet
// of the stand outside the buff halo / drop shadow / chalk circle
// (which all anchor on the rune itself).
//
// `(ax, ay)` are bbox-local pixel coords obtained by per-frame pixel
// analysis of the painted spritesheet (see
// `tools/analyze_stands_v3.py`): for each frame we walk the bottom
// 35 % of the bbox, find the bottommost contiguous run of rows that
// are ≥ 55 % of the band's max width (= the brick-ring base), and pick
// the centre-x of that run as `ax` and the bottom-y as `ay`. Drawing
// `drawTurret(ctx, x, y, kindId)` then plants the pedestal-ring's
// **bottom** on the world (x, y) — same anchor the rune-point chalk
// circle / drop shadow / buff halo all sit on, so the tower's feet
// land inside the halo instead of floating above it.

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

// Per-frame `(ax, ay)` is the centre-x and bottom-y of the painted
// brick-ring pedestal in bbox-local px (see anchor-convention block at
// the top of this file). The values came from a connected-component
// analysis of the painted PNG, then snapped to integer px. Hand-tune
// only if a sprite is replaced; otherwise leave alone — they line up
// with the floor decals (drop shadow / buff halo / chalk circle) which
// all anchor on the rune-point centre at `t.pos`.
export const TURRET_FRAMES: readonly TurretFrame[] = [
  // 0  needler           — multi-barrel brass cannon
  { sx:  87, sy: 152, sw: 276, sh: 328, ax: 160, ay: 268 },
  // 1  mortar            — bubbling alchemy cauldron (red flask hangs
  //                       low on the right; bbox extends past the
  //                       pedestal ring to capture it)
  { sx: 453, sy:  90, sw: 277, sh: 390, ax: 137, ay: 335 },
  // 2  mercury_sprayer   — steam-pump pressure rig (steam puff top-left
  //                       and bottle bottom-left push the bbox left)
  { sx: 806, sy: 120, sw: 302, sh: 360, ax: 176, ay: 304 },
  // 3  acid_injector     — green-liquid test-tube refinery (needle pokes
  //                       far left of the pedestal)
  { sx:  45, sy: 480, sw: 307, sh: 374, ax: 175, ay: 359 },
  // 4  ether_coil        — purple Tesla coil
  { sx: 458, sy: 480, sw: 277, sh: 373, ax: 140, ay: 363 },
  // 5  watch_tower       — glass-and-brass alchemist's lantern (pendant
  //                       on left, flag on right cancel out — pedestal
  //                       lands almost on bbox centre)
  { sx: 854, sy: 480, sw: 251, sh: 375, ax: 125, ay: 368 },
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
 *  stand on its rune. Each painted frame's anchor `(ax, ay)` lands at
 *  the centre-bottom of its **pedestal-ring base** (see anchor block
 *  at the top of this file), so drawing at `t.pos.y - LIFT_Y` puts the
 *  pedestal-ring's bottom row of pixels at `t.pos.y - LIFT_Y`. Floor
 *  decals (drop shadow, buff halo, range indicator, EMP overlay) all
 *  anchor at `t.pos.y + 4` (see `drawTowerFloor`), so we lift the body
 *  by the same `-4` so the pedestal's bottom lands inside the buff
 *  halo instead of past it. The chalk circle (2:1 ellipse, ry=11 — see
 *  `drawRunePoints`) ends up just at the bottom edge of the pedestal,
 *  reading as "the rune the stand is standing on" while the buff halo
 *  paints behind / through the legs. */
export const PAINTED_TURRET_LIFT_Y = -4;

/** World-space Y offset from the painted turret's pedestal base (where
 *  `t.pos` sits) to the vertical mid-point of the turret body. Used by
 *  the firing pipeline so projectiles spawn from roughly the centre of
 *  the stand instead of from the ground at its feet. Negative because
 *  Y increases downward in screen space. The lift offset is added on
 *  top so projectiles spawn from the centre of the *floating* stand,
 *  not the ground beneath it.
 *
 *  Uses `getTurretFootprint().height`, which is `ay * scale` — the
 *  height of the painted body **above the pedestal-ring anchor**. The
 *  bbox can extend below the anchor (e.g. mortar's red flask), but
 *  those hanging elements aren't part of the body's vertical footprint
 *  for fire-origin purposes, so we exclude them. */
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

/** Painted turret footprint (in screen pixels at the given scale).
 *  - `width`  is the full bbox width (`sw * scale`) — useful for sizing
 *    the drop shadow / buff halo, which want to span the whole visual
 *    silhouette.
 *  - `height` is the body height **above the pedestal-ring anchor**
 *    (`ay * scale`), NOT the full bbox height. Anything below the
 *    pedestal anchor (e.g. the mortar's red flask, the mercury
 *    sprayer's bottle) is hanging detail that lives on the floor in
 *    front of the pedestal — it isn't part of the stand's silhouette
 *    for layout purposes, so consumers like `drawTowerBody` (which
 *    uses `painted.height` to compute the body-top Y for muzzle flashes
 *    / sparkles / fireflies) and `getTurretFireOriginOffsetY` would
 *    over-estimate the body if they used `sh * scale`. */
export function getTurretFootprint(
  kindId: string,
  scale = 0.25,
): { width: number; height: number } {
  const idx = TURRET_KIND_TO_FRAME[kindId] ?? 0;
  const frame = TURRET_FRAMES[idx]!;
  return { width: frame.sw * scale, height: frame.ay * scale };
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
