export type LoopCallback = (deltaSeconds: number) => void;

export class Loop {
  private last = 0;
  private running = false;
  private rafId = 0;
  private cb: LoopCallback;
  private maxDelta = 1 / 30; // clamp dt to avoid spiral of death

  constructor(cb: LoopCallback) {
    this.cb = cb;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private tick = () => {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    if (dt > this.maxDelta) dt = this.maxDelta;
    this.last = now;
    this.cb(dt);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
