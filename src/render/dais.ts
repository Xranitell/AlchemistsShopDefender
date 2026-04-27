// Central stone dais beneath the mannequin. Drawn as a circular platform with
// concentric rings, decorative crystal altar at the top, and four ability
// rings arranged around the central position. The dais is baked once to an
// offscreen canvas; the only per-frame work is the ability glyph rotation /
// pulse, which the renderer overlays on top.

import { COLORS } from './palette';
import { drawSprite } from './sprite';
import { getSprites } from './sprites';

let _baked: HTMLCanvasElement | null = null;
let _bakedSize: { w: number; h: number } | null = null;

export const DAIS_RADIUS_OUTER = 138;
export const DAIS_RADIUS_INNER = 100;
export const DAIS_RING_RADIUS = 58;
export const DAIS_RING_HALF = 18;

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
  ctx.ellipse(cx, cy + 12, DAIS_RADIUS_OUTER + 14, DAIS_RADIUS_OUTER * 0.55 + 8, 0, 0, Math.PI * 2);
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
  drawSprite(ctx, s.crystalAltar, cx, cy - DAIS_RADIUS_INNER * 0.62 + 8, 2);

  // Four ability ring slots (decorative — purely visual indicators of
  // mannequin loadout). Positioned in a 2x2 grid around the centre.
  const slotPositions = getAbilitySlotPositions(cx, cy);
  for (let i = 0; i < slotPositions.length; i++) {
    drawAbilitySlotBase(ctx, slotPositions[i]!.x, slotPositions[i]!.y);
  }

  _baked = c;
  _bakedSize = { w: width, h: height };
  return c;
}

export function getAbilitySlotPositions(
  cx: number,
  cy: number,
): { x: number; y: number }[] {
  // 2 above, 2 below — like the reference.
  const dx = 50;
  const dyTop = -16;
  const dyBot = 24;
  return [
    { x: cx - dx, y: cy + dyTop },
    { x: cx + dx, y: cy + dyTop },
    { x: cx - dx, y: cy + dyBot },
    { x: cx + dx, y: cy + dyBot },
  ];
}

function drawAbilitySlotBase(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Outer dark ring
  ctx.fillStyle = COLORS.ringDark;
  ctx.beginPath();
  ctx.arc(x, y, DAIS_RING_HALF + 3, 0, Math.PI * 2);
  ctx.fill();
  // Mid ring
  ctx.fillStyle = COLORS.ringMid;
  ctx.beginPath();
  ctx.arc(x, y, DAIS_RING_HALF + 1, 0, Math.PI * 2);
  ctx.fill();
  // Stone interior
  ctx.fillStyle = COLORS.daisMid;
  ctx.beginPath();
  ctx.arc(x, y, DAIS_RING_HALF - 1, 0, Math.PI * 2);
  ctx.fill();
  // Cyan inner lip
  ctx.fillStyle = COLORS.ringHi;
  ctx.beginPath();
  ctx.arc(x, y, DAIS_RING_HALF, 0, Math.PI * 2);
  ctx.arc(x, y, DAIS_RING_HALF - 1, 0, Math.PI * 2, true);
  ctx.fill();
}

// Draw the per-frame glow pulse and ability glyph on top of each slot.
export function drawAbilitySlotsOverlay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  worldTime: number,
  glyphs: AbilityGlyph[],
): void {
  const slots = getAbilitySlotPositions(cx, cy);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    const glyph = glyphs[i] ?? 'cloud';
    const pulse = 0.5 + 0.5 * Math.sin(worldTime * 2 + i * 1.4);
    // Cyan inner glow
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * pulse;
    ctx.strokeStyle = COLORS.ringGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, DAIS_RING_HALF + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawAbilityGlyph(ctx, s.x, s.y, glyph);
  }
}

export type AbilityGlyph = 'cloud' | 'flame' | 'shield' | 'mark';

function drawAbilityGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glyph: AbilityGlyph,
): void {
  ctx.save();
  ctx.translate(x, y);
  switch (glyph) {
    case 'cloud':
      ctx.fillStyle = COLORS.aetherA;
      pixel(ctx, -4, -2, 8, 4);
      pixel(ctx, -2, -5, 4, 2);
      pixel(ctx, 1, -4, 3, 2);
      pixel(ctx, -5, 0, 2, 2);
      pixel(ctx, 4, 0, 2, 2);
      ctx.fillStyle = COLORS.aetherB;
      pixel(ctx, -3, -1, 6, 2);
      break;
    case 'flame':
      ctx.fillStyle = COLORS.fireB;
      pixel(ctx, -1, -6, 2, 2);
      pixel(ctx, -3, -4, 6, 4);
      pixel(ctx, -4, 0, 8, 3);
      ctx.fillStyle = COLORS.fireA;
      pixel(ctx, -1, -3, 2, 4);
      pixel(ctx, -2, 0, 4, 2);
      break;
    case 'shield':
      ctx.fillStyle = COLORS.daisDark;
      pixel(ctx, -4, -5, 8, 2);
      pixel(ctx, -4, -3, 8, 6);
      pixel(ctx, -3, 3, 6, 1);
      pixel(ctx, -2, 4, 4, 1);
      pixel(ctx, -1, 5, 2, 1);
      ctx.fillStyle = COLORS.daisHi;
      pixel(ctx, -3, -4, 6, 1);
      ctx.fillStyle = COLORS.crystalB;
      pixel(ctx, -1, -1, 2, 2);
      break;
    case 'mark':
      ctx.fillStyle = COLORS.fireA;
      pixel(ctx, -4, -4, 2, 2);
      pixel(ctx, 2, -4, 2, 2);
      pixel(ctx, -2, -2, 4, 4);
      pixel(ctx, -4, 2, 2, 2);
      pixel(ctx, 2, 2, 2, 2);
      break;
  }
  ctx.restore();
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
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
