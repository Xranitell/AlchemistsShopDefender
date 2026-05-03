// Cache pre-baked radial-gradient halos so the per-frame render loop never
// calls `createRadialGradient` from a hot path. A `CanvasGradient` is fairly
// expensive to allocate on weak hardware (each call creates a new object and
// touches the GC), and we redraw the same handful of glow shapes every
// frame for the mannequin, towers, fire pools, shield bubble, etc.
//
// All glows here are sized once on demand and drawn via `drawImage`; alpha
// pulses are handled with `ctx.globalAlpha` at the call-site so we never
// have to rebake just because the brightness changed.

interface GlowSpec {
  radius: number;
  inner: string;
  outer: string;
  /** Optional second stop for 3-stop gradients. Drawn at `midStop`. */
  mid?: string;
  midStop?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

function key(s: GlowSpec): string {
  return `${s.radius}|${s.inner}|${s.outer}|${s.mid ?? ''}|${s.midStop ?? ''}`;
}

export function getRadialGlow(spec: GlowSpec): HTMLCanvasElement {
  const k = key(spec);
  const cached = cache.get(k);
  if (cached) return cached;
  const size = Math.max(2, Math.ceil(spec.radius * 2));
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, spec.radius);
  g.addColorStop(0, spec.inner);
  if (spec.mid && typeof spec.midStop === 'number') {
    g.addColorStop(spec.midStop, spec.mid);
  }
  g.addColorStop(1, spec.outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(k, c);
  return c;
}

/** Draw a cached radial halo centred on (x, y) at the requested radius.
 *  The halo is stretched/squashed via drawImage so a single cached canvas
 *  serves many size buckets — perfectly fine for soft glows. */
export function drawRadialGlow(
  ctx: CanvasRenderingContext2D,
  spec: GlowSpec,
  x: number,
  y: number,
  alpha: number,
  drawRadius: number = spec.radius,
): void {
  if (alpha <= 0) return;
  const halo = getRadialGlow(spec);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(
    halo,
    Math.round(x - drawRadius),
    Math.round(y - drawRadius),
    drawRadius * 2,
    drawRadius * 2,
  );
  ctx.restore();
}

/** Cache for full-canvas vignette overlay (radial fade to dark). Keyed by
 *  exact canvas dimensions; the renderer calls this once per resize. */
const vignetteCache = new Map<string, HTMLCanvasElement>();

export function getVignette(width: number, height: number, alphaOuter = 0.5): HTMLCanvasElement {
  const k = `${width}x${height}|${alphaOuter}`;
  const cached = vignetteCache.get(k);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.25,
    width / 2, height / 2, Math.max(width, height) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${alphaOuter})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  vignetteCache.set(k, c);
  // Light cap so we don't accumulate vignettes if the canvas is resized
  // many times during a session.
  if (vignetteCache.size > 8) {
    const firstKey = vignetteCache.keys().next().value;
    if (firstKey && firstKey !== k) vignetteCache.delete(firstKey);
  }
  return c;
}
