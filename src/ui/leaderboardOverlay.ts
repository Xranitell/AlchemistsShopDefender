import { yandex, type LeaderboardEntry } from '../yandex';
import { t } from '../i18n';
import { dailyBoardId } from '../game/world';

// Three logical leaderboards exposed by the game. The technical board ids
// match what we submit in main.ts: `endlessWaves`, `bestScore`,
// `dailyWaves_YYYYMMDD` (daily resolved at fetch time via dailyBoardId()).
type BoardTab = 'endlessWaves' | 'bestScore' | 'dailyWaves';

const TABS: { id: BoardTab; labelKey: string }[] = [
  { id: 'endlessWaves', labelKey: 'ui.lb.tab.endlessWaves' },
  { id: 'bestScore', labelKey: 'ui.lb.tab.bestScore' },
  { id: 'dailyWaves', labelKey: 'ui.lb.tab.dailyWaves' },
];

/**
 * Build a leaderboard panel that can be mounted inline into any container.
 *
 * Used by the main menu where the leaderboard sits between the title and
 * the "TO BATTLE" CTA — the player sees their rank without having to open
 * a modal first. The same component is reused as a drop-in element so we
 * don't duplicate fetching / rendering logic. `topN` is configurable
 * because the embedded copy in the main menu has limited vertical space.
 */
export function buildLeaderboardPanel(opts: { topN?: number; compact?: boolean } = {}): HTMLElement {
  const topN = opts.topN ?? 10;
  const compact = opts.compact ?? false;

  const panel = document.createElement('div');
  panel.className = 'lb-panel' + (compact ? ' lb-panel-compact' : '');

  const title = document.createElement('div');
  title.className = 'lb-title';
  title.textContent = t('ui.lb.title');
  panel.appendChild(title);

  const tabBar = document.createElement('div');
  tabBar.className = 'lb-tabs';

  const body = document.createElement('div');
  body.className = 'lb-body';

  const loadTab = (tab: BoardTab) => {
    tabBar.querySelectorAll('.lb-tab').forEach((el) => el.classList.remove('active'));
    tabBar.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    body.innerHTML = `<div class="lb-loading">${t('ui.lb.loading')}</div>`;
    // Daily tab resolves to today's MSK-suffixed board id so the table
    // rolls over at 00:00 Europe/Moscow. `endlessWaves` and `bestScore`
    // are persistent across the lifetime of the game.
    const boardId = tab === 'dailyWaves' ? dailyBoardId() : tab;
    void yandex.getTopPlayers(boardId, topN).then((entries) => {
      renderEntries(body, entries);
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

  // Initial tab
  loadTab('endlessWaves');

  return panel;
}

function renderEntries(body: HTMLElement, entries: LeaderboardEntry[]): void {
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
