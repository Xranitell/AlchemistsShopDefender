// Camera shake VFX. Stateless module so trigger sites don't need to thread
// the shake state through the game-state object — the shake is purely
// visual, has no effect on gameplay, and shouldn't be serialised in
// save data. The render pass reads `getShakeOffset()` and translates
// the world layer by that many pixels each frame; the main loop ticks
// the timer with `tickShake(dt)`.
//
// Multiple trigger calls "stack" by max of `magnitude * duration` (the
// total impulse), so a small needler shake right before a mortar boom
// won't cut off the bigger event, and back-to-back boss hits don't
// create a buzz-saw sequence of resets.

let magnitude = 0;
let timeLeft = 0;
let totalTime = 0;

const TWO_PI = Math.PI * 2;

export function shakeCamera(strength: number, duration: number): void {
  if (strength <= 0 || duration <= 0) return;
  // Compare total impulse rather than just magnitude: a long mild shake
  // shouldn't be overridden by a tiny twitch right after.
  const incoming = strength * duration;
  const current = magnitude * timeLeft;
  if (incoming > current) {
    magnitude = strength;
    timeLeft = duration;
    totalTime = duration;
  }
}

export function tickShake(dt: number): void {
  if (timeLeft <= 0) return;
  timeLeft = Math.max(0, timeLeft - dt);
  if (timeLeft === 0) {
    magnitude = 0;
    totalTime = 0;
  }
}

// Returns a frame-local offset to translate the world by. Uses a smoothly
// rotating angle plus an ease-out envelope so the shake feels like an
// impact decaying out — not a noisy random jitter.
export function getShakeOffset(): { x: number; y: number } {
  if (timeLeft <= 0 || totalTime <= 0) return { x: 0, y: 0 };
  const t = timeLeft / totalTime; // 1 → 0
  const env = t * t;              // ease-out quadratic
  const m = magnitude * env;
  if (m < 0.05) return { x: 0, y: 0 };
  // Two uncorrelated sine sources at irrational ratios so X and Y don't
  // line up into a diagonal streak. The phase advances with absolute
  // wall-clock time (in seconds) so a small `dt` doesn't make the shake
  // appear to freeze.
  const wall = performance.now() / 1000;
  const ax = wall * 47.3 * TWO_PI;
  const ay = wall * 53.7 * TWO_PI + 1.7;
  return {
    x: Math.sin(ax) * m,
    y: Math.cos(ay) * m,
  };
}

export function resetShake(): void {
  magnitude = 0;
  timeLeft = 0;
  totalTime = 0;
}
