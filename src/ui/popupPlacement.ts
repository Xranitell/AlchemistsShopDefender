/**
 * Position a floating popup (e.g. the tower-shop / mannequin-shop) anchored
 * to a world-screen point so it stays fully inside the viewport.
 *
 * On a desktop monitor the popup just appears 24px to the right and 20px
 * above the rune, exactly like before. On a landscape mobile screen
 * (e.g. 2400×1080 → ~410 CSS px tall) the same hard-coded offset would
 * push the popup partially or fully off the bottom edge — so this helper
 * mirrors the popup to the left of the anchor when it doesn't fit on the
 * right, and clamps the vertical edge to the viewport.
 *
 * Call this AFTER the popup has been appended to the DOM and its content
 * has been built, otherwise the layout pass returns 0 dimensions.
 */
export function placePopupNearAnchor(
  el: HTMLElement,
  anchor: { x: number; y: number },
  options: { rightOffset?: number; topOffset?: number; margin?: number } = {},
): void {
  const rightOffset = options.rightOffset ?? 24;
  const topOffset = options.topOffset ?? -20;
  const margin = options.margin ?? 8;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Measure first so we can flip / clamp based on the real popup size.
  const rect = el.getBoundingClientRect();
  const popupW = rect.width;
  const popupH = rect.height;

  // Default: place to the right of the anchor.
  let left = anchor.x + rightOffset;
  let top = anchor.y + topOffset;

  // Flip horizontally if the popup would clip the right edge.
  if (left + popupW + margin > vw) {
    const flippedLeft = anchor.x - rightOffset - popupW;
    if (flippedLeft >= margin) {
      left = flippedLeft;
    } else {
      // Neither side fits — anchor to the right edge with margin.
      left = Math.max(margin, vw - popupW - margin);
    }
  }
  if (left < margin) left = margin;

  // Vertical clamp — keep the popup fully inside the viewport.
  if (top + popupH + margin > vh) {
    top = vh - popupH - margin;
  }
  if (top < margin) top = margin;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
