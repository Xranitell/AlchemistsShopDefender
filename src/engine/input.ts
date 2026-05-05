import type { Vec2 } from './math';

export interface InputState {
  mouse: Vec2;
  mouseDown: boolean;
  mousePressedThisFrame: boolean;
  keys: Set<string>;
  keysPressedThisFrame: Set<string>;
}

export class Input {
  state: InputState = {
    mouse: { x: 0, y: 0 },
    mouseDown: false,
    mousePressedThisFrame: false,
    keys: new Set(),
    keysPressedThisFrame: new Set(),
  };

  private canvas: HTMLCanvasElement;
  // Cached canvas-rect numbers. We only refresh on resize / scroll
  // instead of per pointer event — `getBoundingClientRect` forces a
  // synchronous layout each call, which on mobile can dominate the
  // `mousemove` / `touchmove` cost during dragging. The cache is
  // invalidated on every scroll / resize / orientation event.
  private rectLeft = 0;
  private rectTop = 0;
  private rectRight = 0;
  private rectBottom = 0;
  private rectDirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.attach();
  }

  private invalidateRect = (): void => {
    this.rectDirty = true;
  };

  private syncRect(): void {
    if (!this.rectDirty) return;
    const r = this.canvas.getBoundingClientRect();
    this.rectLeft = r.left;
    this.rectTop = r.top;
    this.rectRight = r.right;
    this.rectBottom = r.bottom;
    this.rectDirty = false;
  }

  /** Translate a CSS-pixel client coord into a CSS-pixel canvas-relative
   *  coord. The renderer applies an HiDPI base transform so all game/
   *  world math runs in CSS pixels — pointer events come in CSS pixels
   *  too (`clientX` / `clientY`), so a simple subtract-the-origin is the
   *  whole conversion. The previous implementation also divided by
   *  `canvas.width / rect.width`, which collapsed to 1 when the backing
   *  store matched the CSS size; with the new DPR-aware backing store
   *  that ratio is no longer 1 and the multiplication would push every
   *  hit-test off by `dpr`. */
  private toGame(clientX: number, clientY: number): Vec2 {
    this.syncRect();
    return {
      x: clientX - this.rectLeft,
      y: clientY - this.rectTop,
    };
  }

  private isInsideCanvas(clientX: number, clientY: number): boolean {
    this.syncRect();
    return (
      clientX >= this.rectLeft && clientX <= this.rectRight &&
      clientY >= this.rectTop && clientY <= this.rectBottom
    );
  }

  private attach() {
    const c = this.canvas;

    // Refresh the cached canvas rect lazily on layout-changing events.
    // We use {passive: true} so we don't accidentally block scrolling
    // when the canvas covers a scrollable region.
    window.addEventListener('resize', this.invalidateRect, { passive: true });
    window.addEventListener('scroll', this.invalidateRect, { passive: true });
    window.addEventListener('orientationchange', this.invalidateRect, { passive: true });

    // Listen on window so aim updates even when cursor is over HUD overlays.
    window.addEventListener('mousemove', (e) => {
      if (this.isInsideCanvas(e.clientX, e.clientY)) {
        this.state.mouse = this.toGame(e.clientX, e.clientY);
      }
    }, { passive: true });
    c.addEventListener('mousedown', (e) => {
      this.state.mouse = this.toGame(e.clientX, e.clientY);
      this.state.mouseDown = true;
      this.state.mousePressedThisFrame = true;
    });
    // Fallback: register press when the click hits a non-interactive HUD
    // element that overlaps the canvas (e.g. decorative panel areas).
    // Skip buttons / inputs so their own click handlers still work.
    window.addEventListener('mousedown', (e) => {
      if (e.target === c) return;
      if (!this.isInsideCanvas(e.clientX, e.clientY)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).closest?.('button')) return;
      this.state.mouse = this.toGame(e.clientX, e.clientY);
      this.state.mouseDown = true;
      this.state.mousePressedThisFrame = true;
    });
    window.addEventListener('mouseup', () => {
      this.state.mouseDown = false;
    }, { passive: true });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      this.state.mouse = this.toGame(t.clientX, t.clientY);
      this.state.mouseDown = true;
      this.state.mousePressedThisFrame = true;
    }, { passive: false });
    // Fallback for touches landing on non-interactive HUD overlays.
    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t) return;
      if (e.target === c) return;
      if (!this.isInsideCanvas(t.clientX, t.clientY)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).closest?.('button')) return;
      e.preventDefault();
      this.state.mouse = this.toGame(t.clientX, t.clientY);
      this.state.mouseDown = true;
      this.state.mousePressedThisFrame = true;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (!t) return;
      if (this.isInsideCanvas(t.clientX, t.clientY)) {
        e.preventDefault();
        this.state.mouse = this.toGame(t.clientX, t.clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.state.mouseDown = false;
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (!this.state.keys.has(e.code)) {
        this.state.keysPressedThisFrame.add(e.code);
      }
      this.state.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.state.keys.delete(e.code);
    });
  }

  endFrame() {
    this.state.mousePressedThisFrame = false;
    this.state.keysPressedThisFrame.clear();
  }
}
