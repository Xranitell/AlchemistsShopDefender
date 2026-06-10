// Central stone dais beneath the mannequin. Drawn as a circular platform with
// concentric rings and a decorative crystal altar at the top. The dais is
// baked once to an offscreen canvas.

import { COLORS } from './palette';
import { drawSprite } from './sprite';
import { getSprites } from './sprites';

let _baked: HTMLCanvasElement | null = null;
let _bakedSize: { w: number; h: number } | null = null;

export const DAIS_RADIUS_OUTER = 170;
export const DAIS_RADIUS_INNER = 126;

export function getDais(width: number, height: number): HTMLCanvasElement {
  if (_baked && _bakedSize && _bakedSize.w === width && _bakedSize.h === height) {
    return _baked;
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);

  // Outer cast shadow on floor.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 34, DAIS_RADIUS_OUTER + 34, DAIS_RADIUS_OUTER * 0.55 + 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Raised vertical skirt, like the reference arena platform.
  ctx.fillStyle = COLORS.daisDark;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28, DAIS_RADIUS_OUTER + 4, DAIS_RADIUS_OUTER * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.daisMid;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, DAIS_RADIUS_OUTER, DAIS_RADIUS_OUTER * 0.62 - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer rim of the dais (darkest stone)
  ctx.fillStyle = COLORS.daisDark;
  ctx.beginPath();
  ctx.ellipse(cx, cy, DAIS_RADIUS_OUTER, DAIS_RADIUS_OUTER * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mid stone ring with masonry detail.
  ctx.fillStyle = COLORS.daisMid;
  ctx.beginPath();
  ctx.ellipse(cx, cy, DAIS_RADIUS_OUTER - 8, DAIS_RADIUS_OUTER * 0.62 - 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stone block segments around the rim (chunky pixel masonry).
  drawRimBlocks(ctx, cx, cy, DAIS_RADIUS_OUTER - 4, DAIS_RADIUS_OUTER * 0.62 - 3, 14);
  drawStepBlockRing(ctx, cx, cy + 28);

  // Inner platform (lighter stone)
  ctx.fillStyle = COLORS.daisLight;
  ctx.beginPath();
  ctx.ellipse(cx, cy, DAIS_RADIUS_INNER, DAIS_RADIUS_INNER * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner platform highlight (top edge gets brighter)
  ctx.fillStyle = COLORS.daisHi;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, DAIS_RADIUS_INNER - 4, (DAIS_RADIUS_INNER - 4) * 0.62, 0, Math.PI, 0);
  ctx.fill();

  // Tile/crack lines on the inner platform.
  drawDaisTiles(ctx, cx, cy);

  // Crystal altar at top of dais.
  const s = getSprites();
  drawSprite(ctx, s.crystalAltar, cx, cy - DAIS_RADIUS_INNER * 0.62 + 4, 3);

  _baked = c;
  _bakedSize = { w: width, h: height };
  return c;
}

function drawRimBlocks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
): void {
  ctx.strokeStyle = COLORS.daisDark;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const ax = cx + Math.cos(a) * rx;
    const ay = cy + Math.sin(a) * ry;
    const a2 = ((i + 1) / count) * Math.PI * 2;
    const bx = cx + Math.cos(a2) * rx;
    const by = cy + Math.sin(a2) * ry;
    // Just dark-line separators between blocks.
    ctx.beginPath();
    ctx.moveTo(Math.round(ax), Math.round(ay));
    ctx.lineTo(Math.round((ax + cx) * 0.5 + (cx - ax) * 0.04), Math.round((ay + cy) * 0.5 + (cy - ay) * 0.04));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.round(bx), Math.round(by));
    ctx.lineTo(Math.round((bx + cx) * 0.5 + (cx - bx) * 0.04), Math.round((by + cy) * 0.5 + (cy - by) * 0.04));
    ctx.stroke();
  }
}

function drawStepBlockRing(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const blocks = 24;
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2;
    if (Math.sin(a) < -0.15) continue;
    const x = cx + Math.cos(a) * (DAIS_RADIUS_OUTER - 8);
    const y = cy + Math.sin(a) * ((DAIS_RADIUS_OUTER - 8) * 0.62);
    const w = 20 - Math.abs(Math.cos(a)) * 8;
    const h = 9;
    ctx.fillStyle = i % 2 === 0 ? COLORS.daisLight : COLORS.daisMid;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), h);
    ctx.fillStyle = COLORS.daisCrack;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y + h / 2 - 1), Math.round(w), 1);
  }
}

function drawDaisTiles(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Light cracks emanating outward from the centre.
  ctx.strokeStyle = COLORS.daisCrack;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.18;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      Math.round(cx + Math.cos(a) * (DAIS_RADIUS_INNER - 16)),
      Math.round(cy + Math.sin(a) * (DAIS_RADIUS_INNER - 16) * 0.62),
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
