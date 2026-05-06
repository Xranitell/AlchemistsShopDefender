import { yandex, type LeaderboardEntry } from '../yandex';
import { t } from '../i18n';
import { dailyBoardId } from '../game/world';

// Two leaderboards exposed by the game. The technical board ids match
// what we submit in main.ts: `endlessWaves` (any-mode best wave) and
// `dailyWaves` (permanent daily-event board, resolved at fetch time via
// dailyBoardId()).
type BoardTab = 'endlessWaves' | 'dailyWaves';

const TABS: { id: BoardTab; labelKey: string }[] = [
  { id: 'endlessWaves', labelKey: 'ui.lb.tab.endlessWaves' },
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

  // Sign-in CTA. Only rendered when the SDK reports the player as
  // unauthenticated ('lite' guest mode) — Yandex rejects leaderboard
  // writes from those players, so showing them an empty board with
  // no explanation looks like the feature is broken. A button gives
  // the player the auth dialog with a clear user gesture.
  const authPrompt = document.createElement('div');
  authPrompt.className = 'lb-auth-prompt';

  const updateAuthPrompt = (): void => {
    if (yandex.isAuthorized()) {
      authPrompt.style.display = 'none';
      authPrompt.innerHTML = '';
      return;
    }
    authPrompt.style.display = '';
    authPrompt.innerHTML = '';
    const text = document.createElement('div');
    text.className = 'lb-auth-text';
    text.textContent = t('ui.lb.signInPrompt');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lb-auth-btn';
    btn.textContent = t('ui.lb.signInBtn');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      void yandex.signIn().then(() => {
        // Refresh the currently-active tab so the player's freshly-
        // submitted score (if a previous run was already finished) shows
        // up immediately.
        const active = tabBar.querySelector<HTMLElement>('.lb-tab.active')?.dataset.tab as BoardTab | undefined;
        if (active) loadTab(active);
      }).catch(() => {
        btn.disabled = false;
      });
    });
    authPrompt.appendChild(text);
    authPrompt.appendChild(btn);
  };

  const loadTab = (tab: BoardTab) => {
    tabBar.querySelectorAll('.lb-tab').forEach((el) => el.classList.remove('active'));
    tabBar.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    body.innerHTML = `<div class="lb-loading">${t('ui.lb.loading')}</div>`;
    // Daily tab resolves through dailyBoardId() so we always read the
    // same permanent board name across the lifetime of the game.
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
  panel.appendChild(authPrompt);
  panel.appendChild(body);

  // Diagnostics fold-out: renders the leaderboard probe results +
  // last few submit attempts so a designer (or curious player) can
  // tell at a glance whether scores are actually reaching Yandex.
  // Hidden behind a `<details>` so it doesn't clutter the menu in
  // the common case. The component subscribes to diag changes from
  // the yandex wrapper and re-renders whenever a new submit lands.
  const diag = buildDiagnosticsBlock();
  panel.appendChild(diag);

  // Auth state is async — when SDK init resolves later, refresh the prompt.
  updateAuthPrompt();
  yandex.onAuthChange(() => updateAuthPrompt());

  // Initial tab
  loadTab('endlessWaves');

  return panel;
}

/** Collapsed-by-default diagnostics block shown at the bottom of the
 *  leaderboard panel. Renders three sections:
 *    1. SDK status: reachable / authorized / player mode (`'lite'`
 *       vs signed-in).
 *    2. Probe results: per-board outcome of the init-time
 *       `getLeaderboardDescription` call. A board listed as "FAIL"
 *       here means it isn't registered in Yandex Console — every
 *       submit will silently fail.
 *    3. Last submits: rolling tail of `setLeaderboardScore` attempts
 *       with status (sent / skipped / failed / mock) and any error.
 *
 *  Subscribes to `yandex.onDiagnosticsChange` so the table refreshes
 *  live as the player clears waves and submits land. */
function buildDiagnosticsBlock(): HTMLElement {
  const wrap = document.createElement('details');
  wrap.className = 'lb-diag';

  const summary = document.createElement('summary');
  summary.className = 'lb-diag-summary';
  summary.textContent = t('ui.lb.diag.title');
  wrap.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'lb-diag-body';
  wrap.appendChild(body);

  const render = (): void => {
    const d = yandex.getLeaderboardDiagnostics();
    body.innerHTML = '';

    // ── SDK status row ────────────────────────────────────────────
    const status = document.createElement('div');
    status.className = 'lb-diag-status';
    const items: string[] = [];
    items.push(`SDK: ${d.sdkReachable ? 'ok' : 'stub'}`);
    items.push(`auth: ${d.authorized ? 'yes' : 'no'}`);
    if (d.playerMode) items.push(`mode: ${d.playerMode}`);
    status.textContent = items.join(' · ');
    body.appendChild(status);

    // ── Probes section ────────────────────────────────────────────
    if (d.probes.length > 0) {
      const probeHead = document.createElement('div');
      probeHead.className = 'lb-diag-section-title';
      probeHead.textContent = t('ui.lb.diag.probes');
      body.appendChild(probeHead);

      for (const p of d.probes) {
        const row = document.createElement('div');
        row.className = `lb-diag-probe ${p.ok ? 'ok' : 'fail'}`;
        const id = document.createElement('span');
        id.className = 'lb-diag-board';
        id.textContent = p.boardId;
        row.appendChild(id);
        const verdict = document.createElement('span');
        verdict.className = 'lb-diag-verdict';
        verdict.textContent = p.ok ? 'ok' : 'FAIL';
        row.appendChild(verdict);
        if (!p.ok && p.error) {
          const err = document.createElement('span');
          err.className = 'lb-diag-err';
          err.textContent = p.error;
          row.appendChild(err);
        } else if (p.ok && p.title) {
          const title = document.createElement('span');
          title.className = 'lb-diag-board-title';
          title.textContent = p.title;
          row.appendChild(title);
        }
        body.appendChild(row);
      }
    }

    // ── Submits section ───────────────────────────────────────────
    const submitHead = document.createElement('div');
    submitHead.className = 'lb-diag-section-title';
    submitHead.textContent = t('ui.lb.diag.submits');
    body.appendChild(submitHead);

    if (d.submits.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-diag-empty';
      empty.textContent = t('ui.lb.diag.noSubmits');
      body.appendChild(empty);
    } else {
      for (const s of d.submits.slice(0, 8)) {
        const row = document.createElement('div');
        row.className = `lb-diag-submit status-${s.status}`;
        const time = document.createElement('span');
        time.className = 'lb-diag-time';
        time.textContent = formatLogTime(s.ts);
        row.appendChild(time);
        const id = document.createElement('span');
        id.className = 'lb-diag-board';
        id.textContent = s.boardId;
        row.appendChild(id);
        const score = document.createElement('span');
        score.className = 'lb-diag-score';
        score.textContent = String(s.score);
        row.appendChild(score);
        const verdict = document.createElement('span');
        verdict.className = 'lb-diag-verdict';
        verdict.textContent = s.status;
        row.appendChild(verdict);
        if (s.error) {
          const err = document.createElement('span');
          err.className = 'lb-diag-err';
          err.textContent = s.error;
          row.appendChild(err);
        }
        body.appendChild(row);
      }
    }
  };

  render();
  yandex.onDiagnosticsChange(render);

  return wrap;
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
