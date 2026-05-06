// Per-creature animation rows backed by the painted spritesheets in
// `public/sprites/`. Each row is a horizontal 4-frame walk/idle cycle; the
// renderer cycles `frameIndex = floor(worldTime * fps)` and falls back to
// the baked pixel-art sprites in `./sprites.ts` until the PNG finishes
// loading.
//
// Source rects + body-mass-centre anchors below were derived from the
// spritesheets' actual content via per-frame connected-component analysis
// (grouped by which 1/4-cell each component's centre-of-mass lands in,
// then unioned per-cell). This is more robust than a uniform 300-pixel
// grid because painted frames frequently overflow cell boundaries —
// e.g. a running rat's tail trails into the previous cell, or a slime's
// drips spill past the next.

import { loadSheet, type AnimFrame, type AnimRow, type AnimSheet } from './animatedSprite';

// Vite copies `public/` to the build root; with `base: './'` (vite.config.ts)
// these relative URLs work both for the dev server and inside the YG zip.
const sheetCreatures: AnimSheet = loadSheet('sprites/creatures.png');
const sheetMossy: AnimSheet = loadSheet('sprites/bosses-mossy.png');
const sheetMech: AnimSheet = loadSheet('sprites/bosses-mech.png');
const sheetMannequin: AnimSheet = loadSheet('sprites/mannequin.png');

function row(
  sheet: AnimSheet,
  sy: number,
  sh: number,
  frames: AnimFrame[],
  scale: number,
): AnimRow {
  return { sheet, sy, sh, frames, scale };
}

/** Walk-cycle animation rows keyed by `EnemyKind.id`. Generated from the
 *  painted spritesheets; see top-of-file comment for the derivation. */
export const ENEMY_ANIMS: Record<string, AnimRow> = {
  // creatures.png
  slime: row(sheetCreatures, 97, 115, [
    { sx: 82, sw: 166, ax: 83 },
    { sx: 313, sw: 260, ax: 157 },
    { sx: 657, sw: 245, ax: 88 },
    { sx: 895, sw: 226, ax: 127 },
  ], 0.275),
  rat: row(sheetCreatures, 283, 165, [
    { sx: 38, sw: 234, ax: 127 },
    { sx: 299, sw: 272, ax: 158 },
    { sx: 603, sw: 230, ax: 123 },
    { sx: 863, sw: 266, ax: 149 },
  ], 0.20),
  golem: row(sheetCreatures, 479, 236, [
    { sx: 35, sw: 237, ax: 113 },
    { sx: 316, sw: 259, ax: 123 },
    { sx: 618, sw: 203, ax: 102 },
    { sx: 879, sw: 254, ax: 118 },
  ], 0.21),

  // bosses-mossy.png
  miniboss_slime: row(sheetMossy, 33, 223, [
    { sx: 20, sw: 245, ax: 122 },
    { sx: 308, sw: 299, ax: 125 },
    { sx: 584, sw: 292, ax: 161 },
    { sx: 923, sw: 244, ax: 110 },
  ], 0.275),
  flying_flask: row(sheetMossy, 301, 206, [
    { sx: 40, sw: 221, ax: 110 },
    { sx: 298, sw: 289, ax: 145 },
    { sx: 623, sw: 249, ax: 125 },
    { sx: 908, sw: 280, ax: 140 },
  ], 0.16),
  shaman: row(sheetMossy, 538, 208, [
    { sx: 43, sw: 220, ax: 102 },
    { sx: 324, sw: 219, ax: 95 },
    { sx: 622, sw: 217, ax: 94 },
    { sx: 911, sw: 217, ax: 95 },
  ], 0.225),

  // bosses-mech.png
  boss_rat_king: row(sheetMech, 28, 206, [
    { sx: 9, sw: 299, ax: 156 },
    { sx: 314, sw: 266, ax: 138 },
    { sx: 583, sw: 294, ax: 159 },
    { sx: 881, sw: 301, ax: 162 },
  ], 0.30),
  sapper: row(sheetMech, 277, 168, [
    { sx: 46, sw: 219, ax: 122 },
    { sx: 336, sw: 203, ax: 114 },
    { sx: 614, sw: 204, ax: 115 },
    { sx: 905, sw: 199, ax: 107 },
  ], 0.21),
  boss_homunculus: row(sheetMech, 476, 259, [
    { sx: 10, sw: 291, ax: 143 },
    { sx: 321, sw: 264, ax: 125 },
    { sx: 603, sw: 275, ax: 130 },
    { sx: 902, sw: 269, ax: 122 },
  ], 0.31),
};

/** Mannequin idle animation — bottom row of the painted sheet. 4 frames
 *  of subtle breathing/sway; cycle continuously when the mannequin
 *  isn't mid-throw. Scale shrunk 1.5× from the previous 0.45 so the
 *  mannequin reads as roughly one tile high — same visual proportion
 *  the rest of the (newly halved) creature roster sits at. */
export const MANNEQUIN_IDLE_ANIM: AnimRow = row(sheetMannequin, 515, 336, [
  { sx: 48, sw: 200, ax: 97 },
  { sx: 318, sw: 222, ax: 108 },
  { sx: 603, sw: 228, ax: 111 },
  { sx: 914, sw: 200, ax: 97 },
], 0.30);

/** Mannequin throw animation — top row of the painted sheet. Played
 *  once per fire (see `throwAnim` countdown in mannequin.ts):
 *  frame 0 = grip / wind-up start, frame 1 = raised flask,
 *  frame 2 = extended throw, frame 3 = follow-through. */
export const MANNEQUIN_THROW_ANIM: AnimRow = row(sheetMannequin, 97, 330, [
  { sx: 43, sw: 211, ax: 103 },
  { sx: 308, sw: 242, ax: 123 },
  { sx: 600, sw: 300, ax: 126 },
  { sx: 900, sw: 283, ax: 111 },
], 0.30);

/** Frame layout of the *baked* mannequin pixel-art fallback. Painted
 *  frames live on dedicated rows now (see *_IDLE_ANIM / *_THROW_ANIM). */
export const MANNEQUIN_FRAMES = {
  idle: 0,
  windup: 1,
  release: 2,
  idleAlt: 3,
} as const;

/** Compute animation FPS from an enemy's base move speed. Slow stompers
 *  (golem 34, miniboss 26) sit at the floor of 3 fps; sprinters (rat 105)
 *  reach ~10 fps. Multiplier makes `fps ≈ speed / 10` over the active range. */
export function enemyAnimFps(speedPxPerSec: number): number {
  return Math.max(3, Math.min(14, speedPxPerSec / 10));
}
