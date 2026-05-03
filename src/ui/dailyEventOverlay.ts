// ── Daily Event Preview Overlay ─────────────────────────────────────────────
// Shown when the player taps "Daily Experiment" in the main menu. Displays
// today's MSK weekday, the rotating event's icon/name/description and bullet
// list of effects, plus a calendar strip showing the upcoming 7-day cycle so
// the player can see what's coming next. The "Start" button confirms and
// kicks off the run; cancelling returns to the main menu.

import { DAILY_EVENTS } from '../data/dailyEvents';
import { getTodayDailyEvent, moscowToday } from '../game/world';
import { t } from '../i18n';

const WEEKDAY_KEY = ['ui.weekday.sun', 'ui.weekday.mon', 'ui.weekday.tue', 'ui.weekday.wed', 'ui.weekday.thu', 'ui.weekday.fri', 'ui.weekday.sat'];

export class DailyEventOverlay {
  private root: HTMLElement;
  private visible = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { onStart: () => void; onClose: () => void }): void {
    const today = getTodayDailyEvent();
    const todayWeekday = moscowToday().weekday;

    this.visible = true;
    this.root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'dev-overlay';

    const panel = document.createElement('div');
    panel.className = 'dev-panel';
    panel.style.setProperty('--accent', today.color);

    // Header: icon + name + weekday subtitle
    const header = document.createElement('div');
    header.className = 'dev-header';
    header.innerHTML = `
      <span class="dev-icon">${today.icon}</span>
      <div class="dev-titles">
        <div class="dev-day">${t(WEEKDAY_KEY[todayWeekday]!)}</div>
        <div class="dev-name">${t(today.i18nName)}</div>
        <div class="dev-flavor">${t(today.i18nFlavor)}</div>
      </div>
    `;
    panel.appendChild(header);

    // Description paragraph
    const desc = document.createElement('div');
    desc.className = 'dev-desc';
    desc.textContent = t(today.i18nDescription);
    panel.appendChild(desc);

    // Bullet-list of effects (parallels DifficultyOverlay's previewLines)
    if (today.i18nLines.length > 0) {
      const list = document.createElement('ul');
      list.className = 'dev-lines';
      for (const key of today.i18nLines) {
        const li = document.createElement('li');
        li.textContent = t(key);
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    // Week strip — show all 7 events ordered by weekday with today highlighted
    const week = document.createElement('div');
    week.className = 'dev-week';
    const weekHeader = document.createElement('div');
    weekHeader.className = 'dev-week-title';
    weekHeader.textContent = t('ui.dailyEvent.cycle');
    week.appendChild(weekHeader);
    const grid = document.createElement('div');
    grid.className = 'dev-week-grid';
    const sorted = [...DAILY_EVENTS].sort((a, b) => weekdayOrder(a.weekday) - weekdayOrder(b.weekday));
    for (const ev of sorted) {
      const cell = document.createElement('div');
      cell.className = 'dev-week-cell' + (ev.weekday === todayWeekday ? ' today' : '');
      cell.style.setProperty('--accent', ev.color);
      cell.innerHTML = `
        <div class="dev-week-day">${t(WEEKDAY_KEY[ev.weekday]!)}</div>
        <div class="dev-week-icon">${ev.icon}</div>
        <div class="dev-week-name">${t(ev.i18nName)}</div>
      `;
      grid.appendChild(cell);
    }
    week.appendChild(grid);
    panel.appendChild(week);

    // Action row
    const actions = document.createElement('div');
    actions.className = 'dev-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dev-btn dev-cancel';
    cancelBtn.textContent = t('ui.common.cancel');
    cancelBtn.addEventListener('click', opts.onClose);
    const startBtn = document.createElement('button');
    startBtn.className = 'dev-btn dev-start';
    startBtn.textContent = t('ui.dailyEvent.start');
    startBtn.addEventListener('click', () => {
      opts.onStart();
    });
    actions.append(cancelBtn, startBtn);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    this.root.appendChild(wrap);
    this.root.classList.add('visible');
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

/** Sort weekdays starting at Monday so the strip reads Mon → Sun. */
function weekdayOrder(w: number): number {
  // 0=Sun → push to end (=7), others stay 1..6.
  return w === 0 ? 7 : w;
}
