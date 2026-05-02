// Shared helper for rendering a baked pixel-art sprite as an inline DOM
// element, used by the HUD and every menu/overlay so the same sprites read
// identically inside the game canvas and in HTML overlays.
//
// The element is an HTMLCanvasElement (not an <img>) because canvases keep
// their pixel grid sharp under devicePixelRatio scaling without needing a
// dataURL round-trip. CSS `image-rendering: pixelated` keeps the up-scale
// crisp.

import type { BakedSprite } from './sprite';

export interface SpriteIconOptions {
  /** Integer scale factor — each sprite pixel becomes `scale` CSS pixels. */
  scale?: number;
  /** Optional extra CSS class so callers can add layout/margins. */
  extraClass?: string;
  /** Optional accessible label / tooltip. */
  title?: string;
}

/**
 * Renders a baked sprite as an HTMLCanvasElement scaled up via CSS
 * `image-rendering: pixelated`. The returned canvas can be appended directly
 * to any DOM tree.
 */
export function spriteIcon(
  sprite: BakedSprite,
  opts: SpriteIconOptions = {},
): HTMLCanvasElement {
  const scale = opts.scale ?? 2;
  const out = document.createElement('canvas');
  out.width = sprite.width;
  out.height = sprite.height;
  out.className = 'pixel-icon' + (opts.extraClass ? ' ' + opts.extraClass : '');
  const c = out.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(sprite.canvas, 0, 0);
  out.style.width = `${sprite.width * scale}px`;
  out.style.height = `${sprite.height * scale}px`;
  if (opts.title) out.title = opts.title;
  return out;
}
