// Per-creature animation rows backed by the painted spritesheets in
// `public/sprites/`. Each row is a horizontal 4-frame walk/idle cycle; the
// renderer cycles `frameIndex = floor(worldTime * fps)` and falls back to
// the baked pixel-art sprites in `./sprites.ts` until the PNG finishes
// loading.
//
// Cell rectangles below were derived from the spritesheets' actual content
// bounds (see scripts/dev notes). Anchors are bottom-centre so a creature's
// "feet" land on its entity position — same convention as the baked sprites.

import { loadSheet, type AnimRow, type AnimSheet } from './animatedSprite';

// Vite copies `public/` to the build root; with `base: './'` (vite.config.ts)
// these relative URLs work both for the dev server and inside the YG zip.
const sheetCreatures: AnimSheet = loadSheet('sprites/creatures.png');
const sheetMossy: AnimSheet = loadSheet('sprites/bosses-mossy.png');
const sheetMech: AnimSheet = loadSheet('sprites/bosses-mech.png');
const sheetMannequin: AnimSheet = loadSheet('sprites/mannequin.png');

const CELL_W = 300;
const FRAMES = 4;

function row(sheet: AnimSheet, rowY: number, cellH: number, scale: number): AnimRow {
  return {
    sheet,
    frames: FRAMES,
    cellW: CELL_W,
    cellH,
    rowY,
    anchor: { x: CELL_W / 2, y: cellH },
    scale,
  };
}

/** Walk-cycle animation rows keyed by `EnemyKind.id`. */
export const ENEMY_ANIMS: Record<string, AnimRow> = {
  // creatures.png — small mob row stack.
  slime: row(sheetCreatures, 99, 110, 0.55),
  rat: row(sheetCreatures, 285, 160, 0.40),
  golem: row(sheetCreatures, 481, 232, 0.42),

  // bosses-mossy.png — big slime / flying flask / shaman row stack.
  miniboss_slime: row(sheetMossy, 34, 220, 0.55),
  flying_flask: row(sheetMossy, 303, 204, 0.32),
  shaman: row(sheetMossy, 540, 204, 0.45),

  // bosses-mech.png — rat king / sapper / homunculus row stack.
  boss_rat_king: row(sheetMech, 30, 202, 0.60),
  sapper: row(sheetMech, 277, 166, 0.42),
  boss_homunculus: row(sheetMech, 478, 255, 0.62),
};

/** Mannequin has a single row with 4 throw-cycle poses (see indices below). */
export const MANNEQUIN_ANIM: AnimRow = row(sheetMannequin, 49, 294, 0.50);

/** Frame layout of the mannequin spritesheet: idle / windup / release / idle-alt. */
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
