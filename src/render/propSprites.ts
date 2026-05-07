// Painted props spritesheet (`public/sprites/props.png`).
//
// 10 hand-drawn alchemy-shop props (open spellbook, closed book, alchemy
// distiller, potion rack, brazier, gold sack, scroll, potion crate, jar,
// cauldron) scattered randomly across the floor as decorative dressing.
//
// The sheet is a 1200 × 960 PNG laid out as a 4 × 3 grid of 300 × 320
// cells (the bottom-left and bottom-right cells are blank — only 10 of
// 12 cells contain a prop). The frame rects below were tightened to the
// painted pixels of each cell (alpha > 200) so we sample only the body,
// not the speckled cell margin.
//
// Anchor convention: every prop is centred horizontally on its bbox and
// bottom-aligned to its feet (i.e. `ax = sw/2`, `ay = sh`). Drawing
// `drawProp(ctx, x, y, id)` then plants the prop's base at world (x, y).

import { loadSheet, isSheetReady, type AnimSheet } from './animatedSprite';

/* ── Sheet ──────────────────────────────────────────────────────── */
export const propsSheet: AnimSheet = loadSheet('sprites/props.png');

/** Subscribe to load — used by `room.ts` to invalidate the baked
 *  backdrop the moment the props PNG resolves so the props become
 *  visible without waiting for a biome / size change. */
export function onPropsSheetLoad(cb: () => void): void {
  if (isSheetReady(propsSheet)) {
    cb();
    return;
  }
  propsSheet.image.addEventListener('load', cb, { once: true });
}

/* ── Frame table ───────────────────────────────────────────────────
 * Each entry is the painted body's tight bbox in sheet pixels. `ax`
 * stays at the body centre; `ay` is implicit (`sh`, frame bottom).
 * Order matches the sheet left-to-right, top-to-bottom.
 *
 * 0  open spellbook        4  brazier            8  jar with mushroom
 * 1  closed book           5  gold sack          9  cauldron
 * 2  alchemy distiller     6  scroll
 * 3  potion rack           7  potion crate
 */
export interface PropFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  ax: number;
  ay: number;
}

export const PROP_FRAMES: readonly PropFrame[] = [
  { sx:  36, sy: 141, sw: 273, sh: 210, ax: 273 / 2, ay: 210 },
  { sx: 358, sy: 131, sw: 233, sh: 224, ax: 233 / 2, ay: 224 },
  { sx: 618, sy: 159, sw: 250, sh: 203, ax: 250 / 2, ay: 203 },
  { sx: 903, sy: 138, sw: 272, sh: 224, ax: 272 / 2, ay: 224 },
  { sx:  74, sy: 374, sw: 189, sh: 260, ax: 189 / 2, ay: 260 },
  { sx: 333, sy: 447, sw: 247, sh: 176, ax: 247 / 2, ay: 176 },
  { sx: 602, sy: 423, sw: 228, sh: 197, ax: 228 / 2, ay: 197 },
  { sx: 898, sy: 413, sw: 265, sh: 229, ax: 265 / 2, ay: 229 },
  { sx: 333, sy: 654, sw: 169, sh: 221, ax: 169 / 2, ay: 221 },
  { sx: 602, sy: 667, sw: 228, sh: 211, ax: 228 / 2, ay: 211 },
];

export const PROP_COUNT = PROP_FRAMES.length;

/* ── Drawing ──────────────────────────────────────────────────────
 * Renders prop `id` with its base at (x, y). Optional mirror flip
 * (probability 50% from the caller) and a small rotation (radians)
 * applied around (x, y) so the prop tilts naturally on the floor.
 *
 * Returns false if the sheet hasn't loaded yet (caller can no-op or
 * the room cache will be re-baked once the load event fires).
 */
export interface DrawPropOptions {
  scale?: number;
  /** Horizontal mirror around the anchor x. */
  flipX?: boolean;
  /** Tilt in radians, applied around the anchor (x, y). */
  rotation?: number;
  /** Multiplied with the body before drawing — used for the soft
   *  drop-shadow pass at 0..0.4. */
  alpha?: number;
}

export function drawProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  opts?: DrawPropOptions,
): boolean {
  if (!isSheetReady(propsSheet)) return false;
  const frame = PROP_FRAMES[((id % PROP_COUNT) + PROP_COUNT) % PROP_COUNT]!;
  const scale = opts?.scale ?? 0.22;
  const rot = opts?.rotation ?? 0;
  const flip = opts?.flipX === true;
  const alpha = opts?.alpha ?? 1;
  const drawW = frame.sw * scale;
  const drawH = frame.sh * scale;
  // Body anchor lands on (x, y); the frame is centred horizontally on
  // ax and bottom-aligned on ay (=== sh).
  const dx = -frame.ax * scale;
  const dy = -frame.ay * scale;

  ctx.save();
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  // Painted props look smoother with bilinear filtering — same choice
  // the painted-mannequin pipeline makes (`animatedSprite.ts`).
  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  // Darken + slightly desaturate the source spritesheet so the props
  // blend into the muted stone-floor palette instead of popping as
  // brightly-painted islands. The shadow pass (alpha < 1) is already
  // a near-black silhouette so we skip the filter for it — applying
  // brightness(0.7) to a 20%-alpha black silhouette would muddy it
  // into the floor and lose the grounding shadow underfoot.
  const isShadowPass = alpha < 1;
  const prevFilter = ctx.filter;
  if (!isShadowPass) ctx.filter = 'brightness(0.72) saturate(0.88)';
  ctx.drawImage(
    propsSheet.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    dx, dy, drawW, drawH,
  );
  if (!isShadowPass) ctx.filter = prevFilter;
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
  ctx.restore();
  return true;
}
