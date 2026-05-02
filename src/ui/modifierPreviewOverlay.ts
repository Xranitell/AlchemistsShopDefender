import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';
import { mutatorCountForDifficulty } from '../data/mutators';
import { contractCountForDifficulty } from '../data/contracts';
import { t, tWithFallback } from '../i18n';

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
    h.textContent = tWithFallback(`ui.difficulty.${opts.mode}.name`, def.name);
    header.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'mp-subtitle';
    sub.textContent = t('ui.preview.subtitle');
    header.appendChild(sub);
    panel.appendChild(header);

    // Visual stat bars
    const stats = document.createElement('div');
    stats.className = 'mp-stats';
    const mod = def.modifier;
    stats.appendChild(statBar('❤', t('ui.preview.hp'), mod.hpMult, '#ff6a3d', true));
    stats.appendChild(statBar('⚡', t('ui.preview.speed'), mod.speedMult, '#8ecae6', true));
    stats.appendChild(statBar('🗡', t('ui.preview.damage'), mod.damageMult, '#ffd166', true));
    stats.appendChild(statBar('💰', t('ui.preview.gold'), mod.goldMult, '#c084fc', false));
    panel.appendChild(stats);

    // Bullet list — human-friendly description
    const list = document.createElement('ul');
    list.className = 'mp-lines';
    for (let i = 0; i < def.previewLines.length; i++) {
      const li = document.createElement('li');
      li.textContent = tWithFallback(`ui.preview.${opts.mode}.line${i}`, def.previewLines[i]!);
      list.appendChild(li);
    }
    // Mention the random "dungeon law" mutator(s) that will roll for this
    // run — the actual roll happens at run start, so we only advertise the
    // count here, not the picks.
    const mutCount = mutatorCountForDifficulty(opts.mode);
    if (mutCount > 0) {
      const li = document.createElement('li');
      li.textContent = t(mutCount === 1 ? 'ui.mutator.previewEpic' : 'ui.mutator.previewAncient');
      li.style.color = '#7df9ff';
      list.appendChild(li);
    }
    // Mention the random side contracts (2 in Epic, 3 in Ancient).
    const contractCount = contractCountForDifficulty(opts.mode);
    if (contractCount > 0) {
      const li = document.createElement('li');
      li.textContent = t(contractCount === 2 ? 'ui.contract.previewEpic' : 'ui.contract.previewAncient');
      li.style.color = '#ffd166';
      list.appendChild(li);
    }
    panel.appendChild(list);

    // Warning ribbon
    const warn = document.createElement('div');
    warn.className = 'mp-warn';
    warn.textContent = def.keyCost === 'ancient'
      ? t('ui.preview.consumeAncient')
      : t('ui.preview.consumeEpic');
    panel.appendChild(warn);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'mp-actions';
    const cancel = document.createElement('button');
    cancel.className = 'mp-btn mp-cancel';
    cancel.textContent = t('ui.preview.cancel');
    cancel.addEventListener('click', opts.onCancel);
    actions.appendChild(cancel);
    const go = document.createElement('button');
    go.className = 'mp-btn mp-confirm';
    go.textContent = t('ui.preview.confirm');
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

function statBar(icon: string, label: string, mult: number, color: string, enemyStat: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'mp-stat';
  const iconEl = document.createElement('span');
  iconEl.className = 'mp-stat-icon';
  iconEl.textContent = icon;
  row.appendChild(iconEl);
  const value = document.createElement('span');
  value.className = 'mp-stat-value';
  value.textContent = `×${mult.toFixed(2)}`;
  if (enemyStat) {
    if (mult > 1) value.classList.add('debuff');
    else if (mult < 1) value.classList.add('buff');
  } else {
    if (mult > 1) value.classList.add('buff');
    else if (mult < 1) value.classList.add('debuff');
  }
  row.appendChild(value);
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
  return row;
}
