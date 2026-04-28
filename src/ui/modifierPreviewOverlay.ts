import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';

export class ModifierPreviewOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    mode: DifficultyMode;
    onConfirm: () => void;
    onCancel: () => void;
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel modifier-preview-panel';
    panel.style.setProperty('--dif-color', DIFFICULTY_MODES[opts.mode].color);

    const def = DIFFICULTY_MODES[opts.mode];

    const header = document.createElement('div');
    header.className = 'mp-header';
    const h = document.createElement('h2');
    h.textContent = def.name;
    header.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'mp-subtitle';
    sub.textContent = 'Враги получат следующие модификаторы:';
    header.appendChild(sub);
    panel.appendChild(header);

    // Visual stat bars
    const stats = document.createElement('div');
    stats.className = 'mp-stats';
    const mod = def.modifier;
    stats.appendChild(statBar('❤', 'Здоровье', mod.hpMult, '#ff6a3d'));
    stats.appendChild(statBar('⚡', 'Скорость', mod.speedMult, '#8ecae6'));
    stats.appendChild(statBar('🗡', 'Урон', mod.damageMult, '#ffd166'));
    stats.appendChild(statBar('💰', 'Золото', mod.goldMult, '#c084fc'));
    panel.appendChild(stats);

    // Bullet list — human-friendly description
    const list = document.createElement('ul');
    list.className = 'mp-lines';
    for (const line of def.previewLines) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    panel.appendChild(list);

    // Warning ribbon
    const warn = document.createElement('div');
    warn.className = 'mp-warn';
    warn.textContent = def.keyCost === 'ancient'
      ? 'Подтверждая, ты тратишь 1 Древний ключ.'
      : 'Подтверждая, ты тратишь 1 Эпический ключ.';
    panel.appendChild(warn);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'mp-actions';
    const cancel = document.createElement('button');
    cancel.className = 'mp-btn mp-cancel';
    cancel.textContent = 'Отмена';
    cancel.addEventListener('click', opts.onCancel);
    actions.appendChild(cancel);
    const go = document.createElement('button');
    go.className = 'mp-btn mp-confirm';
    go.textContent = 'В бой!';
    go.addEventListener('click', opts.onConfirm);
    actions.appendChild(go);
    panel.appendChild(actions);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

function statBar(icon: string, label: string, mult: number, color: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'mp-stat';
  const iconEl = document.createElement('span');
  iconEl.className = 'mp-stat-icon';
  iconEl.textContent = icon;
  row.appendChild(iconEl);
  const labelEl = document.createElement('span');
  labelEl.className = 'mp-stat-label';
  labelEl.textContent = label;
  row.appendChild(labelEl);
  const barWrap = document.createElement('div');
  barWrap.className = 'mp-stat-bar';
  // Baseline fills 50% at mult=1; grows to 100% at mult≈2.
  const pct = Math.min(100, (mult - 0) * 50);
  const fill = document.createElement('div');
  fill.className = 'mp-stat-fill';
  fill.style.width = `${pct}%`;
  fill.style.background = color;
  barWrap.appendChild(fill);
  // Baseline marker at 50%
  const mark = document.createElement('div');
  mark.className = 'mp-stat-mark';
  barWrap.appendChild(mark);
  row.appendChild(barWrap);
  const value = document.createElement('span');
  value.className = 'mp-stat-value';
  value.textContent = `×${mult.toFixed(2)}`;
  if (mult > 1) value.classList.add('up');
  else if (mult < 1) value.classList.add('down');
  row.appendChild(value);
  return row;
}
