import { COLORS, type ColorKey } from './palette';

// Pixel-art sprites are described as a string grid. Each character maps to a
// palette key (or '.' for transparent). The grid is baked once into an
// HTMLCanvasElement at native pixel size; rendering uses ctx.imageSmoothingEnabled = false
// so they stay crisp when blitted.

export interface SpriteSpec {
  rows: string[];
  legend: Record<string, ColorKey>;
}

export interface BakedSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  // Anchor in canvas-pixels relative to the sprite's centre; defaults to the
  // sprite centre. Used so that "feet" can be aligned to entity position.
  anchor: { x: number; y: number };
}

export function bakeSprite(spec: SpriteSpec, anchor?: { x: number; y: number }): BakedSprite {
  const h = spec.rows.length;
  const w = h > 0 ? spec.rows[0]!.length : 0;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    const row = spec.rows[y]!;
    if (row.length !== w) {
      throw new Error(`Sprite row ${y} has width ${row.length}, expected ${w}`);
    }
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      if (ch === '.' || ch === ' ') continue;
      const colorKey = spec.legend[ch];
      if (!colorKey) throw new Error(`Sprite legend missing for char '${ch}'`);
      ctx.fillStyle = COLORS[colorKey];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return {
    canvas,
    width: w,
    height: h,
    anchor: anchor ?? { x: w / 2, y: h / 2 },
  };
}

// Draws a baked sprite at world position (x, y), scaled by `scale` (default 1
// = each sprite pixel is one canvas pixel). The sprite's anchor is positioned
// at (x, y).
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: BakedSprite,
  x: number,
  y: number,
  scale = 1,
): void {
  ctx.drawImage(
    sprite.canvas,
    Math.round(x - sprite.anchor.x * scale),
    Math.round(y - sprite.anchor.y * scale),
    sprite.width * scale,
    sprite.height * scale,
  );
}

// Draws a baked sprite with rotation around its anchor (used for tower barrel).
export function drawSpriteRotated(
  ctx: CanvasRenderingContext2D,
  sprite: BakedSprite,
  x: number,
  y: number,
  angle: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.drawImage(
    sprite.canvas,
    Math.round(-sprite.anchor.x * scale),
    Math.round(-sprite.anchor.y * scale),
    sprite.width * scale,
    sprite.height * scale,
  );
  ctx.restore();
}
