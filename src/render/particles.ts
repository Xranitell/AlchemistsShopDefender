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
  particles.push({ ...p, maxLife: p.life });
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
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    const alpha = p.fadeOut ? Math.min(1, t * 2) : 1;
    const size = p.shrink ? p.size * (0.3 + t * 0.7) : p.size;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      Math.round(p.x - size / 2),
      Math.round(p.y - size / 2),
      Math.ceil(size),
      Math.ceil(size),
    );

    // Glow effect for larger particles
    if (size > 2) {
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillRect(
        Math.round(p.x - size),
        Math.round(p.y - size),
        Math.ceil(size * 2),
        Math.ceil(size * 2),
      );
    }
    ctx.restore();
  }
}

// Impact burst colors by element
export const FIRE_COLORS = ['#ffd166', '#ff8c3a', '#d24f1c', '#ffee88'];
export const MERCURY_COLORS = ['#c9c9d8', '#8a8aa0', '#bdf6ff', '#e0e0f0'];
export const ACID_COLORS = ['#d2f55a', '#9ccc2e', '#a3e36a', '#e0ff88'];
export const AETHER_COLORS = ['#bdf6ff', '#7df9ff', '#3ab3c9', '#e0f8ff'];
export const GOLD_COLORS = ['#ffd166', '#e8c98c', '#c9941a'];
