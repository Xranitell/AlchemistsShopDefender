import { COLORS } from './palette';
import { getSprites } from './sprites';
import { drawSprite } from './sprite';

// Room layout constants (in world/canvas px). The arena is 1280x720 and we
// wrap it in TBOI-style stone walls. Doors cut into the walls at the four
// entrance positions. Gameplay code uses the whole canvas; walls just paint
// over the outer ring.

export const WALL_TOP = 48;
export const WALL_SIDE = 48;
export const WALL_BOTTOM = 72; // thicker because it has a vertical front face

let cached: HTMLCanvasElement | null = null;
let cachedSize: { w: number; h: number } | null = null;

// The room backdrop changes very rarely (only on resize) so we pre-render it
// once into an offscreen canvas. Decor placements are seeded deterministically
// so they don't change between frames.
export function getRoomBackdrop(width: number, height: number): HTMLCanvasElement {
  if (cached && cachedSize && cachedSize.w === width && cachedSize.h === height) {
    return cached;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  drawFloor(ctx, width, height);
  drawDecor(ctx, width, height);
  drawWalls(ctx, width, height);

  cached = c;
  cachedSize = { w: width, h: height };
  return c;
}

// Tiled floor. Tiles are 32×32 procedural patterns with random cracks/stains
// chosen deterministically by (tx, ty). Inner playable area only — walls will
// paint over the outer ring.
function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const TILE = 32;
  const innerX0 = WALL_SIDE;
  const innerY0 = WALL_TOP;
  const innerX1 = w - WALL_SIDE;
  const innerY1 = h - WALL_BOTTOM;

  // Base fill
  ctx.fillStyle = COLORS.tileA;
  ctx.fillRect(innerX0, innerY0, innerX1 - innerX0, innerY1 - innerY0);

  for (let y = innerY0; y < innerY1; y += TILE) {
    for (let x = innerX0; x < innerX1; x += TILE) {
      const tx = x / TILE;
      const ty = y / TILE;
      const seed = hash2(tx, ty);

      // Alternate base colour between two tile colours by checker pattern.
      const base = (tx + ty) % 2 === 0 ? COLORS.tileA : COLORS.tileB;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, TILE, TILE);

      // 1-pixel mortar lines between tiles (darker).
      ctx.fillStyle = COLORS.tileCrack;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillRect(x, y, 1, TILE);

      // Occasional crack pattern.
      if ((seed & 0b11) === 0b11) {
        ctx.fillStyle = COLORS.tileCrack;
        const cx = x + 4 + (seed % 16);
        const cy = y + 4 + ((seed >> 4) % 16);
        ctx.fillRect(cx, cy, 6, 1);
        ctx.fillRect(cx + 6, cy, 1, 4);
        ctx.fillRect(cx + 6, cy + 4, 4, 1);
      }
      // Occasional highlight tile.
      if ((seed & 0b111) === 0b101) {
        ctx.fillStyle = COLORS.tileC;
        ctx.fillRect(x + 10, y + 10, 2, 2);
      }
    }
  }

  // Ambient occlusion: darker edges along walls
  const aoSize = 16;
  // Top edge AO
  const aoTop = ctx.createLinearGradient(0, innerY0, 0, innerY0 + aoSize);
  aoTop.addColorStop(0, 'rgba(0,0,0,0.35)');
  aoTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aoTop;
  ctx.fillRect(innerX0, innerY0, innerX1 - innerX0, aoSize);
  // Bottom edge AO
  const aoBot = ctx.createLinearGradient(0, innerY1 - aoSize, 0, innerY1);
  aoBot.addColorStop(0, 'rgba(0,0,0,0)');
  aoBot.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = aoBot;
  ctx.fillRect(innerX0, innerY1 - aoSize, innerX1 - innerX0, aoSize);
  // Left edge AO
  const aoLeft = ctx.createLinearGradient(innerX0, 0, innerX0 + aoSize, 0);
  aoLeft.addColorStop(0, 'rgba(0,0,0,0.3)');
  aoLeft.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aoLeft;
  ctx.fillRect(innerX0, innerY0, aoSize, innerY1 - innerY0);
  // Right edge AO
  const aoRight = ctx.createLinearGradient(innerX1 - aoSize, 0, innerX1, 0);
  aoRight.addColorStop(0, 'rgba(0,0,0,0)');
  aoRight.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = aoRight;
  ctx.fillRect(innerX1 - aoSize, innerY0, aoSize, innerY1 - innerY0);

  // Soft edge vignette around the playable area to push focus to the centre.
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(innerX1 - innerX0, innerY1 - innerY0) * 0.2,
    w / 2,
    h / 2,
    Math.max(innerX1 - innerX0, innerY1 - innerY0) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(innerX0, innerY0, innerX1 - innerX0, innerY1 - innerY0);

  // Subtle center spotlight
  const spotlight = ctx.createRadialGradient(w / 2, h / 2 - 30, 0, w / 2, h / 2 - 30, 200);
  spotlight.addColorStop(0, 'rgba(125, 249, 255, 0.03)');
  spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(innerX0, innerY0, innerX1 - innerX0, innerY1 - innerY0);
}

// Decoration (shelves, cauldron, candles) pushed up against the inside of the
// walls. Purely cosmetic — game logic never reads these.
function drawDecor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const s = getSprites();
  const scale = 2;

  // Shelves along the top inner wall.
  for (const cx of [220, 420, 860, 1060]) {
    drawSprite(ctx, s.shelf, cx, WALL_TOP + 10, scale);
  }
  // Cauldron centered against the top wall (but not covering the door at x≈640).
  drawSprite(ctx, s.cauldron, 640 - 190, WALL_TOP + 20, scale);
  drawSprite(ctx, s.cauldron, 640 + 190, WALL_TOP + 20, scale);

  // Shelves along the bottom inner wall (above the vertical front face).
  for (const cx of [220, 420, 860, 1060]) {
    drawSprite(ctx, s.shelf, cx, h - WALL_BOTTOM - 10, scale);
  }

  // Candles at inner corners and midpoints of the side walls.
  const candlePositions = [
    [WALL_SIDE + 30, WALL_TOP + 40],
    [w - WALL_SIDE - 30, WALL_TOP + 40],
    [WALL_SIDE + 30, h - WALL_BOTTOM - 30],
    [w - WALL_SIDE - 30, h - WALL_BOTTOM - 30],
    [WALL_SIDE + 30, h / 2 - 80],
    [w - WALL_SIDE - 30, h / 2 - 80],
    [WALL_SIDE + 30, h / 2 + 80],
    [w - WALL_SIDE - 30, h / 2 + 80],
  ];
  for (const [cx, cy] of candlePositions) {
    drawSprite(ctx, s.candle, cx!, cy!, scale);
  }
}

// Walls with TBOI-style vertical front face on the bottom wall.
function drawWalls(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Outer room fill: dark stone for the whole border area (will be over-
  // written by inner floor, so just draw as a frame).
  ctx.fillStyle = COLORS.stoneDark;
  ctx.fillRect(0, 0, w, WALL_TOP);
  ctx.fillRect(0, h - WALL_BOTTOM, w, WALL_BOTTOM);
  ctx.fillRect(0, 0, WALL_SIDE, h);
  ctx.fillRect(w - WALL_SIDE, 0, WALL_SIDE, h);

  // Stone block pattern on top / side walls.
  drawStoneBlocks(ctx, 0, 0, w, WALL_TOP, 'top');
  drawStoneBlocks(ctx, 0, WALL_TOP, WALL_SIDE, h - WALL_TOP - WALL_BOTTOM, 'left');
  drawStoneBlocks(ctx, w - WALL_SIDE, WALL_TOP, WALL_SIDE, h - WALL_TOP - WALL_BOTTOM, 'right');

  // Bottom wall: two-part. A thinner stone band at the top of it, then a
  // taller vertical "face" below with a front-lit highlight. This is what
  // gives the room the TBOI pseudo-isometric feel.
  drawStoneBlocks(ctx, 0, h - WALL_BOTTOM, w, 24, 'bottom-top');
  // Front face
  ctx.fillStyle = COLORS.stoneMid;
  ctx.fillRect(0, h - WALL_BOTTOM + 24, w, WALL_BOTTOM - 24);
  // Highlight strip where top meets face
  ctx.fillStyle = COLORS.stoneHi;
  ctx.fillRect(0, h - WALL_BOTTOM + 24, w, 2);
  // Mortar lines on front face
  ctx.fillStyle = COLORS.mortar;
  for (let x = 0; x < w; x += 48) {
    ctx.fillRect(x, h - WALL_BOTTOM + 24, 1, WALL_BOTTOM - 24);
  }
  // Base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h - 4, w, 4);

  // Corner pillars: slightly lighter blocks at the four corners.
  drawCorner(ctx, 0, 0);
  drawCorner(ctx, w - WALL_SIDE, 0);
  drawCorner(ctx, 0, h - WALL_BOTTOM);
  drawCorner(ctx, w - WALL_SIDE, h - WALL_BOTTOM);

  // Door openings at the four cardinal entrances. Positions match
  // world.ts buildEntrances(): (w/2, 30), (w-30, h/2), (w/2, h-30), (30, h/2)
  const doorW = 72;
  const doorH = 72;
  // Top door
  paintDoor(ctx, w / 2 - doorW / 2, 0, doorW, WALL_TOP);
  // Right door
  paintDoor(ctx, w - WALL_SIDE, h / 2 - doorH / 2, WALL_SIDE, doorH);
  // Bottom door (cuts through both the top band and the front face)
  paintDoor(ctx, w / 2 - doorW / 2, h - WALL_BOTTOM, doorW, WALL_BOTTOM);
  // Left door
  paintDoor(ctx, 0, h / 2 - doorH / 2, WALL_SIDE, doorH);
}

function drawStoneBlocks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  orient: 'top' | 'left' | 'right' | 'bottom-top',
): void {
  const bw = 48;
  const bh = 16;
  // Base
  ctx.fillStyle = COLORS.stoneDark;
  ctx.fillRect(x, y, w, h);
  // Blocks
  for (let by = 0; by < h; by += bh) {
    const offset = (Math.floor(by / bh) % 2 === 0) ? 0 : bw / 2;
    for (let bx = -bw; bx < w + bw; bx += bw) {
      const px = x + bx + offset;
      const py = y + by;
      const seed = hash2(Math.floor(px / bw), Math.floor(py / bh));
      const fill = (seed & 0b11) === 0b11 ? COLORS.stoneLight : COLORS.stoneMid;
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, bw - 1, bh - 1);
      // Top highlight
      if (orient === 'top' || orient === 'bottom-top') {
        ctx.fillStyle = COLORS.stoneHi;
        ctx.fillRect(px, py, bw - 1, 1);
      } else if (orient === 'left') {
        ctx.fillStyle = COLORS.stoneHi;
        ctx.fillRect(px, py, 1, bh - 1);
      } else if (orient === 'right') {
        ctx.fillStyle = COLORS.stoneHi;
        ctx.fillRect(px + bw - 2, py, 1, bh - 1);
      }
    }
  }
  // Clip to rect
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.restore();
}

function drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.stoneLight;
  ctx.fillRect(x + 2, y + 2, WALL_SIDE - 4, 12);
  ctx.fillStyle = COLORS.stoneHi;
  ctx.fillRect(x + 2, y + 2, WALL_SIDE - 4, 2);
}

function paintDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Clear the stone where the door cuts through.
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(x, y, w, h);
  // Wooden planks
  ctx.fillStyle = COLORS.woodMid;
  for (let px = x + 4; px < x + w - 4; px += 10) {
    ctx.fillRect(px, y + 4, 6, h - 8);
  }
  // Door frame
  ctx.fillStyle = COLORS.woodLight;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
}

function hash2(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  return h * 2654435761 >>> 0;
}

// Draw an "active" door overlay (glowing red runes) on top of the pre-baked
// backdrop. This is called per-frame from render.ts because it pulses.
export function drawActiveDoor(
  ctx: CanvasRenderingContext2D,
  entranceX: number,
  entranceY: number,
  pulse: number,
  w: number,
  h: number,
): void {
  // Determine which wall the entrance is on by closeness to edges.
  const doorW = 72;
  let rx = 0,
    ry = 0,
    rw = 0,
    rh = 0;
  if (entranceY < 40) {
    // Top
    rx = entranceX - doorW / 2;
    ry = 0;
    rw = doorW;
    rh = WALL_TOP;
  } else if (entranceY > h - 40) {
    // Bottom
    rx = entranceX - doorW / 2;
    ry = h - WALL_BOTTOM;
    rw = doorW;
    rh = WALL_BOTTOM;
  } else if (entranceX < 40) {
    // Left
    rx = 0;
    ry = entranceY - doorW / 2;
    rw = WALL_SIDE;
    rh = doorW;
  } else {
    // Right
    rx = w - WALL_SIDE;
    ry = entranceY - doorW / 2;
    rw = WALL_SIDE;
    rh = doorW;
  }
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.35 * pulse;
  // Red glow fill over the door area.
  const grad = ctx.createRadialGradient(
    rx + rw / 2,
    ry + rh / 2,
    0,
    rx + rw / 2,
    ry + rh / 2,
    Math.max(rw, rh),
  );
  grad.addColorStop(0, COLORS.fireA);
  grad.addColorStop(0.5, COLORS.fireC);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(rx - 8, ry - 8, rw + 16, rh + 16);
  ctx.globalAlpha = 1;
  // Red runic streak across the door.
  ctx.fillStyle = COLORS.fireA;
  ctx.fillRect(rx + 4, ry + rh / 2 - 1, rw - 8, 2);
  ctx.fillStyle = COLORS.fireB;
  ctx.fillRect(rx + 4, ry + rh / 2 + 1, rw - 8, 1);
  ctx.restore();
}
