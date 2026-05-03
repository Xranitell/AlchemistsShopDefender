import { COLORS } from './palette';

// All VFX helpers here are stateless: they read from GameState fields that
// already exist (firePools, floatingTexts, overload effect) and draw a pixel-
// art representation. Particle pools live elsewhere if needed.

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.45,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Iso-plane Y-compression: the game renders on a flat 2D camera but the art
// style treats the floor as viewed from an iso angle, so "floor-plane" AoE
// shapes (fire pools, rune slots, dais) use 2:1 ellipses rather than circles.
export const FLOOR_Y_SCALE = 0.5;

// Pixel-art fire pool rendered as an iso-plane ellipse (2:1) so the AoE sits
// on the same plane as the floor tiles, matching the hero's dais.
export function drawFirePool(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
  worldTime: number,
): void {
  const flicker = (Math.sin(worldTime * 12) + 1) * 0.5;
  const alpha = Math.min(0.85, 0.55 + flicker * 0.3) * Math.max(0, Math.min(1, time / 0.3));
  const fadeOut = Math.max(0, Math.min(1, (3 - time) / 0.6));
  const finalAlpha = alpha * fadeOut;

  ctx.save();
  ctx.globalAlpha = finalAlpha;
  // Outer hot ring — elliptical so it reads as a puddle on the floor.
  ctx.fillStyle = COLORS.fireD;
  drawFloorEllipse(ctx, cx, cy, radius);
  ctx.fillStyle = COLORS.fireC;
  drawFloorEllipse(ctx, cx, cy, radius * 0.85);
  ctx.fillStyle = COLORS.fireB;
  drawFloorEllipse(ctx, cx, cy, radius * 0.6);

  // Pixel-art flames bobbing on top, positioned along the iso ellipse.
  const flameCount = Math.max(3, Math.floor(radius / 8));
  for (let i = 0; i < flameCount; i++) {
    const a = (i / flameCount) * Math.PI * 2 + worldTime * 1.5;
    const rx = radius * 0.55;
    const ry = radius * 0.55 * FLOOR_Y_SCALE;
    const px = Math.round(cx + Math.cos(a) * rx);
    const py = Math.round(cy + Math.sin(a) * ry);
    const ph = 4 + Math.round(Math.sin(worldTime * 8 + i) * 2 + 2);
    ctx.fillStyle = COLORS.fireB;
    ctx.fillRect(px - 1, py - ph, 2, ph);
    ctx.fillStyle = COLORS.fireA;
    ctx.fillRect(px - 1, py - ph, 2, 2);
  }
  ctx.restore();
}

// Filled 2:1 ellipse centred at (cx, cy) with horizontal radius r.
export function drawFloorEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * FLOOR_Y_SCALE, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Stroked 2:1 ellipse — useful for rune circles / range indicators.
export function strokeFloorEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * FLOOR_Y_SCALE, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// Pixel-art zigzag lightning bolt between two points. Each segment is a few
// pixel-quantised steps that wobble perpendicular to the segment.
export function drawZigzagBolt(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  alpha: number,
  seed: number,
): void {
  const segments = 6;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = -dy / len;
  const uy = dx / len;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseX = ax + dx * t;
    const baseY = ay + dy * t;
    const ampScale = i === 0 || i === segments ? 0 : 1;
    const wobble = ((Math.sin(seed * 17.3 + i * 4.7) + Math.cos(seed * 9.7 + i * 7.1)) * 6) * ampScale;
    points.push({ x: baseX + ux * wobble, y: baseY + uy * wobble });
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  // Outer cyan glow
  ctx.strokeStyle = COLORS.aetherC;
  ctx.lineWidth = 6;
  drawPath(ctx, points);
  // Mid
  ctx.strokeStyle = COLORS.aetherB;
  ctx.lineWidth = 3;
  drawPath(ctx, points);
  // White core
  ctx.strokeStyle = COLORS.whiteSoft;
  ctx.lineWidth = 1.5;
  drawPath(ctx, points);
  ctx.restore();
}

// Pixel-style aim reticle: 4 small corner brackets.
export function drawReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const r = 14;
  const len = 6;
  ctx.save();
  ctx.strokeStyle = COLORS.aetherB;
  ctx.lineWidth = 2;
  ctx.beginPath();
  // top-left
  ctx.moveTo(x - r, y - r + len);
  ctx.lineTo(x - r, y - r);
  ctx.lineTo(x - r + len, y - r);
  // top-right
  ctx.moveTo(x + r - len, y - r);
  ctx.lineTo(x + r, y - r);
  ctx.lineTo(x + r, y - r + len);
  // bot-right
  ctx.moveTo(x + r, y + r - len);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x + r - len, y + r);
  // bot-left
  ctx.moveTo(x - r + len, y + r);
  ctx.lineTo(x - r, y + r);
  ctx.lineTo(x - r, y + r - len);
  ctx.stroke();
  // centre dot
  ctx.fillStyle = COLORS.whiteSoft;
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  ctx.restore();
}

// Floating combat text in pixel style (sharp edges, no AA). Bold red damage
// numbers with 2px black outline matching reference. The outline is drawn
// at the four cardinal offsets — for a 2px outline this is visually
// indistinguishable from the 8-direction version (corners are filled by
// the cardinal neighbours), and halves the number of fillText calls.
const FLOATING_TEXT_OUTLINE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
];

export function drawPixelFloatingText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 22px "Press Start 2P", "VT323", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  for (let i = 0; i < FLOATING_TEXT_OUTLINE_OFFSETS.length; i++) {
    const off = FLOATING_TEXT_OUTLINE_OFFSETS[i]!;
    ctx.fillText(text, x + off[0], y + off[1]);
  }
  // Inner fill
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
}
