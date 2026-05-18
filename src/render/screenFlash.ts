// Brief radial-edge screen flash, used as visceral feedback when the
// mannequin takes damage. The intensity scales with the size of the hit
// (as a fraction of max HP) so a small chip damages tint the screen
// faintly red while a boss bite floods the edges. Stateless module —
// matches the `shake.ts` pattern.

let intensity = 0;
let time = 0;
let totalTime = 0;
let color: string = '255, 80, 80';

export function flashScreen(strength: number, duration: number, rgb = '255, 80, 80'): void {
  if (strength <= 0 || duration <= 0) return;
  // Stack by max impulse (matches shake's behaviour) — a heavy hit during
  // the fade of an earlier light hit shouldn't be cut off.
  const incoming = strength * duration;
  const current = intensity * time;
  if (incoming > current) {
    intensity = Math.min(1, strength);
    time = duration;
    totalTime = duration;
    color = rgb;
  }
}

export function tickScreenFlash(dt: number): void {
  if (time <= 0) return;
  time = Math.max(0, time - dt);
  if (time === 0) {
    intensity = 0;
    totalTime = 0;
  }
}

export function getScreenFlash(): { alpha: number; rgb: string } {
  if (time <= 0 || totalTime <= 0) return { alpha: 0, rgb: color };
  const t = time / totalTime;
  // Quadratic falloff for a "thump → settle" feel.
  return { alpha: intensity * t * t, rgb: color };
}

export function resetScreenFlash(): void {
  intensity = 0;
  time = 0;
  totalTime = 0;
}
