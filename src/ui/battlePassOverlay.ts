import { BP_LEVELS, BP_MAX_LEVEL, bpRewardLabel } from '../data/battlePass';
import { rewardSprite } from '../data/dailyRewards';
import type { MetaSave } from '../game/save';
import { saveMeta } from '../game/save';
import { t } from '../i18n';
import { spriteIcon } from '../render/spriteIcon';

export class BattlePassOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { meta: MetaSave; onClose: () => void }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel bp-panel';

    const header = document.createElement('div');
    header.className = 'bp-header';
    const h = document.createElement('h2');
    h.textContent = "Alchemist's Pass";
    header.appendChild(h);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Level + XP bar
    const levelInfo = document.createElement('div');
    levelInfo.className = 'bp-level-info';
    const lvText = document.createElement('span');
    lvText.textContent = t('ui.bp.level', { lvl: opts.meta.bpLevel, max: BP_MAX_LEVEL });
    levelInfo.appendChild(lvText);

    const currentLevelDef = BP_LEVELS[Math.min(opts.meta.bpLevel, BP_MAX_LEVEL - 1)]!;
    const xpNeeded = opts.meta.bpLevel < BP_MAX_LEVEL ? currentLevelDef.xpRequired : 0;
    const xpBar = document.createElement('div');
    xpBar.className = 'bp-xp-bar';
    const fill = document.createElement('div');
    fill.className = 'bp-xp-fill';
    fill.style.width = xpNeeded > 0 ? `${Math.min(100, (opts.meta.bpXp / xpNeeded) * 100)}%` : '100%';
    xpBar.appendChild(fill);
    const xpLabel = document.createElement('span');
    xpLabel.className = 'bp-xp-label';
    xpLabel.textContent = xpNeeded > 0 ? `${opts.meta.bpXp}/${xpNeeded} XP` : 'MAX';
    xpBar.appendChild(xpLabel);
    levelInfo.appendChild(xpBar);
    panel.appendChild(levelInfo);

    // Scrollable track
    const track = document.createElement('div');
    track.className = 'bp-track';

    // Level numbers row
    const numbersRow = document.createElement('div');
    numbersRow.className = 'bp-row bp-numbers';
    const numLabel = document.createElement('div');
    numLabel.className = 'bp-track-label';
    numbersRow.appendChild(numLabel);

    // Free track row
    const freeRow = document.createElement('div');
    freeRow.className = 'bp-row bp-free';
    const freeLabel = document.createElement('div');
    freeLabel.className = 'bp-track-label';
    freeLabel.textContent = t('ui.bp.free');
    freeRow.appendChild(freeLabel);

    // Premium track row
    const premiumRow = document.createElement('div');
    premiumRow.className = 'bp-row bp-premium';
    const premLabel = document.createElement('div');
    premLabel.className = 'bp-track-label premium';
    premLabel.textContent = t('ui.bp.premium');
    premiumRow.appendChild(premLabel);

    const visibleStart = Math.max(0, opts.meta.bpLevel - 2);
    const visibleEnd = Math.min(BP_MAX_LEVEL, visibleStart + 8);

    for (let i = visibleStart; i < visibleEnd; i++) {
      const def = BP_LEVELS[i]!;
      const reached = opts.meta.bpLevel > i;

      // Number cell
      const numCell = document.createElement('div');
      numCell.className = 'bp-cell bp-num-cell';
      if (reached) numCell.classList.add('reached');
      if (opts.meta.bpLevel === i) numCell.classList.add('current');
      numCell.textContent = `${def.level}`;
      numbersRow.appendChild(numCell);

      // Free reward cell — pixel icon + amount label so the player can read
      // "what" the reward is at a glance, mirroring the daily-rewards cell.
      const freeCell = document.createElement('div');
      freeCell.className = 'bp-cell';
      if (def.freeReward) {
        const claimed = opts.meta.bpClaimedFree.includes(def.level);
        if (claimed) freeCell.classList.add('claimed');
        else if (reached) freeCell.classList.add('claimable');
        else freeCell.classList.add('locked');
        if (claimed) {
          freeCell.textContent = '✓';
        } else {
          freeCell.appendChild(buildBpRewardCell(def.freeReward));
        }
        if (reached && !claimed && def.freeReward) {
          freeCell.addEventListener('click', () => {
            claimBpReward(opts.meta, def.level, 'free');
            this.show(opts);
          });
        }
      } else {
        freeCell.classList.add('empty');
        freeCell.textContent = '—';
      }
      freeRow.appendChild(freeCell);

      // Premium reward cell — same layout as the free row; the cell's CSS
      // class signals "premium" so it can be tinted gold.
      const premCell = document.createElement('div');
      premCell.className = 'bp-cell';
      if (def.premiumReward) {
        const claimed = opts.meta.bpClaimedPremium.includes(def.level);
        if (!opts.meta.bpPremium) premCell.classList.add('locked');
        else if (claimed) premCell.classList.add('claimed');
        else if (reached) premCell.classList.add('claimable');
        else premCell.classList.add('locked');
        if (claimed) {
          premCell.textContent = '✓';
        } else {
          premCell.appendChild(buildBpRewardCell(def.premiumReward));
        }
        if (reached && !claimed && opts.meta.bpPremium && def.premiumReward) {
          premCell.addEventListener('click', () => {
            claimBpReward(opts.meta, def.level, 'premium');
            this.show(opts);
          });
        }
      } else {
        premCell.classList.add('empty');
        premCell.textContent = '—';
      }
      premiumRow.appendChild(premCell);
    }

    track.appendChild(numbersRow);
    track.appendChild(freeRow);
    track.appendChild(premiumRow);
    panel.appendChild(track);

    // Claim all button
    const actions = document.createElement('div');
    actions.className = 'bp-actions';

    const claimAllBtn = document.createElement('button');
    claimAllBtn.className = 'bp-claim-all';
    claimAllBtn.textContent = t('ui.bp.claimAll');
    const hasUnclaimed = hasAnyUnclaimedRewards(opts.meta);
    claimAllBtn.disabled = !hasUnclaimed;
    if (hasUnclaimed) {
      claimAllBtn.addEventListener('click', () => {
        claimAllRewards(opts.meta);
        this.show(opts);
      });
    }
    actions.appendChild(claimAllBtn);
    panel.appendChild(actions);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

/** Builds a `[pixel-icon][amount label]` cell used for both free and
 *  premium rewards. Centralised so the two columns stay visually identical
 *  with the daily-rewards calendar. */
function buildBpRewardCell(reward: { type: 'gold' | 'blue_essence' | 'ancient_essence' | 'keys'; amount: number }): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'bp-reward';
  // Ancient-essence rewards glow gold; the rest stay flat.
  const extraClass = reward.type === 'ancient_essence' ? 'glow-gold' : undefined;
  wrap.appendChild(spriteIcon(rewardSprite(reward.type), { scale: 2, extraClass }));
  const lab = document.createElement('span');
  lab.className = 'bp-reward-amt';
  lab.textContent = bpRewardLabel(reward);
  wrap.appendChild(lab);
  return wrap;
}

function claimBpReward(meta: MetaSave, level: number, track: 'free' | 'premium'): void {
  const def = BP_LEVELS[level - 1]!;
  const reward = track === 'free' ? def.freeReward : def.premiumReward;
  if (!reward) return;
  const list = track === 'free' ? meta.bpClaimedFree : meta.bpClaimedPremium;
  if (list.includes(level)) return;
  if (meta.bpLevel < level) return;
  if (track === 'premium' && !meta.bpPremium) return;

  applyBpReward(meta, reward);
  list.push(level);
  saveMeta(meta);
}

function applyBpReward(meta: MetaSave, reward: { type: string; amount: number }): void {
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
  }
}

function hasAnyUnclaimedRewards(meta: MetaSave): boolean {
  for (let i = 0; i < meta.bpLevel && i < BP_MAX_LEVEL; i++) {
    const def = BP_LEVELS[i]!;
    if (def.freeReward && !meta.bpClaimedFree.includes(def.level)) return true;
    if (meta.bpPremium && def.premiumReward && !meta.bpClaimedPremium.includes(def.level)) return true;
  }
  return false;
}

function claimAllRewards(meta: MetaSave): void {
  for (let i = 0; i < meta.bpLevel && i < BP_MAX_LEVEL; i++) {
    const def = BP_LEVELS[i]!;
    if (def.freeReward && !meta.bpClaimedFree.includes(def.level)) {
      applyBpReward(meta, def.freeReward);
      meta.bpClaimedFree.push(def.level);
    }
    if (meta.bpPremium && def.premiumReward && !meta.bpClaimedPremium.includes(def.level)) {
      applyBpReward(meta, def.premiumReward);
      meta.bpClaimedPremium.push(def.level);
    }
  }
  saveMeta(meta);
}

export function addBpXp(meta: MetaSave, xp: number): void {
  if (meta.bpLevel >= BP_MAX_LEVEL) return;
  meta.bpXp += xp;
  while (meta.bpLevel < BP_MAX_LEVEL) {
    const needed = BP_LEVELS[meta.bpLevel]!.xpRequired;
    if (meta.bpXp >= needed) {
      meta.bpXp -= needed;
      meta.bpLevel += 1;
    } else {
      break;
    }
  }
}
