import type { MutatorDef } from '../data/mutators';
import { t, tWithFallback } from '../i18n';

/**
 * Smooth, non-intrusive announcement that the run's "dungeon law" has just
 * been re-rolled. Shown on Epic / Ancient runs after the player closes the
 * card draft, so the next wave's prep window opens with the new rules
 * already on screen for a moment.
 *
 * Animation contract (kept deliberately gentle — no bursts / yanks):
 *  - Backdrop fades in with a soft warm radial glow.
 *  - Title eases in from a few pixels below into a steady position.
 *  - Each rule line cascades in with a small delay so the eye drifts down
 *    the list rather than absorbing everything at once.
 *  - On exit, everything fades + drifts up by a couple of pixels.
 *  - The toast is non-blocking — gameplay (prep timer, etc.) keeps
 *    running underneath, and the toast auto-dismisses.
 *
 * Respects `prefers-reduced-motion`: reduces the cascade to a flat fade
 * so motion-sensitive players still see the message without movement.
 */
export class LawAnnounceOverlay {
  private root: HTMLElement;
  private current: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private removeTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** Show the announcement for the supplied mutator definitions. The
   *  toast self-dismisses after `holdMs` (default 3500ms) plus the
   *  fade-out tail. Calling `show` again replaces any in-flight toast
   *  cleanly — no stacked layers. */
  show(mutators: readonly MutatorDef[], holdMs = 3500): void {
    if (mutators.length === 0) return;
    this.hide();

    const wrap = document.createElement('div');
    wrap.className = 'law-announce';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');

    const card = document.createElement('div');
    card.className = 'law-announce-card';
    wrap.appendChild(card);

    const eyebrow = document.createElement('div');
    eyebrow.className = 'law-announce-eyebrow';
    eyebrow.textContent = tWithFallback('ui.pause.mutatorsTitle', 'Dungeon Law');
    card.appendChild(eyebrow);

    const title = document.createElement('div');
    title.className = 'law-announce-title';
    title.textContent = t('ui.lawAnnounce.title');
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'law-announce-subtitle';
    subtitle.textContent = t('ui.lawAnnounce.subtitle');
    card.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'law-announce-list';
    mutators.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'law-announce-row';
      row.style.setProperty('--row-delay', `${120 + idx * 110}ms`);
      row.style.setProperty('--accent-color', m.color);

      const icon = document.createElement('span');
      icon.className = 'law-announce-icon';
      icon.textContent = m.icon;
      row.appendChild(icon);

      const body = document.createElement('div');
      body.className = 'law-announce-body';

      const name = document.createElement('div');
      name.className = 'law-announce-name';
      name.textContent = t(m.i18nName);
      body.appendChild(name);

      const lines = document.createElement('div');
      lines.className = 'law-announce-lines';
      for (const key of m.i18nLines) {
        const li = document.createElement('div');
        li.className = 'law-announce-line';
        li.textContent = t(key);
        lines.appendChild(li);
      }
      body.appendChild(lines);

      row.appendChild(body);
      list.appendChild(row);
    });
    card.appendChild(list);

    this.root.appendChild(wrap);
    this.current = wrap;

    // Trigger CSS transitions on the next frame so the .visible class
    // produces an actual transition rather than landing in the final
    // state instantly.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrap.classList.add('visible');
      });
    });

    // Schedule a graceful fade-out. The CSS transition duration is
    // matched here so the node is removed only after it's invisible.
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.fadeOut();
    }, holdMs);
  }

  /** Force the toast off. Safe to call when nothing is showing. */
  hide(): void {
    if (this.hideTimer != null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.removeTimer != null) {
      window.clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
    if (this.current) {
      this.current.remove();
      this.current = null;
    }
  }

  private fadeOut(): void {
    const node = this.current;
    if (!node) return;
    node.classList.remove('visible');
    node.classList.add('leaving');
    this.removeTimer = window.setTimeout(() => {
      this.removeTimer = null;
      if (this.current === node) {
        node.remove();
        this.current = null;
      }
    }, 700);
  }
}
