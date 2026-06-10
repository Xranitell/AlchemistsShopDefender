import { t } from '../i18n';

export class InterstitialCountdownOverlay {
  private element: HTMLElement | null = null;
  private timer: number | null = null;
  private resolve: ((completed: boolean) => void) | null = null;

  show(seconds = 3): Promise<boolean> {
    this.hide(false);

    const overlay = document.createElement('div');
    overlay.className = 'interstitial-countdown-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-atomic', 'true');

    const panel = document.createElement('div');
    panel.className = 'interstitial-countdown-panel';

    const label = document.createElement('div');
    label.className = 'interstitial-countdown-label';

    const value = document.createElement('div');
    value.className = 'interstitial-countdown-value';

    const hint = document.createElement('div');
    hint.className = 'interstitial-countdown-hint';
    hint.textContent = t('ui.ads.interstitialHint');

    panel.append(label, value, hint);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this.element = overlay;

    let remaining = Math.max(1, Math.ceil(seconds));
    const render = (): void => {
      label.textContent = t('ui.ads.interstitialCountdown');
      value.textContent = String(remaining);
    };
    render();

    return new Promise<boolean>((resolve) => {
      this.resolve = resolve;
      this.timer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          this.hide(true);
          return;
        }
        render();
      }, 1000);
    });
  }

  hide(completed = false): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.element?.remove();
    this.element = null;
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(completed);
  }
}
