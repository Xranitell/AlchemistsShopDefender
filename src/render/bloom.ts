// Cheap fake-bloom pass. Runs once per frame after the world has been
// rendered but before the cinematic vignette / damage flash, so bright
// emissive elements (overload bolts, fire-pool cores, glow halos, crit
// halos) get a soft additive lift while dark areas stay mostly dark.
//
// Implementation:
//   1. Downsample the main canvas to a 1/4-resolution buffer (cheap and
//      naturally averages bright clusters into bigger blobs).
//   2. Apply a "threshold" by multiplying the buffer by a mid-grey so
//      dim pixels collapse to ~black; bright pixels still have headroom.
//   3. Blur the thresholded buffer into a second 1/4-resolution buffer
//      using the canvas `filter: blur(...)` API — GPU-accelerated on
//      every modern browser engine.
//   4. Composite the blur back onto the main canvas at a low alpha with
//      `globalCompositeOperation = 'lighter'` (additive). The upsample
//      uses smoothing on the bloom layer only — the rest of the world
//      stays pixel-art crisp because we restore the smoothing state.
//
// The canvases are cached at module level (resized lazily when the main
// canvas changes size) so per-frame cost is just three drawImage calls
// plus a fill.

let downsampleCanvas: HTMLCanvasElement | null = null;
let downsampleCtx: CanvasRenderingContext2D | null = null;
let blurCanvas: HTMLCanvasElement | null = null;
let blurCtx: CanvasRenderingContext2D | null = null;
let cachedW = 0;
let cachedH = 0;

function ensureBuffers(w: number, h: number): boolean {
  if (cachedW === w && cachedH === h && downsampleCtx && blurCtx) return true;
  downsampleCanvas = document.createElement('canvas');
  downsampleCanvas.width = w;
  downsampleCanvas.height = h;
  downsampleCtx = downsampleCanvas.getContext('2d');
  blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  blurCtx = blurCanvas.getContext('2d');
  if (!downsampleCtx || !blurCtx) {
    downsampleCanvas = null;
    blurCanvas = null;
    downsampleCtx = null;
    blurCtx = null;
    return false;
  }
  // Smoothing on for the bloom buffers — we *want* the soft averaging.
  downsampleCtx.imageSmoothingEnabled = true;
  blurCtx.imageSmoothingEnabled = true;
  cachedW = w;
  cachedH = h;
  return true;
}

export function applyBloom(
  mainCtx: CanvasRenderingContext2D,
  mainCanvas: HTMLCanvasElement,
  intensity = 0.32,
  blurPx = 5,
  threshold = 130,
): void {
  if (intensity <= 0) return;
  const fullW = mainCanvas.width;
  const fullH = mainCanvas.height;
  const w = Math.max(1, Math.floor(fullW / 4));
  const h = Math.max(1, Math.floor(fullH / 4));
  if (!ensureBuffers(w, h)) return;
  const dsCtx = downsampleCtx!;
  const blCtx = blurCtx!;

  // 1. Downsample.
  dsCtx.globalCompositeOperation = 'source-over';
  dsCtx.globalAlpha = 1;
  dsCtx.clearRect(0, 0, w, h);
  dsCtx.drawImage(mainCanvas, 0, 0, w, h);

  // 2. Threshold via `multiply` with a mid-grey. Dim pixels become near-
  //    black; bright pixels stay bright. `threshold` is the multiplier
  //    component (0–255) — 130 is a sensible "keep highlights only"
  //    cutoff for the game's existing colour palette.
  dsCtx.globalCompositeOperation = 'multiply';
  dsCtx.fillStyle = `rgb(${threshold},${threshold},${threshold})`;
  dsCtx.fillRect(0, 0, w, h);
  dsCtx.globalCompositeOperation = 'source-over';

  // 3. Blur into the second buffer.
  blCtx.clearRect(0, 0, w, h);
  blCtx.filter = `blur(${blurPx}px)`;
  blCtx.drawImage(downsampleCanvas!, 0, 0);
  blCtx.filter = 'none';

  // 4. Additive composite back to main. We re-enable smoothing on the
  //    main ctx for this draw so the upscale interpolates softly, then
  //    rely on the caller's existing `imageSmoothingEnabled = false`
  //    (set at the top of `render()`) to remain in effect via save/restore.
  mainCtx.save();
  mainCtx.globalCompositeOperation = 'lighter';
  mainCtx.globalAlpha = intensity;
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.drawImage(blurCanvas!, 0, 0, fullW, fullH);
  mainCtx.restore();
}

export function resetBloom(): void {
  downsampleCanvas = null;
  blurCanvas = null;
  downsampleCtx = null;
  blurCtx = null;
  cachedW = 0;
  cachedH = 0;
}
