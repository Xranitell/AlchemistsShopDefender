import type { MetaSave } from '../game/save';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';

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
    h.textContent = 'Выбери подземелье';
    header.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'difficulty-subtitle';
    sub.textContent = 'Выше сложность — больше ключей и золота, но враги сильнее.';
    header.appendChild(sub);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'difficulty-grid';

    const modes: DifficultyMode[] = ['normal', 'epic', 'ancient', 'endless'];
    for (const modeId of modes) {
      const def = DIFFICULTY_MODES[modeId];
      const card = document.createElement('button');
      card.className = `difficulty-card difficulty-${modeId}`;
      card.style.setProperty('--dif-color', def.color);

      // Top ribbon / label
      const label = document.createElement('div');
      label.className = 'difficulty-label';
      label.textContent = def.shortName.toUpperCase();
      card.appendChild(label);

      // Icon / large sigil
      const iconWrap = document.createElement('div');
      iconWrap.className = 'difficulty-icon';
      iconWrap.textContent = modeIcon(modeId);
      card.appendChild(iconWrap);

      // Name
      const name = document.createElement('div');
      name.className = 'difficulty-name';
      name.textContent = def.name;
      card.appendChild(name);

      // Flavour
      const flav = document.createElement('div');
      flav.className = 'difficulty-flavor';
      flav.textContent = def.flavor;
      card.appendChild(flav);

      // Cost footer
      const cost = document.createElement('div');
      cost.className = 'difficulty-cost';
      if (def.keyCost === 'none') {
        cost.textContent = 'Без ключа';
      } else if (def.keyCost === 'epic') {
        cost.innerHTML = `<span>🗝️ Эпический ключ</span><span class="key-count">${opts.meta.epicKeys}</span>`;
      } else {
        cost.innerHTML = `<span>🗝️ Древний ключ</span><span class="key-count">${opts.meta.ancientKeys}</span>`;
      }
      card.appendChild(cost);

      const canStart = canStartMode(opts.meta, modeId);
      if (!canStart) {
        card.disabled = true;
        const lock = document.createElement('div');
        lock.className = 'difficulty-lock';
        lock.textContent = 'Нужен ключ';
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
  }
}
