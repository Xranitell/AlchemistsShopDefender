// Image-based sprite sheets for high-detail creature/mannequin animations.
//
// Distinct from the pixel-art `bakeSprite` system in `./sprite.ts`: those are
// generated procedurally from string grids and stay crisp at integer scales.
// These `AnimSheet`s wrap a normal PNG asset under `public/sprites/` that the
// browser loads asynchronously; the renderer falls back to the baked
// pixel-art version (see `getSprites()`) whenever the image isn't ready yet.
//
// Each sheet is a horizontal strip of 4 painted frames per row. Frames in
// painted spritesheets often DON'T sit cleanly on a uniform N-pixel grid —
// e.g. a running rat's tail extends from the next cell into the previous,
// or a slime's drip dribbles past the cell boundary. To avoid pulling
// neighbour content into the wrong frame, every frame carries its own
// source rect (`sx`, `sw`) and body-centre anchor (`ax`); the row's `sy`
// and `sh` stay shared so all 4 frames have the same vertical extent.
//
// The anchor is the painted body's mass-centre x within the source rect,
// expressed in cell-local pixels. `ay` is implied to be `sh` (frame
// bottom — i.e. the creature's "feet"). When the renderer draws frame f
// at world position (x, y), the source rect is sliced from the sheet and
// the (ax, sh) anchor lands on (x, y); the caller is expected to pick y
// equal to the shadow centre so feet sit on top of the drop shadow.

const sheetCache = new Map<string, AnimSheet>();

export interface AnimSheet {
  image: HTMLImageElement;
  loaded: boolean;
  url: string;
  /** Per-frame pre-baked canvases keyed by `sx_sy_sw_sh`. Each canvas
   *  is `sw+2 × sh+2` in size, with the source frame copied into the
   *  (1, 1) inset and a 1-pixel transparent border on every side. We
   *  draw from these padded canvases so that bilinear-interpolated
   *  scaling at the frame edges samples the transparent border instead
   *  of pulling the next frame's pixels in (which would manifest as
   *  thin coloured strips next to the body). */
  paddedFrames: Map<string, HTMLCanvasElement>;
}

/** 1-pixel transparent border around every padded frame. Anything ≥1
 *  is enough to keep bilinear interpolation from reaching across into
 *  the next frame; we use exactly 1 to keep memory minimal. */
export const FRAME_PADDING = 1;

export interface AnimFrame {
  /** Source rect in spritesheet pixels — left edge. */
  sx: number;
  /** Source rect width in spritesheet pixels. */
  sw: number;
  /** Body mass-centre x within the source rect (0..sw). Doubles as the
   *  draw anchor: when the frame is drawn at world (x, y), this anchor
   *  lands on (x, y). Per-frame so body stays put even when frame bboxes
   *  shift (e.g. squashed slime poses that grow leftward). */
  ax: number;
}

export interface AnimRow {
  sheet: AnimSheet;
  /** Source rect top y — shared by all frames in this row. */
  sy: number;
  /** Source rect height — shared. Anchor.y = sh (frame bottom). */
  sh: number;
  frames: AnimFrame[];
  /** Default render scale (source px → screen px). */
  scale: number;
}

export interface DrawAnimOptions {
  scale?: number;
  /** Mirror horizontally — used to flip enemies that should face left
   *  when they're moving toward a target on their left side. */
  flipX?: boolean;
}

export function loadSheet(url: string): AnimSheet {
  const cached = sheetCache.get(url);
  if (cached) return cached;
  const img = new Image();
  const sheet: AnimSheet = { image: img, loaded: false, url, paddedFrames: new Map() };
  img.addEventListener('load', () => {
    sheet.loaded = true;
  });
  img.addEventListener('error', () => {
    // Leave loaded=false; render path falls back to baked sprite.
    // eslint-disable-next-line no-console
    console.warn('[animatedSprite] failed to load', url);
  });
  img.src = url;
  sheetCache.set(url, sheet);
  return sheet;
}

export function isSheetReady(sheet: AnimSheet): boolean {
  return sheet.loaded && sheet.image.complete && sheet.image.naturalWidth > 0;
}

function pickFrame(row: AnimRow, frameIndex: number): AnimFrame {
  const n = row.frames.length;
  const f = ((frameIndex % n) + n) % n;
  // Non-null assertion: f is a valid index into a non-empty frames[].
  return row.frames[f]!;
}

/** Lazily extract a frame from the sheet into its own offscreen canvas
 *  with a 1-pixel transparent border. Cached on the sheet so each frame
 *  is baked at most once. Caller must ensure `isSheetReady(sheet)`. */
export function getPaddedFrame(
  sheet: AnimSheet,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement | null {
  const key = `${sx}_${sy}_${sw}_${sh}`;
  const cached = sheet.paddedFrames.get(key);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = sw + FRAME_PADDING * 2;
  canvas.height = sh + FRAME_PADDING * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet.image,
    sx, sy, sw, sh,
    FRAME_PADDING, FRAME_PADDING, sw, sh,
  );
  sheet.paddedFrames.set(key, canvas);
  return canvas;
}

/** Returns the screen-space rect of a frame drawn at (x,y). Mirrors
 *  drawAnimFrame's positioning so callers can paint hit-flash overlays. */
export function getAnimDrawRect(
  row: AnimRow,
  frameIndex: number,
  x: number,
  y: number,
  opts?: DrawAnimOptions,
): { x: number; y: number; w: number; h: number } {
  const frame = pickFrame(row, frameIndex);
  const scale = opts?.scale ?? row.scale;
  return {
    x: Math.round(x - frame.ax * scale),
    y: Math.round(y - row.sh * scale),
    w: Math.round(frame.sw * scale),
    h: Math.round(row.sh * scale),
  };
}

export function drawAnimFrame(
  ctx: CanvasRenderingContext2D,
  row: AnimRow,
  frameIndex: number,
  x: number,
  y: number,
  opts?: DrawAnimOptions,
): boolean {
  if (!isSheetReady(row.sheet)) return false;
  const frame = pickFrame(row, frameIndex);
  const padded = getPaddedFrame(row.sheet, frame.sx, row.sy, frame.sw, row.sh);
  if (!padded) return false;
  const scale = opts?.scale ?? row.scale;
  const drawW = Math.round(frame.sw * scale);
  const drawH = Math.round(row.sh * scale);
  // Anchor lands on (x, y); for flipped sprites we still want the body
  // mass-centre at x — i.e. mirror around `x`, not around the frame's
  // bbox centre. We therefore flip via translate(x) → scale(-1, 1) →
  // translate(-x) and then draw with the same un-flipped anchor maths.
  const drawX = Math.round(x - frame.ax * scale);
  const drawY = Math.round(y - row.sh * scale);
  ctx.save();
  // The painted spritesheets use anti-aliased shading; nearest-neighbour
  // downscaling makes them look jagged. Switch on bilinear smoothing for
  // the image blit only — surrounding pixel-art keeps its crisp setting.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  if (opts?.flipX) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  // Source rect skips the 1-px transparent border so the rendered body
  // is identical, but bilinear sampling at the edge picks up the border
  // (alpha=0) instead of leaking into neighbouring frames on the sheet.
  ctx.drawImage(
    padded,
    FRAME_PADDING,
    FRAME_PADDING,
    frame.sw,
    row.sh,
    drawX,
    drawY,
    drawW,
    drawH,
  );
  ctx.restore();
  return true;
}

// Scratch canvas reused across paintAnimFrameTint calls — sized to the
// largest sprite seen so far. Module-scoped so allocation only happens
// once per page lifetime.
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function ensureScratch(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
    scratchCtx = scratchCanvas.getContext('2d');
  }
  if (!scratchCtx) return null;
  if (scratchCanvas.width < w || scratchCanvas.height < h) {
    scratchCanvas.width = Math.max(scratchCanvas.width, Math.ceil(w));
    scratchCanvas.height = Math.max(scratchCanvas.height, Math.ceil(h));
  }
  return { canvas: scratchCanvas, ctx: scratchCtx };
}

/** Paint a translucent flat-colour tint over a frame, masked to the
 *  frame's actual non-transparent pixels. Use for hit/damage flashes:
 *  a naive `source-atop fillRect` on the main canvas tints the
 *  surrounding floor as well (the floor already has alpha = 255), so
 *  we composite via a scratch canvas instead. Returns false if the
 *  sheet hasn't loaded — caller can skip the overlay in that case. */
export function paintAnimFrameTint(
  ctx: CanvasRenderingContext2D,
  row: AnimRow,
  frameIndex: number,
  x: number,
  y: number,
  tintColor: string,
  tintAlpha: number,
  opts?: DrawAnimOptions,
): boolean {
  if (!isSheetReady(row.sheet)) return false;
  const frame = pickFrame(row, frameIndex);
  const padded = getPaddedFrame(row.sheet, frame.sx, row.sy, frame.sw, row.sh);
  if (!padded) return false;
  const scale = opts?.scale ?? row.scale;
  const drawW = Math.round(frame.sw * scale);
  const drawH = Math.round(row.sh * scale);
  if (drawW <= 0 || drawH <= 0) return false;
  const drawX = Math.round(x - frame.ax * scale);
  const drawY = Math.round(y - row.sh * scale);

  const scratch = ensureScratch(drawW, drawH);
  if (!scratch) return false;
  const { canvas: sCanvas, ctx: sCtx } = scratch;

  // 1. Clear the region we'll use (only the top-left drawW x drawH).
  sCtx.save();
  sCtx.setTransform(1, 0, 0, 1, 0, 0);
  sCtx.globalCompositeOperation = 'source-over';
  sCtx.globalAlpha = 1;
  sCtx.clearRect(0, 0, drawW, drawH);
  // 2. Paint the sprite frame at (0,0) with the same bilinear settings
  //    drawAnimFrame uses, so the tint mask matches the rendered shape.
  //    Source comes from the per-frame padded canvas so bilinear
  //    sampling at the edges hits the transparent border, not the next
  //    frame on the sheet.
  sCtx.imageSmoothingEnabled = true;
  sCtx.imageSmoothingQuality = 'medium';
  sCtx.drawImage(
    padded,
    FRAME_PADDING,
    FRAME_PADDING,
    frame.sw,
    row.sh,
    0,
    0,
    drawW,
    drawH,
  );
  // 3. source-atop now safely tints ONLY the sprite pixels (scratch
  //    canvas has nothing else underneath).
  sCtx.globalCompositeOperation = 'source-atop';
  sCtx.globalAlpha = tintAlpha;
  sCtx.fillStyle = tintColor;
  sCtx.fillRect(0, 0, drawW, drawH);
  sCtx.restore();

  // 4. Blit the tinted sprite back into the main canvas, mirroring
  //    flipX the same way drawAnimFrame does.
  ctx.save();
  if (opts?.flipX) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(sCanvas, 0, 0, drawW, drawH, drawX, drawY, drawW, drawH);
  ctx.restore();
  return true;
}
