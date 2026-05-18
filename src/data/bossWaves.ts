import { WAVES } from './waves';
import type { WaveDef } from '../game/types';

// Boss-day daily event: only boss waves (indices 4, 9, 14 = waves 5, 10, 15).
// The short list loops in daily runs; pauses between waves stay snappy.
export const BOSS_WAVES: WaveDef[] = [
  { ...WAVES[4]!, index: 0, pauseAfterSec: 6 },
  { ...WAVES[9]!, index: 1, pauseAfterSec: 6 },
  { ...WAVES[14]!, index: 2, pauseAfterSec: 0 },
];
