import { COLORS } from './palette';
import { BIOMES, type BiomeId, type BiomePalette } from '../data/biomes';

// Room backdrop — walls and door frames have been removed so enemies can walk
// in from off-screen. The backdrop is now purely an iso-rhombic floor that
// covers the full canvas. Everything else (mannequin, dais, rune points,
// enemies, towers, projectiles) is drawn on top per-frame.

// Retained as 0 so call-sites that used to offset decor/spawns by wall
// thickness keep compiling. There are no walls any more.
export const WALL_TOP = 0;
export const WALL_SIDE = 0;
export const WALL_BOTTOM = 0;

let cached: HTMLCanvasElement | null = null;
let cachedSize: { w: number; h: number } | null = null;
let cachedBiome: BiomeId | null = null;

/** Current biome set by the game. Call `setBiome` before the first
 *  `getRoomBackdrop` to switch palettes; the cache is invalidated
 *  automatically when the biome changes. */
let activeBiome: BiomeId = 'workshop';

export function setBiome(id: BiomeId): void {
  if (id !== activeBiome) {
    activeBiome = id;
    cached = null;        // force re-render on next call
    cachedBiome = null;
  }
}

export function getActiveBiomePalette(): BiomePalette {
  return BIOMES[activeBiome].palette;
}

export function getRoomBackdrop(width: number, height: number): HTMLCanvasElement {
  if (cached && cachedSize && cachedSize.w === width && cachedSize.h === height && cachedBiome === activeBiome) {
    return cached;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const pal = BIOMES[activeBiome].palette;
  if (activeBiome === 'workshop') {
    // Cosy alchemist's lab — warm wooden plank floor matching the
    // reference art, replaces the legacy iso-rhombus stone tiles.
    drawPlankFloor(ctx, width, height, pal);
  } else {
    drawFloor(ctx, width, height, pal);
  }
  // Walls removed per design request — open arena feel.
  if (activeBiome === 'workshop') {
    drawWorkshopDecor(ctx, width, height);
  } else {
    drawScatteredDecor(ctx, width, height);
  }
  drawBiomeDecor(ctx, width, height, activeBiome);

  cached = c;
  cachedSize = { w: width, h: height };
  cachedBiome = activeBiome;
  return c;
}

/* Walls removed per design request — kept for potential re-use. */
export function drawWorkshopWalls(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomePalette): void {
  const wall = 70;
  const side = 46;
  ctx.fillStyle = pal.wallDark;
  ctx.fillRect(0, 0, w, wall);
  ctx.fillRect(0, 0, side, h);
  ctx.fillRect(w - side, 0, side, h);

  for (let x = 0; x < w; x += 40) {
    const shade = (x / 40) % 2 === 0 ? COLORS.stoneDark : COLORS.mortar;
    ctx.fillStyle = shade;
    ctx.fillRect(x, 0, 38, 28);
    ctx.fillStyle = COLORS.stoneMid;
    ctx.fillRect(x + 2, 29, 36, 28);
    ctx.fillStyle = COLORS.tileCrack;
    ctx.fillRect(x, 27, 40, 2);
  }

  for (let y = 22; y < h; y += 38) {
    ctx.fillStyle = (y / 38) % 2 === 0 ? COLORS.stoneDark : COLORS.mortar;
    ctx.fillRect(0, y, side - 8, 34);
    ctx.fillRect(w - side + 8, y, side - 8, 34);
    ctx.fillStyle = COLORS.stoneMid;
    ctx.fillRect(4, y + 2, side - 16, 6);
    ctx.fillRect(w - side + 12, y + 2, side - 16, 6);
  }

  drawBackShelf(ctx, 76, 22);
  drawBackShelf(ctx, w - 192, 22);
  drawCandleCluster(ctx, 63, 158);
  drawCandleCluster(ctx, w - 72, 160);
  drawBarrels(ctx, 182, 40);
  drawBarrels(ctx, w - 245, 38);

  const vignette = ctx.createLinearGradient(0, 0, 0, wall + 90);
  vignette.addColorStop(0, 'rgba(0,0,0,0.5)');
  vignette.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, wall + 90);
}

/**
 * Cosy alchemist's lab plank floor.
 *
 * Renders wooden boards across the arena, sheared along the iso 2:1 plane
 * so they sit on the same diagonal as the old rhombus tile floor instead
 * of reading as flat top-down rectangles. Each board is split into a
 * sequence of plank segments by short vertical seams, and each plank
 * carries dense per-pixel wear (grain stripes, knots, fibres, scuffs,
 * nails) at ~64x64 sample density so the texture reads as crafted
 * pixel-art rather than flat colour bands.
 */
// Floor texture is sheared so the plank rows run diagonally toward the
// bottom-right corner, matching the iso-direction the user pointed to.
// `FLOOR_TILT = 1.0` gives a 45° slope (tan 45° = 1) — every horizontal
// world line drops by `x` pixels at column `x`.
const FLOOR_TILT = 1.0;

function drawPlankFloor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: BiomePalette,
): void {
  // Slimmer boards + shorter planks = denser detail per square inch and
  // a more crafted pixel-art read at the requested ~64x64 granularity.
  const BOARD_H = 38;
  const PLANK_MIN = 64;
  const PLANK_MAX = 132;

  // Base fill so any uncovered pixel still looks like dark wood.
  ctx.fillStyle = pal.tileCrack;
  ctx.fillRect(0, 0, w, h);

  // Shear all the plank geometry along the iso plane. We extend the
  // drawing range by `padY` so the sheared parallelograms still fully
  // cover the canvas after the transform.
  const padY = Math.ceil(Math.abs(w * FLOOR_TILT)) + BOARD_H * 2;
  ctx.save();
  // Flip the plank layer along the Y axis (vertical mirror). The user
  // asked for the texture to be flipped along Y — we keep the underlying
  // shear so the diagonal direction is preserved, just mirrored top↔
  // bottom so the highlight / shadow / grain side of each plank reads
  // the way the user expects.
  ctx.translate(0, h);
  ctx.scale(1, -1);
  ctx.transform(1, FLOOR_TILT, 0, 1, 0, 0);

  let row = 0;
  for (let y = -padY; y < h + padY; y += BOARD_H) {
    // Alternate the starting offset of plank seams between rows so the
    // joints don't line up in a brick-pattern column.
    const seamOffset = (row & 1) === 0 ? 0 : Math.floor(PLANK_MAX * 0.45);

    let x = -padY - seamOffset;
    let plankIdx = 0;
    while (x < w + padY) {
      const seed = hash2((plankIdx + 1) * 191, row * 311 + 17);
      const widthSpan = PLANK_MAX - PLANK_MIN;
      const pw = PLANK_MIN + (seed % widthSpan);

      // Pick one of three wood shades for the body. tileC is the
      // lightest (bright, weathered), tileA mid, tileB darker.
      const shadeBits = (seed >> 4) & 0b11;
      const body = shadeBits === 0 ? pal.tileC : shadeBits === 1 ? pal.tileA : pal.tileB;

      ctx.fillStyle = body;
      ctx.fillRect(x, y, pw, BOARD_H);
      // Top highlight + bottom shadow sell board-on-board layering.
      ctx.fillStyle = 'rgba(255, 220, 170, 0.12)';
      ctx.fillRect(x, y, pw, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.fillRect(x, y + BOARD_H - 1, pw, 1);

      // Vertical seam — dark gap between this plank and the next.
      ctx.fillStyle = pal.tileCrack;
      ctx.fillRect(x + pw - 1, y, 2, BOARD_H);

      // Plank wear — pulled out into a helper so the visual logic isn't
      // tangled in the layout loop.
      addPlankDetails(ctx, x, y, pw, BOARD_H, seed, pal);

      x += pw;
      plankIdx++;
    }

    // Horizontal gap between rows of boards — adds the "stacked
    // floorboard" look from the reference art.
    ctx.fillStyle = pal.tileCrack;
    ctx.fillRect(-padY, y + BOARD_H - 2, w + padY * 2, 2);
    row++;
  }

  ctx.restore();

  // Soft edge vignette pushing focus toward the centre. Drawn AFTER the
  // shear so it stays a clean radial without smearing.
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.22,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${pal.vignetteAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Warm centre spotlight (candle / hearth glow).
  const spotlight = ctx.createRadialGradient(w / 2, h / 2 - 30, 0, w / 2, h / 2 - 30, 260);
  spotlight.addColorStop(0, pal.spotlight);
  spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, w, h);
}

/** Per-plank wear at ~64x64 pixel-art density. Layered:
 *  1. Long grain stripes (3-6 per plank).
 *  2. Short fibre flecks (lots of 1-2px streaks → 'wood texture').
 *  3. Pin-point pixel noise so flat colour breaks up under close zoom.
 *  4. Knots (~1 in 2 planks now) with a bright rim.
 *  5. Two nail pixels per plank end + brass head highlight.
 *  6. Optional polish highlight + dark stain accents.
 *  All deterministic — driven entirely by the layout seed. */
function addPlankDetails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pw: number,
  ph: number,
  seed: number,
  pal: BiomePalette,
): void {
  // 1) Grain — 3-6 thin horizontal stripes per plank.
  const grainCount = 3 + ((seed >> 2) & 0b11);
  for (let g = 0; g < grainCount; g++) {
    const gy = y + 3 + Math.floor(((seed >> (g * 3 + 5)) & 0xff) / 255 * (ph - 6));
    const gx = x + 3 + Math.floor(((seed >> (g * 3 + 11)) & 0xff) / 255 * (pw - 8));
    const len = 14 + ((seed >> (g * 5 + 9)) & 0x3f);
    ctx.fillStyle = (g & 1) === 0
      ? 'rgba(40, 22, 12, 0.22)'
      : 'rgba(255, 215, 160, 0.06)';
    ctx.fillRect(gx, gy, Math.min(len, x + pw - 3 - gx), 1);
  }

  // 2) Short fibre flecks — 6-10 little streaks across the plank, the
  // signature of the iso pixel-art floors in the reference art.
  const fibreCount = 6 + ((seed >> 6) & 0b111);
  for (let f = 0; f < fibreCount; f++) {
    const fx = x + 2 + Math.floor(((seed * (f + 13)) >>> 0) & 0xff) / 255 * (pw - 4);
    const fy = y + 2 + Math.floor(((seed * (f + 31)) >>> 0) >> 8 & 0xff) / 255 * (ph - 4);
    const fl = 2 + ((seed >> (f + 4)) & 0b11);
    ctx.fillStyle = ((seed >> f) & 1)
      ? 'rgba(20, 10, 5, 0.40)'
      : 'rgba(255, 220, 170, 0.10)';
    ctx.fillRect(Math.floor(fx), Math.floor(fy), fl, 1);
  }

  // 3) Pixel noise — sprinkle of single-pixel speckles so the wood
  // doesn't read flat under the spotlight.
  for (let n = 0; n < 14; n++) {
    const r = ((seed * (n + 7)) ^ (n * 91)) >>> 0;
    const nx = x + 1 + (r % (pw - 2));
    const ny = y + 1 + ((r >>> 9) % (ph - 2));
    const dark = (r & 0b11) === 0;
    ctx.fillStyle = dark ? 'rgba(15, 8, 4, 0.30)' : 'rgba(255, 220, 170, 0.07)';
    ctx.fillRect(nx, ny, 1, 1);
  }

  // 4) Knot — small dark ellipse with a bright rim, ~1 in 2 planks now.
  if (((seed >> 8) & 0b1) === 0b1 && pw > 70) {
    const kx = x + 14 + ((seed >> 12) & 0x3f);
    const ky = y + 4 + ((seed >> 18) & 0xf);
    ctx.fillStyle = 'rgba(20, 10, 5, 0.78)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(95, 55, 30, 0.75)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Faint ring around the knot.
    ctx.strokeStyle = 'rgba(30, 16, 8, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(kx, ky, 6, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 5) Polish highlight — a streak of brighter tone roughly along the
  // grain direction, sells weathered wax.
  if (((seed >> 14) & 0b111) === 0b011) {
    ctx.fillStyle = 'rgba(255, 230, 180, 0.08)';
    ctx.fillRect(x + 4, y + 5, Math.max(0, pw - 12), 2);
  }

  // 6) Dark stain — a short oblong patch (rare).
  if (((seed >> 17) & 0b1111) === 0b0101) {
    ctx.fillStyle = 'rgba(15, 8, 4, 0.40)';
    ctx.beginPath();
    ctx.ellipse(x + Math.floor(pw / 2), y + Math.floor(ph / 2), 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7) Two nail pixels per plank — one at each end — with a brass head
  // highlight that catches the warm spotlight.
  ctx.fillStyle = pal.tileCrack;
  ctx.fillRect(x + 4, y + 3, 2, 2);
  ctx.fillRect(x + pw - 6, y + ph - 5, 2, 2);
  ctx.fillStyle = COLORS.brassHi;
  ctx.fillRect(x + 4, y + 3, 1, 1);
  ctx.fillRect(x + pw - 6, y + ph - 5, 1, 1);
}

// Iso rhombus tile floor covering the entire canvas.
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomePalette): void {
  const TILE_W = 64;
  const TILE_H = 32;

  // Base fill.
  ctx.fillStyle = pal.tileA;
  ctx.fillRect(0, 0, w, h);

  let row = 0;
  for (let cy = -TILE_H; cy <= h + TILE_H; cy += TILE_H / 2) {
    const rowOffset = (row % 2 === 0) ? 0 : TILE_W / 2;
    let col = 0;
    for (let cx = -TILE_W + rowOffset; cx <= w + TILE_W; cx += TILE_W) {
      const seed = hash2(col + (row << 8), row);
      const checker = ((row >> 1) + col) & 1;
      const base = checker === 0 ? pal.tileA : pal.tileB;
      fillRhombus(ctx, cx, cy, TILE_W, TILE_H, base);
      strokeRhombus(ctx, cx, cy, TILE_W, TILE_H, pal.tileCrack);

      // Extra detail: each tile may pick up a number of small wear marks
      // based on its deterministic seed. This keeps the grid lively without
      // looking patterned.
      addTileDetails(ctx, cx, cy, TILE_W, TILE_H, seed);

      col++;
    }
    row++;
  }

  // Soft edge vignette pushing focus toward the centre.
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${pal.vignetteAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle centre spotlight.
  const spotlight = ctx.createRadialGradient(w / 2, h / 2 - 30, 0, w / 2, h / 2 - 30, 220);
  spotlight.addColorStop(0, pal.spotlight);
  spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, w, h);
}

// Per-tile wear: small cracks, pock marks, dust smudges. Deterministic.
function addTileDetails(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tw: number,
  th: number,
  seed: number,
): void {
  const bits = seed;

  // Stud / pebble (center).
  if ((bits & 0b111) === 0b101) {
    ctx.fillStyle = COLORS.tileC;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  // Horizontal crack across the tile.
  if ((bits & 0b11) === 0b11) {
    ctx.fillStyle = COLORS.tileCrack;
    ctx.fillRect(cx - 6, cy, 12, 1);
  }

  // Diagonal hairline cracks that follow the rhombus edges.
  if (((bits >> 3) & 0b1111) === 0b1010) {
    ctx.strokeStyle = COLORS.tileCrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.25, cy - th * 0.12);
    ctx.lineTo(cx + tw * 0.15, cy + th * 0.18);
    ctx.stroke();
  }
  if (((bits >> 7) & 0b1111) === 0b0110) {
    ctx.strokeStyle = COLORS.tileCrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + tw * 0.25, cy - th * 0.18);
    ctx.lineTo(cx - tw * 0.10, cy + th * 0.10);
    ctx.stroke();
  }

  // Scuff smudge — a lighter blob suggesting worn stone.
  if (((bits >> 11) & 0b111) === 0b001) {
    ctx.fillStyle = 'rgba(160, 140, 150, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 3, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark stain.
  if (((bits >> 14) & 0b1111) === 0b0011) {
    ctx.fillStyle = 'rgba(20, 10, 15, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy + 4, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny highlight speck.
  if (((bits >> 18) & 0b11111) === 0b10101) {
    ctx.fillStyle = 'rgba(255, 240, 220, 0.10)';
    ctx.fillRect(cx + 6, cy - 2, 1, 1);
  }
}

/**
 * Workshop-specific scattered decor: an alchemy lab inventory dropped on
 * the floor. Replaces the generic broken-potion / dust pile clutter with
 * intact glass flasks, stacked + open books, rolled scrolls, candle
 * stubs, mortar & pestle, ink + quill, small crates, and herb bundles.
 *
 * Placement is deterministic (hash-driven) and avoids the central iso
 * ring around the dais so the gameplay area stays clean.
 */
function drawWorkshopDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const excludeRX = 280;
  const excludeRY = 150;

  // We drive prop selection from `i` (uniform) but pull every other
  // random — position, orientation, internal variant — from `r`. The
  // earlier `r % 16` selector clustered visibly because hash2's low
  // bits land on similar values for adjacent indices.
  const PROPS = 60;
  for (let i = 0; i < PROPS; i++) {
    const r = hash2(i * 53 + 11, 23 + i * 3);
    // Use bit-21+ for x and bit-5+ for y to avoid the low-bit clustering
    // artefacts the original `& 0xffff` mask exposed.
    const x = ((r >>> 5) & 0xffff) / 0xffff * (w - 80) + 40;
    const y = ((r >>> 13) & 0xffff) / 0xffff * (h - 80) + 40;
    const dx = (x - cx) / excludeRX;
    const dy = (y - cy) / excludeRY;
    if (dx * dx + dy * dy < 1) continue;

    const pick = i % 16;
    // Each prop gets its own deterministic rotation so the floor stops
    // reading like a tidy product shelf. `kind` controls the *style* of
    // rotation: tall props (bottles, candles, mortar, ink, herbs) get
    // a gentle ±18° tilt, flat props (scrolls, open books) can lie at
    // any angle, stacks stay near upright.
    const kind = pick <= 3 || pick === 9 || pick === 10 || pick === 11 || pick === 12 || pick === 14
      ? 'tall'
      : pick === 6 || pick === 13
        ? 'stack'
        : 'flat';
    const rotSeed = ((r >>> 19) & 0xff) / 255; // 0..1
    let angle: number;
    if (kind === 'tall') {
      angle = (rotSeed - 0.5) * (Math.PI / 5); // ±18°
    } else if (kind === 'stack') {
      angle = (rotSeed - 0.5) * (Math.PI / 9); // ±10°
    } else {
      angle = (rotSeed - 0.5) * (Math.PI * 2); // any
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    switch (pick) {
      case 0: drawPotionBottle(ctx, 0, 0, 'green', r); break;
      case 1: drawPotionBottle(ctx, 0, 0, 'blue',  r); break;
      case 2: drawPotionBottle(ctx, 0, 0, 'red',   r); break;
      case 3: drawPotionBottle(ctx, 0, 0, 'amber', r); break;
      case 4: drawClosedBook(ctx, 0, 0, r); break;
      case 5: drawClosedBook(ctx, 0, 0, r ^ 0x2a); break;
      case 6: drawBookStack(ctx, 0, 0, r); break;
      case 7: drawOpenBookCosy(ctx, 0, 0, r); break;
      case 8: drawScroll(ctx, 0, 0, r); break;
      case 9: drawCandleStub(ctx, 0, 0); break;
      case 10: drawMortarPestle(ctx, 0, 0); break;
      case 11: drawInkAndQuill(ctx, 0, 0); break;
      case 12: drawHerbBundle(ctx, 0, 0, r); break;
      case 13: drawSmallCrate(ctx, 0, 0); break;
      case 14: drawPotionBottle(ctx, 0, 0, 'green', r ^ 0x55); break;
      default: drawScroll(ctx, 0, 0, r ^ 0x77); break;
    }
    ctx.restore();
  }
}

// Decorative junk scattered across the floor: broken potions, books, papers,
// and shards. Deterministic placement so it doesn't re-shuffle on refresh.
function drawScatteredDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  // Avoid the mannequin's dais + tower rune ring. Exclusion is an ellipse
  // matching the iso rune ring (wide × short) so decor fills the outer area.
  const cx = w / 2;
  const cy = h / 2;
  const excludeRX = 280;
  const excludeRY = 150;

  const PROPS = 42;
  for (let i = 0; i < PROPS; i++) {
    const r = hash2(i * 31 + 7, 13 + i);
    const x = (r & 0xffff) % (w - 60) + 30;
    const y = ((r >> 16) & 0xffff) % (h - 60) + 30;
    const dx = (x - cx) / excludeRX;
    const dy = (y - cy) / excludeRY;
    if (dx * dx + dy * dy < 1) continue;

    const pick = r % 6;
    switch (pick) {
      case 0: drawBrokenPotion(ctx, x, y, 'cyan'); break;
      case 1: drawBrokenPotion(ctx, x, y, 'green'); break;
      case 2: drawBrokenPotion(ctx, x, y, 'purple'); break;
      case 3: drawBook(ctx, x, y, (r >> 3) & 1); break;
      case 4: drawPaperSheet(ctx, x, y, (r >> 5) & 3); break;
      default: drawDustPile(ctx, x, y); break;
    }
  }
}

function drawBackShelf(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x, y, 120, 44);
  ctx.fillStyle = COLORS.woodLight;
  ctx.fillRect(x + 4, y + 4, 112, 6);
  ctx.fillRect(x + 4, y + 25, 112, 6);
  ctx.fillStyle = COLORS.woodMid;
  ctx.fillRect(x + 8, y + 11, 104, 4);
  ctx.fillRect(x + 8, y + 32, 104, 4);
  const colors = [COLORS.aetherB, COLORS.fireB, COLORS.acidA, COLORS.essenceB, COLORS.mercA];
  for (let i = 0; i < 12; i++) {
    const bx = x + 12 + i * 8;
    const by = y + (i % 2 === 0 ? 16 : 36);
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.fillRect(bx, by - 6, 5, 7);
    ctx.fillStyle = COLORS.whiteSoft;
    ctx.fillRect(bx + 1, by - 5, 1, 1);
  }
}

function drawCandleCluster(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x + 9, y + 18, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 8;
    const h = 16 - i * 3;
    ctx.fillStyle = COLORS.parchment;
    ctx.fillRect(cx, y + 12 - h, 5, h);
    ctx.fillStyle = COLORS.fireB;
    ctx.fillRect(cx + 1, y + 8 - h, 3, 4);
    ctx.fillStyle = COLORS.fireA;
    ctx.fillRect(cx + 2, y + 7 - h, 1, 2);
  }
}

function drawBarrels(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  for (let i = 0; i < 2; i++) {
    const bx = x + i * 28;
    ctx.fillStyle = COLORS.woodDark;
    ctx.fillRect(bx, y, 22, 34);
    ctx.fillStyle = COLORS.woodMid;
    ctx.fillRect(bx + 3, y + 2, 16, 30);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(bx + 5, y + 4, 4, 26);
    ctx.fillStyle = COLORS.mortar;
    ctx.fillRect(bx, y + 8, 22, 3);
    ctx.fillRect(bx, y + 24, 22, 3);
  }
}

// Pixel helper: 1 "cell" is 3 screen px. Props end up roughly 24×12 which
// reads clearly next to the 34-px-wide alchemist sprite.
const P = 3;

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cw: number,
  ch: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), cw * P, ch * P);
}

// Broken potion: a clear bottle silhouette lying on its side with a spilled
// puddle, a cracked neck, and 3-4 chunky glass shards radiating outwards.
function drawBrokenPotion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: 'cyan' | 'green' | 'purple',
): void {
  const liquidA = tint === 'cyan' ? COLORS.shardA : tint === 'green' ? COLORS.shardGreenA : COLORS.shardPurpleA;
  const liquidB = tint === 'cyan' ? COLORS.shardB : tint === 'green' ? COLORS.shardGreenB : COLORS.shardPurpleB;
  const liquidHi = '#ffffff';
  const glass = COLORS.shardC;

  // Ground shadow (spilled puddle outline).
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x + P, y + 2 * P, 8 * P, 3 * P, 0, 0, Math.PI * 2);
  ctx.fill();

  // Liquid splash (2:1 blob in liquid colour).
  ctx.fillStyle = liquidA;
  ctx.beginPath();
  ctx.ellipse(x + P, y + P, 7 * P, 2.5 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = liquidB;
  ctx.beginPath();
  ctx.ellipse(x - P, y + P, 3 * P, 1.2 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specular highlight dot on the puddle.
  px(ctx, x - P, y, 1, 1, liquidHi);

  // Bottle body (round base + narrowing shoulder + neck lying to the left).
  // Base (3x2):
  px(ctx, x + P, y - P, 3, 2, glass);
  // Shoulder (narrower):
  px(ctx, x, y - 2 * P, 2, 1, glass);
  // Neck (1 cell tall) lying flat to the left with a cracked tip.
  px(ctx, x - 2 * P, y - 2 * P, 2, 1, glass);
  // Cork popped off.
  px(ctx, x - 3 * P, y - 2 * P, 1, 1, COLORS.woodMid);

  // Rim highlight on the body.
  px(ctx, x + 2 * P, y - P, 2, 1, liquidA);

  // Shards radiating out.
  px(ctx, x + 4 * P, y - 2 * P, 1, 1, glass);
  px(ctx, x + 4 * P, y, 1, 1, glass);
  px(ctx, x - 4 * P, y + 2 * P, 1, 1, glass);
  px(ctx, x + 2 * P, y + 3 * P, 1, 1, glass);
}

// Book with a clear spine, cover, and visible page edges. Optionally drawn
// lying open so the pages are legible.
function drawBook(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  if (variant === 0) {
    // Closed book seen from a 3/4 angle. 8x4 cells + shadow.
    const w = 8 * P;
    const h = 4 * P;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - w / 2 + P, y - h / 2 + P, w, h);
    // Cover.
    px(ctx, x - w / 2, y - h / 2, 8, 4, COLORS.bookA);
    // Spine band (top edge).
    px(ctx, x - w / 2, y - h / 2, 8, 1, COLORS.bookB);
    // Cover detail: embossed rectangle.
    px(ctx, x - w / 2 + 2 * P, y - h / 2 + 2 * P, 4, 1, COLORS.bookB);
    // Page edges on the right side.
    px(ctx, x + w / 2 - P, y - h / 2 + P, 1, 3, COLORS.paperA);
    // Bottom shadow line.
    px(ctx, x - w / 2, y + h / 2 - P, 8, 1, COLORS.bookC);
  } else {
    // Open book with two pages and a spine down the middle.
    const w = 10 * P;
    const h = 5 * P;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - w / 2 + P, y - h / 2 + P, w, h);
    // Pages (paper colour).
    px(ctx, x - w / 2, y - h / 2, 10, 5, COLORS.paperA);
    // Spine shadow down the middle.
    px(ctx, x - P / 2, y - h / 2, 1, 5, COLORS.bookC);
    // Page wrinkle / text lines.
    px(ctx, x - w / 2 + P, y - h / 2 + P, 3, 1, COLORS.paperB);
    px(ctx, x - w / 2 + P, y - h / 2 + 2 * P, 3, 1, COLORS.paperB);
    px(ctx, x + P, y - h / 2 + P, 3, 1, COLORS.paperB);
    px(ctx, x + P, y - h / 2 + 3 * P, 3, 1, COLORS.paperB);
    // Cover poking out behind the open pages.
    px(ctx, x - w / 2 - P, y - h / 2, 1, 5, COLORS.bookA);
    px(ctx, x + w / 2, y - h / 2, 1, 5, COLORS.bookA);
  }
}

// Paper variants: flat sheet w/ text, scroll with rolled ends, torn piece.
function drawPaperSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number,
): void {
  if (variant === 0) {
    // Flat sheet with 3 lines of "text".
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 4 * P + P, y - 3 * P + P, 8 * P, 6 * P);
    px(ctx, x - 4 * P, y - 3 * P, 8, 6, COLORS.paperA);
    // Corners folded (shading).
    px(ctx, x - 4 * P, y - 3 * P, 1, 1, COLORS.paperB);
    px(ctx, x + 3 * P, y + 2 * P, 1, 1, COLORS.paperB);
    // Text lines.
    px(ctx, x - 3 * P, y - 2 * P, 5, 1, COLORS.paperB);
    px(ctx, x - 3 * P, y, 6, 1, COLORS.paperB);
    px(ctx, x - 3 * P, y + 2 * P, 4, 1, COLORS.paperB);
  } else if (variant === 1) {
    // Scroll seen from above: tan tube with darker rolled ends.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 6 * P + P, y - P + P, 12 * P, 3 * P);
    // Main paper body.
    px(ctx, x - 5 * P, y - P, 10, 3, COLORS.paperA);
    // Text strip.
    px(ctx, x - 4 * P, y, 8, 1, COLORS.paperB);
    // Rolled ends — darker, rounded.
    px(ctx, x - 6 * P, y - 2 * P, 2, 5, COLORS.paperB);
    px(ctx, x + 4 * P, y - 2 * P, 2, 5, COLORS.paperB);
    // End highlight (inside of roll).
    px(ctx, x - 6 * P + P, y - P, 1, 1, COLORS.paperA);
    px(ctx, x + 4 * P + P, y - P, 1, 1, COLORS.paperA);
  } else {
    // Torn page — jagged edges.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 3 * P + P, y - 2 * P + P, 6 * P, 4 * P);
    px(ctx, x - 3 * P, y - 2 * P, 6, 4, COLORS.paperA);
    // Jagged top.
    px(ctx, x - 2 * P, y - 3 * P, 1, 1, COLORS.paperA);
    px(ctx, x, y - 3 * P, 1, 1, COLORS.paperA);
    px(ctx, x + 2 * P, y - 3 * P, 1, 1, COLORS.paperA);
    // Jagged bottom.
    px(ctx, x - 2 * P, y + 2 * P, 1, 1, COLORS.paperA);
    px(ctx, x + P, y + 2 * P, 1, 1, COLORS.paperA);
    // Text line.
    px(ctx, x - 2 * P, y, 4, 1, COLORS.paperB);
  }
}

function drawDustPile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Fluffy dust bunny: soft ellipse body with a few specks sticking out.
  ctx.fillStyle = COLORS.dustB;
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * P / P, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.dustA;
  ctx.beginPath();
  ctx.ellipse(x - 1, y - 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specks.
  px(ctx, x - 4 * P, y, 1, 1, COLORS.dustB);
  px(ctx, x + 3 * P, y - P, 1, 1, COLORS.dustB);
  px(ctx, x + P, y + P, 1, 1, COLORS.dustA);
}

/* ============================================================
 *  Workshop alchemy decor — intact props that lean into the cosy
 *  alchemist's-lab vibe (bottles full of glowing liquid, stacked
 *  books, scrolls, candle stubs, mortar & pestle, ink + quill,
 *  herb bundles, small wooden crates).
 *
 *  All props share these conventions:
 *   - drawn inside `applyIsoTransform`, so x/y are world coords
 *   - first paint a soft elliptical shadow under the prop
 *   - silhouette outline in pal `tileCrack` for a chunky readable
 *     pixel-art look against the warm wooden floor
 *   - colour pulled from the existing `COLORS` palette so the
 *     props stay visually coherent with the rest of the game
 * ============================================================ */

/** Liquid-tint pairs for `drawPotionBottle` — `body` is the saturated
 *  fill, `shine` is a brighter tone used for the glass highlight, and
 *  `cap` is the cork / stopper colour drawn on top. */
const POTION_TINTS = {
  green:  { body: COLORS.acidB,    shine: COLORS.acidA,    cap: COLORS.woodMid },
  blue:   { body: COLORS.aetherC,  shine: COLORS.aetherB,  cap: COLORS.woodMid },
  red:    { body: COLORS.fireC,    shine: COLORS.fireB,    cap: COLORS.woodMid },
  amber:  { body: COLORS.goldB,    shine: COLORS.goldA,    cap: COLORS.woodDark },
} as const;
type PotionTint = keyof typeof POTION_TINTS;

function softShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Intact alchemy bottle — round body + neck + cork, with a vertical
 *  shine line on the glass. Width ~12 cells, height ~6 cells. */
function drawPotionBottle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: PotionTint,
  seed: number,
): void {
  const t = POTION_TINTS[tint];
  const tilt = (seed >> 9) & 1; // half the bottles lean a tiny bit

  softShadow(ctx, x + 1, y + 4 * P, 7 * P, 2 * P);

  // Bottle body (rounded shoulders → wider base).
  px(ctx, x - 3 * P, y - P,    6, 4, t.body);   // body
  px(ctx, x - 2 * P, y - 2 * P, 4, 1, t.body);   // shoulder

  // Neck.
  px(ctx, x - P, y - 3 * P, 2, 1, t.body);

  // Cork.
  px(ctx, x - P, y - 4 * P, 2, 1, t.cap);
  px(ctx, x - P, y - 5 * P, 2, 1, COLORS.woodDark);

  // Glass shine.
  px(ctx, x - 2 * P, y - P, 1, 3, t.shine);
  px(ctx, x - 2 * P, y - 2 * P, 1, 1, COLORS.whiteSoft);

  // Bottom rim — slightly darker so the bottle has weight.
  px(ctx, x - 3 * P, y + 2 * P, 6, 1, COLORS.shardC);

  // Optional tilt — tip the cork sideways with one stray pixel.
  if (tilt) {
    px(ctx, x - 2 * P, y - 5 * P, 1, 1, t.cap);
  }
}

/** Single closed leather-bound tome with gilded spine. Variant chooses
 *  cover colour from a small set of warm leather tones. */
function drawClosedBook(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  const variant = (seed >> 4) & 0b11;
  // Cover palette — burgundy / forest / teal / mustard, all warm-leaning.
  const COVERS = [
    { a: COLORS.bookA,  b: COLORS.bookC, gilt: COLORS.brassHi },
    { a: '#1f4a3c',     b: '#0e2218',    gilt: COLORS.brassHi },
    { a: '#2a3a5e',     b: '#101428',    gilt: COLORS.brassHi },
    { a: '#7a5a14',     b: '#3a2a08',    gilt: COLORS.fireA },
  ] as const;
  const c = COVERS[variant]!;
  const w = 9 * P;
  const h = 4 * P;

  softShadow(ctx, x + 1, y + h / 2 + 2, w / 2, 3);

  // Cover.
  px(ctx, x - w / 2, y - h / 2, 9, 4, c.a);
  // Spine (top ribbon).
  px(ctx, x - w / 2, y - h / 2, 9, 1, c.b);
  // Gilded centre crest.
  px(ctx, x - w / 2 + 3 * P, y - h / 2 + 2 * P, 3, 1, c.gilt);
  // Page edges (right side).
  px(ctx, x + w / 2 - P, y - h / 2 + P, 1, 3, COLORS.paperA);
  // Bottom shadow line.
  px(ctx, x - w / 2, y + h / 2 - P, 9, 1, c.b);
  // Bookmark ribbon — a thin red strip dangling off the bottom.
  if ((seed >> 11) & 1) {
    px(ctx, x + w / 2 - 3 * P, y + h / 2, 1, 2, COLORS.fireC);
  }
}

/** Three stacked books with offset spines — the "stack of tomes on the
 *  floor" silhouette from the reference. */
function drawBookStack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  const COVERS = [COLORS.bookA, '#1f4a3c', '#2a3a5e', '#7a5a14'];
  softShadow(ctx, x + 1, y + 4 * P, 8 * P, 2 * P);
  // Bottom book — widest.
  const w0 = 10 * P;
  px(ctx, x - w0 / 2, y + P, 10, 3, COVERS[seed & 0b11]!);
  px(ctx, x - w0 / 2, y + P, 10, 1, COLORS.bookC);
  px(ctx, x + w0 / 2 - P, y + 2 * P, 1, 1, COLORS.paperA);
  // Middle book — slightly offset.
  const w1 = 8 * P;
  const off = ((seed >> 3) & 1) ? P : -P;
  px(ctx, x - w1 / 2 + off, y - 2 * P, 8, 3, COVERS[(seed >> 4) & 0b11]!);
  px(ctx, x - w1 / 2 + off, y - 2 * P, 8, 1, COLORS.bookC);
  // Top book — angled, smallest.
  const w2 = 6 * P;
  const off2 = ((seed >> 5) & 1) ? -P : P;
  px(ctx, x - w2 / 2 + off2, y - 5 * P, 6, 2, COVERS[(seed >> 6) & 0b11]!);
  px(ctx, x - w2 / 2 + off2, y - 5 * P, 6, 1, COLORS.bookC);
  // Glint of brass on the top spine.
  px(ctx, x - w2 / 2 + off2 + 2 * P, y - 5 * P, 2, 1, COLORS.brassHi);
}

/** Open book lying flat — pages with a few text lines and a leather
 *  cover poking out at the edges. Cosy reading-table beat. */
function drawOpenBookCosy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  const w = 12 * P;
  const h = 5 * P;
  softShadow(ctx, x + 1, y + h / 2 + 2, w / 2, 3);

  // Cover poking out behind the pages.
  px(ctx, x - w / 2 - P, y - h / 2, 1, 5, COLORS.bookA);
  px(ctx, x + w / 2,     y - h / 2, 1, 5, COLORS.bookA);

  // Pages.
  px(ctx, x - w / 2, y - h / 2, 12, 5, COLORS.paperA);
  // Spine shadow.
  px(ctx, x - P / 2, y - h / 2, 1, 5, COLORS.bookC);

  // Text lines (alternating density per page).
  const seed2 = seed >> 2;
  const linesL = 2 + (seed2 & 0b1);
  const linesR = 2 + ((seed2 >> 1) & 0b1);
  for (let i = 0; i < linesL; i++) {
    px(ctx, x - w / 2 + P, y - h / 2 + (i + 1) * P, 4, 1, COLORS.paperB);
  }
  for (let i = 0; i < linesR; i++) {
    px(ctx, x + P, y - h / 2 + (i + 1) * P, 4, 1, COLORS.paperB);
  }

  // Bookmark — sticking out the top.
  if ((seed >> 8) & 1) {
    px(ctx, x + 2 * P, y - h / 2 - P, 1, 2, COLORS.fireC);
  }
}

/** Rolled scroll — tan body with darker rolled ends + a wax seal. */
function drawScroll(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  softShadow(ctx, x + 1, y + 2, 6 * P, 2);
  // Body.
  px(ctx, x - 5 * P, y - P, 10, 3, COLORS.paperA);
  // Center text.
  px(ctx, x - 4 * P, y, 8, 1, COLORS.paperB);
  // Rolled ends.
  px(ctx, x - 6 * P, y - 2 * P, 2, 5, COLORS.paperB);
  px(ctx, x + 4 * P, y - 2 * P, 2, 5, COLORS.paperB);
  // Inside-of-roll highlight.
  px(ctx, x - 6 * P + P, y - P, 1, 1, COLORS.paperA);
  px(ctx, x + 4 * P + P, y - P, 1, 1, COLORS.paperA);
  // Wax seal — small red disc on top of the body, ~half the time.
  if ((seed >> 6) & 1) {
    px(ctx, x - P, y - 2 * P, 2, 1, COLORS.fireC);
    px(ctx, x - P, y - P,     2, 1, COLORS.fireD);
  }
}

/** Half-melted candle stub on the floor — wax body with a wick + flame
 *  tip + small puddle of wax around the base. */
function drawCandleStub(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  softShadow(ctx, x, y + 2 * P, 4 * P, P);
  // Wax puddle.
  ctx.fillStyle = COLORS.parchment;
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * P, 4 * P, P, 0, 0, Math.PI * 2);
  ctx.fill();
  // Candle body.
  px(ctx, x - P, y - 3 * P, 2, 5, COLORS.parchment);
  px(ctx, x - P, y - 3 * P, 2, 1, COLORS.brassHi);
  // Wick.
  px(ctx, x, y - 4 * P, 1, 1, COLORS.bookC);
  // Flame.
  px(ctx, x, y - 5 * P, 1, 1, COLORS.fireA);
  px(ctx, x - 1, y - 5 * P + P / 2, 2, 1, COLORS.fireB);
}

/** Stone mortar bowl with a wooden pestle leaning out of it. */
function drawMortarPestle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  softShadow(ctx, x + 1, y + 3 * P, 5 * P, P);
  // Bowl base (rounded).
  ctx.fillStyle = COLORS.stoneDark;
  ctx.beginPath();
  ctx.ellipse(x, y + P, 4 * P, 2 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.stoneMid;
  ctx.beginPath();
  ctx.ellipse(x, y, 4 * P, 1.4 * P, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner bowl shadow.
  ctx.fillStyle = COLORS.stoneLight;
  ctx.beginPath();
  ctx.ellipse(x, y - P, 3 * P, P, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pestle — leaning out the back.
  ctx.save();
  ctx.translate(x + P, y - P);
  ctx.rotate(-0.6);
  px(ctx, -P, -3 * P, 1, 5, COLORS.woodMid);
  px(ctx, -P, -3 * P, 1, 1, COLORS.woodHi);
  px(ctx, -P, -4 * P, 2, 1, COLORS.woodLight);
  ctx.restore();
}

/** Ink pot with a feathered quill leaning out. */
function drawInkAndQuill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  softShadow(ctx, x + 1, y + 3 * P, 4 * P, P);
  // Pot body (small).
  px(ctx, x - 2 * P, y, 4, 3, COLORS.shardC);
  // Pot rim.
  px(ctx, x - 2 * P, y, 4, 1, COLORS.stoneMid);
  // Ink surface.
  px(ctx, x - P, y + P, 2, 1, '#0a0a14');
  // Quill body.
  ctx.save();
  ctx.translate(x + P, y);
  ctx.rotate(-0.45);
  px(ctx, -P, -7 * P, 1, 7, COLORS.parchment);
  px(ctx, -P, -7 * P, 1, 1, COLORS.brassHi);
  // Feather plume.
  px(ctx, 0, -7 * P, 2, 1, COLORS.whiteSoft);
  px(ctx, 0, -6 * P, 2, 1, COLORS.parchment);
  px(ctx, 0, -5 * P, 1, 1, COLORS.parchment);
  ctx.restore();
}

/** Bound bunch of dried herbs — green/brown stalks tied with twine. */
function drawHerbBundle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
): void {
  softShadow(ctx, x + 1, y + 2 * P, 4 * P, P);
  const tint = (seed >> 4) & 1 ? COLORS.acidB : COLORS.slimeC;
  // Stalks fanning out.
  for (let i = -3; i <= 3; i++) {
    const sx = x + i * (P / 2);
    const top = y - 4 * P + Math.abs(i) * P;
    px(ctx, sx, top, 1, 4, tint);
  }
  // Leaf blobs.
  for (let i = -2; i <= 2; i += 2) {
    const sx = x + i * P;
    const top = y - 5 * P + Math.abs(i);
    px(ctx, sx, top, 2, 1, COLORS.acidA);
  }
  // Twine band.
  px(ctx, x - 2 * P, y - P, 4, 1, COLORS.brassDark);
}

/** Small wooden crate / box. Square silhouette with diagonal slats. */
function drawSmallCrate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  softShadow(ctx, x + 1, y + 3 * P, 5 * P, P);
  // Body.
  px(ctx, x - 3 * P, y - 2 * P, 6, 5, COLORS.woodMid);
  // Top edge highlight.
  px(ctx, x - 3 * P, y - 2 * P, 6, 1, COLORS.woodHi);
  // Bottom shadow.
  px(ctx, x - 3 * P, y + 2 * P, 6, 1, COLORS.woodDark);
  // Side seams.
  px(ctx, x - 3 * P, y - 2 * P, 1, 5, COLORS.woodDark);
  px(ctx, x + 3 * P - P, y - 2 * P, 1, 5, COLORS.woodDark);
  // Diagonal plank.
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 3 * P + 1, y - 2 * P + 1);
  ctx.lineTo(x + 3 * P - 1, y + 2 * P + 1);
  ctx.stroke();
}

// Filled 2:1 diamond (rhombus) centred at (cx, cy).
function fillRhombus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string,
): void {
  const hw = w / 2;
  const hh = h / 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
}

function strokeRhombus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  stroke: string,
): void {
  const hw = w / 2;
  const hh = h / 2;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();
}

function hash2(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  return h * 2654435761 >>> 0;
}

// Biome-specific small decorations drawn on the backdrop canvas.
function drawBiomeDecor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  biome: BiomeId,
): void {
  if (biome === 'workshop') return; // workshop uses only the standard decor

  const cx = w / 2;
  const cy = h / 2;
  const excludeRX = 280;
  const excludeRY = 150;
  const COUNT = 14;

  for (let i = 0; i < COUNT; i++) {
    const r = hash2(i * 47 + 113, 29 + i * 7);
    const x = (r & 0xffff) % (w - 80) + 40;
    const y = ((r >> 16) & 0xffff) % (h - 80) + 40;
    const dx = (x - cx) / excludeRX;
    const dy = (y - cy) / excludeRY;
    if (dx * dx + dy * dy < 1) continue;

    if (biome === 'crypt') {
      // Small skull / bone scatter
      if (i % 3 === 0) {
        // Skull
        ctx.fillStyle = '#6a6470';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a3440';
        ctx.fillRect(x - 1, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else {
        // Bone shard
        ctx.fillStyle = '#5a5460';
        ctx.fillRect(x, y, 6, 2);
        ctx.fillStyle = '#7a7480';
        ctx.fillRect(x + 1, y, 4, 1);
      }
    } else if (biome === 'foundry') {
      // Embers / slag lumps
      if (i % 3 === 0) {
        // Glowing ember
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ff6030';
        ctx.fillRect(x, y, 3, 3);
        ctx.fillStyle = '#ffa050';
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.restore();
      } else {
        // Slag lump
        ctx.fillStyle = '#3a2220';
        ctx.fillRect(x, y, 5, 3);
        ctx.fillStyle = '#5a3230';
        ctx.fillRect(x + 1, y + 1, 3, 1);
      }
    }
  }
}

// Walls have been removed, so there are no door overlays. Kept as a no-op so
// existing call-sites compile; the active entrance is still communicated via
// a subtle glow hint drawn by render.ts.
export function drawActiveDoor(
  ctx: CanvasRenderingContext2D,
  entranceX: number,
  entranceY: number,
  pulse: number,
  w: number,
  h: number,
): void {
  const x = Math.max(22, Math.min(w - 22, entranceX));
  const y = Math.max(26, Math.min(h - 26, entranceY));
  const horizontal = entranceY < 0 || entranceY > h;
  const glow = 0.28 + pulse * 0.32;
  ctx.save();
  ctx.globalAlpha = glow;
  ctx.fillStyle = COLORS.fireC;
  ctx.beginPath();
  ctx.ellipse(x, y, horizontal ? 55 : 22, horizontal ? 18 : 58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.woodDark;
  if (horizontal) {
    ctx.fillRect(x - 34, y - 10, 68, 20);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x - 28, y - 6, 56, 5);
    ctx.fillRect(x - 28, y + 2, 56, 5);
  } else {
    ctx.fillRect(x - 10, y - 34, 20, 68);
    ctx.fillStyle = COLORS.woodLight;
    ctx.fillRect(x - 6, y - 28, 5, 56);
    ctx.fillRect(x + 2, y - 28, 5, 56);
  }
  ctx.restore();
}
