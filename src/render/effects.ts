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

// Pixel-art fire pool: cluster of flickering vertical "flame" pixels.
// `time` is the pool's age (newer = brighter, older = fade).
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
  // Outer hot ring
  ctx.fillStyle = COLORS.fireD;
  drawDisk(ctx, cx, cy, radius);
  ctx.fillStyle = COLORS.fireC;
  drawDisk(ctx, cx, cy, radius * 0.85);
  ctx.fillStyle = COLORS.fireB;
  drawDisk(ctx, cx, cy, radius * 0.6);

  // Pixel-art flames bobbing on top
  const flameCount = Math.max(3, Math.floor(radius / 8));
  for (let i = 0; i < flameCount; i++) {
    const a = (i / flameCount) * Math.PI * 2 + worldTime * 1.5;
    const dist = radius * 0.4;
    const px = Math.round(cx + Math.cos(a) * dist);
    const py = Math.round(cy + Math.sin(a) * dist);
    const ph = 4 + Math.round(Math.sin(worldTime * 8 + i) * 2 + 2);
    ctx.fillStyle = COLORS.fireB;
    ctx.fillRect(px - 1, py - ph, 2, ph);
    ctx.fillStyle = COLORS.fireA;
    ctx.fillRect(px - 1, py - ph, 2, 2);
  }
  ctx.restore();
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
// numbers with 2px black outline matching reference.
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
  // 2px chunky outline (offset shadow in 8 directions for pixel-style edge)
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  for (const [ox, oy] of [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ] as const) {
    ctx.fillText(text, x + ox, y + oy);
  }
  // Inner fill
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDisk(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.stroke();
}
