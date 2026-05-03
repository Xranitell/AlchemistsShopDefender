// Cached radial-glow sprites.
//
// The renderer calls into a handful of glow effects every frame (mannequin
// core glow, fire-pool lights, tower halos, status auras, the screen
// vignette, …). Each one used to do a fresh `ctx.createRadialGradient` +
// `ctx.fillRect` per frame, which on mobile turned out to be one of the
// most expensive things the game does — gradient objects allocate, and
// `fillRect` with a gradient fill is several times slower than a
// `drawImage` from a pre-baked offscreen canvas.
//
// `getRadialGlowSprite` bakes a radial gradient into an offscreen
// HTMLCanvasElement once (keyed by radius + colour stops) and the renderer
// just blits it via `drawImage`. The sprite is sized 2*radius on each side
// and the gradient is centred so the caller draws it at `(cx - r, cy - r)`.
//
// Cache size is bounded in practice: most call sites use small fixed
// radii. The few variable-radius ones (boss glow, fire pool light) feed
// their values through `Math.round` which limits the unique keys to a
// handful per enemy kind / pool radius.
//
// IMPORTANT: this module is import-time-safe. The actual canvas creation
// happens lazily on first call, so unit tests that import the file
// without a DOM still work.

export type GlowStop = readonly [offset: number, color: string];

interface GlowKey {
  radius: number;
  stops: readonly GlowStop[];
}

const cache = new Map<string, HTMLCanvasElement>();

function keyFor(k: GlowKey): string {
  // Deterministic, cheap key — radius + comma-separated stops.
  let s = `r${k.radius}|`;
  for (let i = 0; i < k.stops.length; i++) {
    const stop = k.stops[i]!;
    s += stop[0] + ':' + stop[1] + ';';
  }
  return s;
}

/** Get (or bake) a radial-glow sprite. The returned canvas has dimensions
 *  `2*radius × 2*radius` with the gradient centred. Draw it at
 *  `(cx - radius, cy - radius)` to align with the centre of the effect.
 *
 *  `radius` is rounded to an integer to keep the cache bounded. Callers
 *  are responsible for passing colour-stop arrays that are stable across
 *  frames (use module-scope `as const` arrays where possible). */
export function getRadialGlowSprite(
  radius: number,
  stops: readonly GlowStop[],
): HTMLCanvasElement {
  const r = Math.max(1, Math.round(radius));
  const k = keyFor({ radius: r, stops });
  const cached = cache.get(k);
  if (cached) return cached;

  const size = r * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d');
  if (!cx) {
    // Fallback — return an empty canvas. Renderer's drawImage will be a
    // no-op, which is preferable to throwing at import time.
    cache.set(k, c);
    return c;
  }
  const grad = cx.createRadialGradient(r, r, 0, r, r, r);
  for (let i = 0; i < stops.length; i++) {
    const [offset, color] = stops[i]!;
    grad.addColorStop(offset, color);
  }
  cx.fillStyle = grad;
  cx.fillRect(0, 0, size, size);

  cache.set(k, c);
  return c;
}

/** Convenience helper: blit a cached glow sprite centred on `(x, y)`. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly GlowStop[],
): void {
  const r = Math.max(1, Math.round(radius));
  const sprite = getRadialGlowSprite(r, stops);
  ctx.drawImage(sprite, Math.round(x - r), Math.round(y - r));
}

/** Like `drawGlow`, but baked at a different inner-radius offset.
 *
 *  Some glows in the game start non-zero (e.g. the shield bubble's halo
 *  starts the gradient at `radius * 0.55`, which produces a "hollow"
 *  ring instead of a filled disk). For those we bake the offset into the
 *  cache key so the lookup still hits.
 *
 *  `outerRadius` decides the sprite's actual canvas size. */
export function getRadialGlowSpriteCustom(
  outerRadius: number,
  stops: readonly GlowStop[],
  innerRadius: number,
): HTMLCanvasElement {
  const r = Math.max(1, Math.round(outerRadius));
  const ir = Math.max(0, Math.round(innerRadius));
  const k = `r${r}|i${ir}|` + stops.map(([o, c]) => `${o}:${c}`).join(';');
  const cached = cache.get(k);
  if (cached) return cached;

  const size = r * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d');
  if (!cx) {
    cache.set(k, c);
    return c;
  }
  const grad = cx.createRadialGradient(r, r, ir, r, r, r);
  for (let i = 0; i < stops.length; i++) {
    const [offset, color] = stops[i]!;
    grad.addColorStop(offset, color);
  }
  cx.fillStyle = grad;
  cx.fillRect(0, 0, size, size);

  cache.set(k, c);
  return c;
}
