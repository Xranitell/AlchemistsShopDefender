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
  private cssToGameX = 1;
  private cssToGameY = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.attach();
  }

  private updateScale() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.cssToGameX = this.canvas.width / rect.width;
      this.cssToGameY = this.canvas.height / rect.height;
    }
  }

  private toGame(clientX: number, clientY: number): Vec2 {
    this.updateScale();
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * this.cssToGameX,
      y: (clientY - rect.top) * this.cssToGameY,
    };
  }

  private isInsideCanvas(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom
    );
  }

  private attach() {
    const c = this.canvas;
    // Listen on window so aim updates even when cursor is over HUD overlays.
    window.addEventListener('mousemove', (e) => {
      if (this.isInsideCanvas(e.clientX, e.clientY)) {
        this.state.mouse = this.toGame(e.clientX, e.clientY);
      }
    });
    c.addEventListener('mousedown', (e) => {
      this.state.mouse = this.toGame(e.clientX, e.clientY);
      this.state.mouseDown = true;
      this.state.mousePressedThisFrame = true;
    });
    window.addEventListener('mouseup', () => {
      this.state.mouseDown = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
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

    c.addEventListener('touchend', () => {
      this.state.mouseDown = false;
    });

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
