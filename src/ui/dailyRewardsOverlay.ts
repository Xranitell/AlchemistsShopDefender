import { DAILY_REWARDS, DAILY_CYCLE, rewardLabel, rewardSprite } from '../data/dailyRewards';
import type { MetaSave } from '../game/save';
import { canClaimDaily, todayString, saveMeta } from '../game/save';
import { t } from '../i18n';
import { spriteIcon } from '../render/spriteIcon';

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
    h.textContent = t('ui.daily.title');
    header.appendChild(h);
    const weekNum = Math.floor(opts.meta.dailyDay / 7) + 1;
    const weekLabel = document.createElement('span');
    weekLabel.className = 'daily-week';
    weekLabel.textContent = t('ui.daily.week', { n: weekNum });
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
      dayLabel.textContent = isToday ? t('ui.daily.today') : t('ui.daily.day', { n: dayIdx + 1 });
      cell.appendChild(dayLabel);

      // Reward icon. Once a day is claimed we drop in a checkmark instead of
      // the icon so the cell still reads the same width.
      const icon = document.createElement('div');
      icon.className = 'daily-icon';
      if (claimed) {
        icon.textContent = '✓';
      } else {
        // Ancient-tier rewards get a CSS gold glow so the player visibly
        // sees them as the rarer prize on the calendar.
        const extraClass = rewardDef.type === 'ancient_essence' ? 'glow-gold' : undefined;
        icon.appendChild(spriteIcon(rewardSprite(rewardDef.type), { scale: 3, extraClass }));
      }
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
    claimBtn.textContent = claimable ? t('ui.daily.claim') : t('ui.daily.claimed');
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
      meta.blueEssence += reward.amount;
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
