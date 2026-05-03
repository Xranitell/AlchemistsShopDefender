export type LoopCallback = (deltaSeconds: number) => void;

/** Game loop driven by `requestAnimationFrame`.
 *
 *  The loop tracks document visibility — when the tab is hidden we
 *  cancel the pending animation frame entirely instead of relying on
 *  the browser's implicit rAF throttling. Two reasons:
 *    1. On mobile some browsers still tick a backgrounded tab at full
 *       rate when there's an active AudioContext (the music engine
 *       holds one), which drains battery and starves a foreground tab.
 *    2. We want the loop itself to record `last = performance.now()`
 *       at resume time, otherwise the first re-foregrounded frame
 *       would compute a multi-second `dt` and the clamp at the top of
 *       `tick` would still let through one giant tick.
 *
 *  The visibility listener is bound once in `start()` and removed in
 *  `stop()`. */
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
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (!document.hidden) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (!this.running) return;
    if (document.hidden) {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    } else {
      // Reset the timestamp so the first resumed frame uses a fresh `dt`
      // instead of accumulating the entire hidden interval.
      this.last = performance.now();
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(this.tick);
      }
    }
  };

  private tick = () => {
    this.rafId = 0;
    if (!this.running) return;
    if (document.hidden) {
      // Defensive: if rAF still fires while hidden (some browsers fire
      // one trailing frame), drop it without ticking.
      return;
    }
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    if (dt > this.maxDelta) dt = this.maxDelta;
    this.last = now;
    this.cb(dt);
    if (this.running && !document.hidden) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };
}
