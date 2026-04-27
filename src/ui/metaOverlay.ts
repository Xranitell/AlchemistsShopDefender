import { META_UPGRADES, branchName, type MetaBranch, type MetaUpgrade } from '../data/metaTree';
import type { MetaSave } from '../game/save';

const BRANCHES: MetaBranch[] = ['potions', 'engineering', 'core', 'survival'];

const BRANCH_COLORS: Record<MetaBranch, string> = {
  potions: '#ff8c3a',
  engineering: '#7df9ff',
  core: '#c084fc',
  survival: '#a3e36a',
};

export class MetaOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    onBuy: (upgrade: MetaUpgrade) => boolean;
    onStart: () => void;
    onReset?: () => void;
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel meta-panel';

    const h = document.createElement('h2');
    h.textContent = 'Дерево Манекена';
    panel.appendChild(h);

    const currencies = document.createElement('div');
    currencies.className = 'meta-currencies';
    currencies.innerHTML = `
      <span class="meta-currency blue">Синяя Эссенция: <strong>${opts.meta.blueEssence}</strong></span>
      <span class="meta-currency ancient">Древняя Эссенция: <strong>${opts.meta.ancientEssence}</strong></span>
    `;
    panel.appendChild(currencies);

    const stats = document.createElement('div');
    stats.className = 'meta-stats';
    stats.textContent = `Забегов: ${opts.meta.totalRuns} | Лучшая волна: ${opts.meta.bestWave}`;
    panel.appendChild(stats);

    const grid = document.createElement('div');
    grid.className = 'meta-branches';

    for (const branch of BRANCHES) {
      const col = document.createElement('div');
      col.className = 'meta-branch';

      const title = document.createElement('div');
      title.className = 'meta-branch-title';
      title.style.color = BRANCH_COLORS[branch];
      title.textContent = branchName(branch);
      col.appendChild(title);

      const upgrades = META_UPGRADES.filter((u) => u.branch === branch);
      for (const upg of upgrades) {
        const owned = opts.meta.purchased.includes(upg.id);
        const canAfford = upg.currency === 'blue'
          ? opts.meta.blueEssence >= upg.cost
          : opts.meta.ancientEssence >= upg.cost;
        const prereqMet = !upg.requires || opts.meta.purchased.includes(upg.requires);
        const available = !owned && canAfford && prereqMet;
        const locked = !owned && !prereqMet;

        const btn = document.createElement('button');
        btn.className = 'meta-upgrade';
        if (owned) btn.classList.add('owned');
        if (locked) btn.classList.add('locked');
        if (available) btn.classList.add('available');

        const nameEl = document.createElement('div');
        nameEl.className = 'meta-upgrade-name';
        nameEl.textContent = owned ? `${upg.name}` : upg.name;
        btn.appendChild(nameEl);

        const descEl = document.createElement('div');
        descEl.className = 'meta-upgrade-desc';
        descEl.textContent = upg.desc;
        btn.appendChild(descEl);

        if (!owned) {
          const costEl = document.createElement('div');
          costEl.className = `meta-upgrade-cost ${upg.currency}`;
          costEl.textContent = `${upg.cost} ${upg.currency === 'blue' ? 'СЭ' : 'ДЭ'}`;
          btn.appendChild(costEl);
        }

        btn.disabled = !available;
        if (available) {
          btn.addEventListener('click', () => {
            const ok = opts.onBuy(upg);
            if (ok) this.show(opts);
          });
        }

        col.appendChild(btn);
      }

      grid.appendChild(col);
    }

    panel.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'meta-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'meta-start';
    startBtn.textContent = 'Начать забег';
    startBtn.addEventListener('click', opts.onStart);
    actions.appendChild(startBtn);

    if (opts.onReset) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'meta-reset';
      resetBtn.textContent = 'Сбросить прогресс';
      resetBtn.addEventListener('click', () => {
        if (confirm('Сбросить весь мета-прогресс?')) {
          opts.onReset!();
        }
      });
      actions.appendChild(resetBtn);
    }

    panel.appendChild(actions);
    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}
