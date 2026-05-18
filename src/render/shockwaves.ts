// Expanding floor-plane shockwave rings used as a "death pop" effect when
// enemies die, when potions explode, when bosses appear, etc. Pure VFX —
// no gameplay impact, no save serialisation, lives in module-level state.
//
// Drawn under the isometric transform so the ellipse sits flat on the floor
// matching the existing `FLOOR_Y_SCALE` convention used by fire pools.
import { FLOOR_Y_SCALE } from './effects';

export interface Shockwave {
  x: number;
  y: number;
  /** Ring radius now (interpolated each frame from start → end). */
  startRadius: number;
  endRadius: number;
  /** Stroke colour, including alpha — alpha is multiplied by the lifetime
   *  envelope so callers can leave the colour fully opaque. */
  color: string;
  /** Initial line width — fades down with life. */
  width: number;
  life: number;
  maxLife: number;
}

const waves: Shockwave[] = [];
const MAX_WAVES = 24;

export function spawnShockwave(
  x: number,
  y: number,
  startRadius: number,
  endRadius: number,
  color: string,
  life: number,
  width = 4,
): void {
  // Cap the queue: at 60 fps with several boss-deaths back-to-back this
  // could otherwise grow unbounded if the renderer ever pauses.
  if (waves.length >= MAX_WAVES) waves.shift();
  waves.push({
    x,
    y,
    startRadius,
    endRadius,
    color,
    width,
    life,
    maxLife: life,
  });
}

export function updateShockwaves(dt: number): void {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]!;
    w.life -= dt;
    if (w.life <= 0) {
      waves[i] = waves[waves.length - 1]!;
      waves.pop();
    }
  }
}

export function drawShockwaves(ctx: CanvasRenderingContext2D): void {
  if (waves.length === 0) return;
  ctx.save();
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i]!;
    // 1 → 0 over life. Square envelope so the ring fades softly at the end
    // instead of popping out.
    const t = Math.max(0, Math.min(1, w.life / w.maxLife));
    const fade = t * t;
    const grow = 1 - t;
    const r = w.startRadius + (w.endRadius - w.startRadius) * grow;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = Math.max(0.5, w.width * fade);
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, r, r * FLOOR_Y_SCALE, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function resetShockwaves(): void {
  waves.length = 0;
}
