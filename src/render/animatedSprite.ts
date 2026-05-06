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
}

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
  const sheet: AnimSheet = { image: img, loaded: false, url };
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
  ctx.drawImage(
    row.sheet.image,
    frame.sx,
    row.sy,
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
