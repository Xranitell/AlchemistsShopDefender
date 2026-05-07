// DOM helper that renders an `AnimRow` as a self-updating <canvas>.
//
// Mirrors `spriteIcon.ts` for the painted spritesheet pipeline: where
// `spriteIcon` blits a single baked frame, this version cycles through
// the row's painted frames at a fixed FPS so menus / overlays can show
// a living idle loop instead of a static pose. Frames have variable
// widths and per-frame body anchors, so we centre each frame inside the
// canvas via its `ax` mass-centre and bottom-align it onto the canvas
// floor — this keeps the body stable even when frame bboxes wobble.
//
// The canvas drives its own `requestAnimationFrame` loop and stops the
// moment it leaves the DOM (a MutationObserver on `<body>` watches for
// detachment), so callers don't need to handle teardown manually.

import { FRAME_PADDING, getPaddedFrame, isSheetReady, type AnimRow } from './animatedSprite';

export interface AnimatedSpriteIconOptions {
  /** Output canvas size in CSS pixels. The painted sprite is centred
   *  horizontally on its mass anchor and bottom-aligned vertically. */
  width: number;
  height: number;
  /** Cycle speed. Defaults to a slow ~3.3 fps idle pulse so a 4-frame
   *  loop reads as a ~1.2 s breathing rhythm. */
  fps?: number;
  /** Extra CSS class added to the returned canvas. */
  extraClass?: string;
  /** Accessible label / tooltip. */
  title?: string;
  /** Fraction of the canvas height the sprite should occupy. 0.95 leaves
   *  a thin margin so the floor doesn't clip. */
  fitScale?: number;
  /** When set, freeze on this single frame instead of looping. Used by
   *  the defeat panel which only needs a static "fallen" pose. */
  staticFrameIndex?: number;
  /** Vertical floor offset (pixels) inside the canvas. 0 = sprite's
   *  feet sit on the bottom edge. Positive values nudge the sprite up
   *  to leave room for a CSS drop-shadow / floor element underneath. */
  floorOffset?: number;
}

export function animatedSpriteIcon(
  row: AnimRow,
  opts: AnimatedSpriteIconOptions,
): HTMLCanvasElement {
  const {
    width, height,
    fps = 3.3,
    extraClass = '',
    title,
    fitScale = 0.95,
    staticFrameIndex,
    floorOffset = 0,
  } = opts;

  const canvas = document.createElement('canvas');
  // The backing store matches CSS pixels at 1×; the menu / defeat host
  // boxes are small enough that we don't need a HiDPI mode here.
  canvas.width = width;
  canvas.height = height;
  canvas.className = ('mannequin-anim ' + extraClass).trim();
  if (title) canvas.title = title;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  // Frame slot size: scale the painted body so it fits inside the
  // requested fraction of the canvas on BOTH axes. Some painted rows
  // (e.g. the slime walk-cycle's stretched mid-frames at sw=260) are
  // significantly wider than the row's height, so a height-only scale
  // would clip the body horizontally. We therefore take the minimum of
  // (height-fit, width-fit-against-the-widest-frame) and use that as
  // the uniform scale, then fall back to bottom-anchoring at the
  // resulting rendered height.
  let maxFrameW = row.sh;
  for (const f of row.frames) if (f.sw > maxFrameW) maxFrameW = f.sw;
  const heightLimit = (height * fitScale) / row.sh;
  const widthLimit = (width * fitScale) / maxFrameW;
  const scale = Math.min(heightLimit, widthLimit);
  const renderedH = row.sh * scale;

  const drawFrameAt = (frameIdx: number): void => {
    const frames = row.frames;
    if (!frames.length) return;
    const f = ((frameIdx % frames.length) + frames.length) % frames.length;
    const frame = frames[f]!;
    const padded = getPaddedFrame(row.sheet, frame.sx, row.sy, frame.sw, row.sh);
    if (!padded) return;
    const renderedW = frame.sw * scale;
    // Anchor the body centre at canvas mid-x and bottom-align onto the
    // canvas floor (with optional `floorOffset` for callers that paint
    // a drop-shadow underneath).
    const dx = Math.round(width / 2 - frame.ax * scale);
    const dy = Math.round(height - renderedH - floorOffset);
    ctx.clearRect(0, 0, width, height);
    // Source skips the 1-px transparent border so bilinear sampling at
    // the body edges hits transparent padding, not the next frame on
    // the sheet (which previously appeared as thin coloured strips
    // beside the body in the menu portrait).
    ctx.drawImage(
      padded,
      FRAME_PADDING, FRAME_PADDING, frame.sw, row.sh,
      dx, dy, renderedW, renderedH,
    );
  };

  // Static fallback path: caller pinned the icon to a specific frame.
  if (typeof staticFrameIndex === 'number') {
    const paintWhenReady = () => {
      if (!canvas.isConnected) return;
      if (isSheetReady(row.sheet)) {
        drawFrameAt(staticFrameIndex);
        return;
      }
      requestAnimationFrame(paintWhenReady);
    };
    requestAnimationFrame(paintWhenReady);
    return canvas;
  }

  // Animated path: drive a low-rate idle loop. We keep the rAF scheduled
  // even before the sheet has loaded so we pick up the first frame the
  // moment the PNG resolves.
  let raf = 0;
  let lastFrame = -1;
  const startTs = performance.now();
  const draw = (now: number): void => {
    if (!canvas.isConnected) return;
    if (!isSheetReady(row.sheet)) {
      raf = requestAnimationFrame(draw);
      return;
    }
    const elapsed = (now - startTs) / 1000;
    const frameIdx = Math.floor(elapsed * fps) % row.frames.length;
    if (frameIdx !== lastFrame) {
      lastFrame = frameIdx;
      drawFrameAt(frameIdx);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  // Stop the loop the moment the canvas is removed from the DOM. The
  // observer is scoped to `body` (sufficient for any panel) and tears
  // itself down once it fires, so we don't leak across menu tabs.
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => {
      if (!canvas.isConnected) {
        cancelAnimationFrame(raf);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  return canvas;
}
