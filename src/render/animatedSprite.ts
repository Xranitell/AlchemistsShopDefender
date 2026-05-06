// Image-based sprite sheets for high-detail creature/mannequin animations.
//
// Distinct from the pixel-art `bakeSprite` system in `./sprite.ts`: those are
// generated procedurally from string grids and stay crisp at integer scales.
// These `AnimSheet`s wrap a normal PNG asset under `public/sprites/` that the
// browser loads asynchronously; the renderer falls back to the baked
// pixel-art version (see `getSprites()`) whenever the image isn't ready yet.
//
// Each sheet is a horizontal strip of N equal-width frames per row; rows on
// the same image can have different vertical extents (e.g. small slime row,
// taller golem row) so each `AnimRow` carries its own `rowY` / `cellH`.
//
// Anchors are expressed in CELL-LOCAL pixels (relative to the top-left of the
// frame's source rect). When drawn, the anchor lands on the supplied (x, y)
// world coordinate; we use bottom-centre anchoring so creatures' "feet" sit
// on the entity position, matching the convention used by the baked sprites.

const sheetCache = new Map<string, AnimSheet>();

export interface AnimSheet {
  image: HTMLImageElement;
  loaded: boolean;
  url: string;
}

export interface AnimRow {
  sheet: AnimSheet;
  /** Number of horizontal frames in this row (typically 4). */
  frames: number;
  /** Width of one frame's source rect, in spritesheet pixels. */
  cellW: number;
  /** Height of one frame's source rect, in spritesheet pixels. */
  cellH: number;
  /** Y offset of this row inside the spritesheet. */
  rowY: number;
  /** Optional X offset; defaults to 0 (frames start flush left). */
  rowX?: number;
  /** Anchor inside the frame's source rect (0..cellW, 0..cellH). */
  anchor: { x: number; y: number };
  /** Default render scale (cell px → screen px). Can be overridden per-call. */
  scale: number;
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

/** Returns the screen-space rect of a frame drawn at (x,y). Mirrors
 *  drawAnimFrame's positioning so callers can paint hit-flash overlays. */
export function getAnimDrawRect(
  row: AnimRow,
  x: number,
  y: number,
  scaleOverride?: number,
): { x: number; y: number; w: number; h: number } {
  const scale = scaleOverride ?? row.scale;
  return {
    x: Math.round(x - row.anchor.x * scale),
    y: Math.round(y - row.anchor.y * scale),
    w: Math.round(row.cellW * scale),
    h: Math.round(row.cellH * scale),
  };
}

export function drawAnimFrame(
  ctx: CanvasRenderingContext2D,
  row: AnimRow,
  frameIndex: number,
  x: number,
  y: number,
  scaleOverride?: number,
): boolean {
  if (!isSheetReady(row.sheet)) return false;
  const f = ((frameIndex % row.frames) + row.frames) % row.frames;
  const sx = (row.rowX ?? 0) + f * row.cellW;
  const sy = row.rowY;
  const rect = getAnimDrawRect(row, x, y, scaleOverride);
  ctx.save();
  // The painted spritesheets use anti-aliased shading; nearest-neighbour
  // downscaling makes them look jagged. Switch on bilinear smoothing for the
  // image blit only — surrounding pixel-art draws keep their crisp setting.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(row.sheet.image, sx, sy, row.cellW, row.cellH, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  return true;
}
