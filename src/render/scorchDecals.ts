// Scorch decals: dark, slowly-fading floor patches left behind by fire
// pools. Pure VFX — no gameplay effect, lives in a module-level pool that
// matches the `shockwaves` / `screenFlash` pattern. Drawn flat on the
// floor under enemies / projectiles, immediately after the cached
// `getFirePools` pass, so a still-active fire-pool sits on top of the
// fading scorch from the previous one.
import { FLOOR_Y_SCALE } from './effects';

interface Scorch {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

const decals: Scorch[] = [];
const MAX_DECALS = 24;

export function spawnScorchDecal(
  x: number,
  y: number,
  radius: number,
  life = 1.5,
): void {
  // FIFO cap: a busy fire-explosion wave should drop the oldest scorches
  // rather than stack up an unbounded list of dim splotches.
  if (decals.length >= MAX_DECALS) decals.shift();
  decals.push({ x, y, radius, life, maxLife: life });
}

export function updateScorchDecals(dt: number): void {
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]!;
    d.life -= dt;
    if (d.life <= 0) {
      decals[i] = decals[decals.length - 1]!;
      decals.pop();
    }
  }
}

export function drawScorchDecals(ctx: CanvasRenderingContext2D): void {
  if (decals.length === 0) return;
  ctx.save();
  // `multiply` keeps the floor textures readable while still darkening
  // the scorch area — pure dark-with-alpha tends to look like a flat
  // sticker on top of the diagonal floor planks.
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < decals.length; i++) {
    const d = decals[i]!;
    const t = Math.max(0, Math.min(1, d.life / d.maxLife));
    const alpha = t;
    const grad = ctx.createRadialGradient(
      d.x, d.y, 0,
      d.x, d.y, d.radius,
    );
    // Centre is fully scorched (deep brown-black), edge fades to no
    // multiplication (rgba 1,1,1) so the falloff feels organic rather
    // than a hard ring.
    grad.addColorStop(0, `rgba(40, 24, 16, ${0.55 * alpha})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.radius, d.radius * FLOOR_Y_SCALE, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function resetScorchDecals(): void {
  decals.length = 0;
}
