import type { MetaSave } from '../game/save';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';
import { t, tWithFallback } from '../i18n';

export class DifficultyOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    onSelect: (mode: DifficultyMode) => void;
    onClose: () => void;
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel difficulty-panel';

    const header = document.createElement('div');
    header.className = 'difficulty-header';
    const h = document.createElement('h2');
    h.textContent = t('ui.difficulty.title');
    header.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'difficulty-subtitle';
    sub.textContent = t('ui.difficulty.subtitle');
    header.appendChild(sub);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'difficulty-grid';

    // Daily slot was previously a separate main-menu button; now it lives
    // alongside the regular difficulty modes so the player picks it from a
    // single "where do I want to fight" surface. main.ts intercepts the
    // selection and shows the event preview overlay before starting the run.
    const modes: DifficultyMode[] = ['normal', 'epic', 'ancient', 'endless', 'daily'];
    for (const modeId of modes) {
      const def = DIFFICULTY_MODES[modeId];
      const card = document.createElement('button');
      card.className = `difficulty-card difficulty-${modeId}`;
      card.style.setProperty('--dif-color', def.color);

      // Top ribbon / label
      const label = document.createElement('div');
      label.className = 'difficulty-label';
      label.textContent = t(`ui.difficulty.${modeId}.short`).toUpperCase();
      card.appendChild(label);

      // Icon / large sigil
      const iconWrap = document.createElement('div');
      iconWrap.className = 'difficulty-icon';
      iconWrap.textContent = modeIcon(modeId);
      card.appendChild(iconWrap);

      // Name
      const name = document.createElement('div');
      name.className = 'difficulty-name';
      name.textContent = tWithFallback(`ui.difficulty.${modeId}.name`, def.name);
      card.appendChild(name);

      // Flavour
      const flav = document.createElement('div');
      flav.className = 'difficulty-flavor';
      flav.textContent = tWithFallback(`ui.difficulty.${modeId}.flavor`, def.flavor);
      card.appendChild(flav);

      // Cost footer
      const cost = document.createElement('div');
      cost.className = 'difficulty-cost';
      if (def.keyCost === 'none') {
        cost.textContent = t('ui.difficulty.noKey');
      } else if (def.keyCost === 'epic') {
        cost.innerHTML = `<span>🗝️ ${t('ui.difficulty.epicKey')}</span><span class="key-count">${opts.meta.epicKeys}</span>`;
      } else {
        cost.innerHTML = `<span>🗝️ ${t('ui.difficulty.ancientKey')}</span><span class="key-count">${opts.meta.ancientKeys}</span>`;
      }
      card.appendChild(cost);

      const canStart = canStartMode(opts.meta, modeId);
      if (!canStart) {
        card.disabled = true;
        const lock = document.createElement('div');
        lock.className = 'difficulty-lock';
        lock.textContent = t('ui.difficulty.lock');
        card.appendChild(lock);
      } else {
        card.addEventListener('click', () => opts.onSelect(modeId));
      }
      grid.appendChild(card);
    }

    panel.appendChild(grid);
    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

export function canStartMode(meta: MetaSave, mode: DifficultyMode): boolean {
  if (mode === 'epic') return meta.epicKeys > 0;
  if (mode === 'ancient') return meta.ancientKeys > 0;
  return true;
}

function modeIcon(mode: DifficultyMode): string {
  switch (mode) {
    case 'normal': return '⚔';
    case 'epic': return '✦';
    case 'ancient': return '☀';
    case 'endless': return '∞';
    case 'daily': return '📅';
  }
}
