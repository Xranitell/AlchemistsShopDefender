import { DAILY_REWARDS, DAILY_CYCLE, rewardLabel, rewardIcon } from '../data/dailyRewards';
import type { MetaSave } from '../game/save';
import { canClaimDaily, todayString, saveMeta } from '../game/save';

export class DailyRewardsOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { meta: MetaSave; onClose: () => void }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel daily-panel';

    const header = document.createElement('div');
    header.className = 'daily-header';
    const h = document.createElement('h2');
    h.textContent = 'Ежедневные награды';
    header.appendChild(h);
    const weekNum = Math.floor(opts.meta.dailyDay / 7) + 1;
    const weekLabel = document.createElement('span');
    weekLabel.className = 'daily-week';
    weekLabel.textContent = `Неделя ${weekNum}`;
    header.appendChild(weekLabel);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'daily-grid';

    const startDay = Math.floor(opts.meta.dailyDay / 7) * 7;
    const claimable = canClaimDaily(opts.meta);

    for (let i = 0; i < 7; i++) {
      const dayIdx = startDay + i;
      const rewardDef = DAILY_REWARDS[dayIdx % DAILY_CYCLE]!;
      const cell = document.createElement('div');
      cell.className = 'daily-cell';

      const claimed = dayIdx < opts.meta.dailyDay;
      const isToday = dayIdx === opts.meta.dailyDay;
      const locked = dayIdx > opts.meta.dailyDay;

      if (claimed) cell.classList.add('claimed');
      if (isToday) cell.classList.add('today');
      if (locked) cell.classList.add('locked');

      const dayLabel = document.createElement('div');
      dayLabel.className = 'daily-day-label';
      dayLabel.textContent = isToday ? 'Сегодня' : `День ${dayIdx + 1}`;
      cell.appendChild(dayLabel);

      const icon = document.createElement('div');
      icon.className = 'daily-icon';
      icon.textContent = claimed ? '✓' : rewardIcon(rewardDef.type);
      cell.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'daily-reward-label';
      label.textContent = rewardLabel(rewardDef);
      cell.appendChild(label);

      grid.appendChild(cell);
    }

    panel.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'daily-actions';

    const claimBtn = document.createElement('button');
    claimBtn.className = 'daily-claim-btn';
    claimBtn.textContent = claimable ? 'Забрать' : 'Уже получено';
    claimBtn.disabled = !claimable;
    if (claimable) {
      claimBtn.addEventListener('click', () => {
        const dayIdx = opts.meta.dailyDay;
        const rewardDef = DAILY_REWARDS[dayIdx % DAILY_CYCLE]!;
        applyDailyReward(opts.meta, rewardDef);
        opts.meta.dailyDay += 1;
        opts.meta.dailyLastClaim = todayString();
        saveMeta(opts.meta);
        this.show(opts);
      });
    }
    actions.appendChild(claimBtn);
    panel.appendChild(actions);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

function applyDailyReward(meta: MetaSave, reward: { type: string; amount: number }): void {
  switch (reward.type) {
    case 'gold':
      meta.blueEssence += Math.round(reward.amount / 10);
      break;
    case 'blue_essence':
      meta.blueEssence += reward.amount;
      break;
    case 'ancient_essence':
      meta.ancientEssence += reward.amount;
      break;
    case 'keys':
      meta.keys += reward.amount;
      break;
    case 'rerolls':
      meta.bonusRerolls += reward.amount;
      break;
  }
}
