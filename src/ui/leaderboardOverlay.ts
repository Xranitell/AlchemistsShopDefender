import { yandex, type LeaderboardEntry } from '../yandex';
import { t } from '../i18n';
import { dailyBoardId } from '../game/world';

type BoardTab = 'best_wave' | 'daily' | 'boss_challenge';

const TABS: { id: BoardTab; labelKey: string }[] = [
  { id: 'best_wave', labelKey: 'ui.lb.tab.bestWave' },
  { id: 'daily', labelKey: 'ui.lb.tab.daily' },
  { id: 'boss_challenge', labelKey: 'ui.lb.tab.bossChallenge' },
];

export class LeaderboardOverlay {
  private root: HTMLElement;
  private visible = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { onClose: () => void }): void {
    this.visible = true;
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'lb-overlay';

    const panel = document.createElement('div');
    panel.className = 'lb-panel';

    const title = document.createElement('div');
    title.className = 'lb-title';
    title.textContent = t('ui.lb.title');
    panel.appendChild(title);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'lb-tabs';

    const body = document.createElement('div');
    body.className = 'lb-body';

    const loadTab = (tab: BoardTab) => {
      tabBar.querySelectorAll('.lb-tab').forEach((el) => el.classList.remove('active'));
      tabBar.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
      body.innerHTML = `<div class="lb-loading">${t('ui.lb.loading')}</div>`;
      const boardId = tab === 'daily' ? dailyBoardId() : tab;
      void yandex.getTopPlayers(boardId, 10).then((entries) => {
        this.renderEntries(body, entries);
      });
    };

    for (const def of TABS) {
      const btn = document.createElement('button');
      btn.className = 'lb-tab';
      btn.dataset.tab = def.id;
      btn.textContent = t(def.labelKey);
      btn.addEventListener('click', () => loadTab(def.id));
      tabBar.appendChild(btn);
    }

    panel.appendChild(tabBar);
    panel.appendChild(body);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lb-close';
    closeBtn.textContent = t('ui.common.close');
    closeBtn.addEventListener('click', opts.onClose);
    panel.appendChild(closeBtn);

    wrap.appendChild(panel);
    this.root.appendChild(wrap);
    this.root.classList.add('visible');

    // Load first tab
    loadTab('best_wave');
  }

  private renderEntries(body: HTMLElement, entries: LeaderboardEntry[]): void {
    body.innerHTML = '';
    if (entries.length === 0) {
      body.innerHTML = `<div class="lb-empty">${t('ui.lb.empty')}</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'lb-list';
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'lb-row';

      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = `#${entry.rank}`;

      const avatar = document.createElement('span');
      avatar.className = 'lb-avatar';
      if (entry.avatarUrl) {
        const img = document.createElement('img');
        img.src = entry.avatarUrl;
        img.width = 28;
        img.height = 28;
        avatar.appendChild(img);
      }

      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = entry.name;

      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = String(entry.score);

      row.append(rank, avatar, name, score);
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  isVisible(): boolean {
    return this.visible;
  }
}
