import type { WaveDef } from '../game/types';

const wave = (
  index: number,
  duration: number,
  pause: number,
  spawns: WaveDef['spawns'],
  isBoss = false,
): WaveDef => ({ index, durationSec: duration, pauseAfterSec: pause, spawns, isBoss });

// Vertical slice: 5 waves.
// Entrances are indexed 0..3 (top, right, bottom, left).
export const WAVES: WaveDef[] = [
  wave(1, 22, 8, [
    { kind: 'slime', at: 1.0, entrance: 0 },
    { kind: 'slime', at: 4.0, entrance: 0 },
    { kind: 'slime', at: 7.5, entrance: 2 },
    { kind: 'slime', at: 11, entrance: 0 },
    { kind: 'slime', at: 14, entrance: 2 },
    { kind: 'slime', at: 17, entrance: 2 },
  ]),
  wave(2, 26, 8, [
    { kind: 'slime', at: 1, entrance: 1 },
    { kind: 'slime', at: 3, entrance: 3 },
    { kind: 'rat',   at: 6, entrance: 1 },
    { kind: 'slime', at: 9, entrance: 3 },
    { kind: 'rat',   at: 12, entrance: 3 },
    { kind: 'slime', at: 15, entrance: 1 },
    { kind: 'rat',   at: 18, entrance: 1 },
    { kind: 'slime', at: 21, entrance: 3 },
  ]),
  wave(3, 28, 6, [
    { kind: 'rat',   at: 0.5, entrance: 0 },
    { kind: 'rat',   at: 2.5, entrance: 0 },
    { kind: 'slime', at: 4, entrance: 2 },
    { kind: 'rat',   at: 6, entrance: 2 },
    { kind: 'slime', at: 8.5, entrance: 0 },
    { kind: 'rat',   at: 11, entrance: 1 },
    { kind: 'rat',   at: 13, entrance: 3 },
    { kind: 'slime', at: 15, entrance: 1 },
    { kind: 'slime', at: 18, entrance: 3 },
    { kind: 'rat',   at: 21, entrance: 0 },
    { kind: 'slime', at: 24, entrance: 2 },
  ]),
  wave(4, 30, 6, [
    { kind: 'slime', at: 0.5, entrance: 0 },
    { kind: 'slime', at: 2, entrance: 1 },
    { kind: 'rat',   at: 4, entrance: 2 },
    { kind: 'rat',   at: 5, entrance: 3 },
    { kind: 'golem', at: 8, entrance: 0 },
    { kind: 'slime', at: 10, entrance: 2 },
    { kind: 'slime', at: 12, entrance: 1 },
    { kind: 'rat',   at: 14, entrance: 3 },
    { kind: 'rat',   at: 16, entrance: 1 },
    { kind: 'golem', at: 19, entrance: 2 },
    { kind: 'slime', at: 22, entrance: 0 },
    { kind: 'slime', at: 25, entrance: 2 },
  ]),
  wave(5, 50, 12, [
    { kind: 'slime',           at: 1, entrance: 0 },
    { kind: 'slime',           at: 3, entrance: 2 },
    { kind: 'rat',             at: 5, entrance: 1 },
    { kind: 'miniboss_slime',  at: 7, entrance: 0 },
    { kind: 'slime',           at: 12, entrance: 1 },
    { kind: 'slime',           at: 15, entrance: 3 },
    { kind: 'rat',             at: 18, entrance: 2 },
    { kind: 'slime',           at: 22, entrance: 1 },
    { kind: 'rat',             at: 26, entrance: 3 },
    { kind: 'slime',           at: 30, entrance: 0 },
    { kind: 'slime',           at: 34, entrance: 2 },
    { kind: 'golem',           at: 38, entrance: 1 },
  ], true),
];
