// Dynamic particle system for colorful, vivid VFX.
// Particles live in world space and are drawn under the isometric transform.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  fadeOut: boolean;
  shrink: boolean;
}

const particles: Particle[] = [];
const MAX_PARTICLES = 500;

export function spawnParticle(p: Omit<Particle, 'maxLife'>): void {
  if (particles.length >= MAX_PARTICLES) return;
  // Avoid `{ ...p }` spread — that allocates a fresh object on every spawn,
  // which is hot during reaction storms and overload bursts. Push an
  // explicit literal instead so the JIT can inline the shape.
  particles.push({
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    life: p.life,
    maxLife: p.life,
    size: p.size,
    color: p.color,
    gravity: p.gravity,
    fadeOut: p.fadeOut,
    shrink: p.shrink,
  });
}

export function spawnBurst(
  x: number,
  y: number,
  count: number,
  colors: string[],
  speed: number,
  life: number,
  size = 2,
  gravity = 0,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spd = speed * (0.5 + Math.random() * 0.5);
    spawnParticle({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life,
      size: size * (0.5 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)]!,
      gravity,
      fadeOut: true,
      shrink: true,
    });
  }
}

export function spawnTrail(
  x: number,
  y: number,
  color: string,
  size = 1.5,
): void {
  spawnParticle({
    x: x + (Math.random() - 0.5) * 3,
    y: y + (Math.random() - 0.5) * 3,
    vx: (Math.random() - 0.5) * 6,
    vy: -Math.random() * 10 - 5,
    life: 0.3 + Math.random() * 0.3,
    size,
    color,
    gravity: 0,
    fadeOut: true,
    shrink: true,
  });
}

export function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      // Swap-remove avoids the O(N) shift that splice() does for each
      // dead particle. Order doesn't matter for visuals.
      particles[i] = particles[particles.length - 1]!;
      particles.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.992;
    p.vy *= 0.992;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  if (particles.length === 0) return;
  // Single save/restore around the whole batch — the previous version
  // saved/restored per particle which was a measurable hotspot at high
  // particle counts. Re-enter the saved state at the end.
  ctx.save();
  let lastAlpha = -1;
  let lastColor = '';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!;
    const t = p.life / p.maxLife;
    const alpha = p.fadeOut ? Math.min(1, t * 2) : 1;
    const size = p.shrink ? p.size * (0.3 + t * 0.7) : p.size;
    if (p.color !== lastColor) {
      ctx.fillStyle = p.color;
      lastColor = p.color;
    }
    if (alpha !== lastAlpha) {
      ctx.globalAlpha = alpha;
      lastAlpha = alpha;
    }
    const halfSize = size * 0.5;
    ctx.fillRect(
      Math.round(p.x - halfSize),
      Math.round(p.y - halfSize),
      Math.ceil(size),
      Math.ceil(size),
    );
    if (size > 2) {
      const glowAlpha = alpha * 0.2;
      if (glowAlpha !== lastAlpha) {
        ctx.globalAlpha = glowAlpha;
        lastAlpha = glowAlpha;
      }
      ctx.fillRect(
        Math.round(p.x - size),
        Math.round(p.y - size),
        Math.ceil(size * 2),
        Math.ceil(size * 2),
      );
    }
  }
  ctx.restore();
}

// Impact burst colors by element
export const FIRE_COLORS = ['#ffd166', '#ff8c3a', '#d24f1c', '#ffee88'];
export const MERCURY_COLORS = ['#c9c9d8', '#8a8aa0', '#bdf6ff', '#e0e0f0'];
export const ACID_COLORS = ['#d2f55a', '#9ccc2e', '#a3e36a', '#e0ff88'];
export const AETHER_COLORS = ['#bdf6ff', '#7df9ff', '#3ab3c9', '#e0f8ff'];
export const FROST_COLORS = ['#bdf6ff', '#7dd3fc', '#a5e9ff', '#dff5ff'];
export const POISON_COLORS = ['#9be36b', '#5fa845', '#c4ec88', '#3f7727'];
export const GOLD_COLORS = ['#ffd166', '#e8c98c', '#c9941a'];
