import type { MetaSave } from '../game/save';
import { canClaimDaily, todayString, saveMeta } from '../game/save';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { POTION_BY_ID, POTION_INVENTORY_SIZE } from '../data/potions';
import { DAILY_REWARDS, DAILY_CYCLE, rewardLabel, rewardIcon } from '../data/dailyRewards';

export class MainMenu {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    onBattle: () => void;
    onLaboratory: () => void;
    onBattlePass: () => void;
    onDailyRewards: () => void;
    onSettings: () => void;
    onDailyExperiment: () => void;
    onBossChallenge: () => void;
    onLeaderboards: () => void;
    onCrafting: () => void;
  }): void {
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'main-menu';

    // ─── Top row: currencies + logo + settings/lang ───────────────
    const topRow = document.createElement('div');
    topRow.className = 'mm-top-row';

    const topLeft = document.createElement('div');
    topLeft.className = 'mm-top-left';
    topLeft.innerHTML = `
      <span class="mm-currency blue-essence" title="${t('ui.menu.tooltip.blueEssence')}"><span class="mm-res-icon blue-essence"></span><strong>${opts.meta.blueEssence}</strong></span>
      <span class="mm-currency ancient-essence" title="${t('ui.menu.tooltip.ancientEssence')}"><span class="mm-res-icon ancient-essence"></span><strong>${opts.meta.ancientEssence}</strong></span>
      <span class="mm-currency epic-key" title="${t('ui.menu.tooltip.epicKey')}"><span class="mm-res-icon key epic"></span><strong>${opts.meta.epicKeys}</strong></span>
      <span class="mm-currency ancient-key" title="${t('ui.menu.tooltip.ancientKey')}"><span class="mm-res-icon key ancient"></span><strong>${opts.meta.ancientKeys}</strong></span>
    `;
    topRow.appendChild(topLeft);

    // Logo / title
    const title = document.createElement('div');
    title.className = 'mm-title';
    title.innerHTML = `<span class="mm-title-top">${t('ui.menu.title.top')}</span><span class="mm-title-bottom">${t('ui.menu.title.bottom')}</span>`;
    topRow.appendChild(title);

    const topRight = document.createElement('div');
    topRight.className = 'mm-top-right';
    topRight.appendChild(buildLangSwitcher(opts.meta, () => opts.onSettings()));
    // Settings gear button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'mm-settings-gear';
    settingsBtn.type = 'button';
    settingsBtn.innerHTML = '<span class="mm-gear-icon"></span>';
    settingsBtn.title = t('ui.menu.settings');
    settingsBtn.addEventListener('click', opts.onSettings);
    topRight.appendChild(settingsBtn);
    topRow.appendChild(topRight);

    wrap.appendChild(topRow);

    // ─── Main body: left | center | right ─────────────────────────
    const body = document.createElement('div');
    body.className = 'mm-body';

    // ─ Left column: Crafting + Laboratory ─
    const leftCol = document.createElement('div');
    leftCol.className = 'mm-col mm-col-left';

    // Crafting (Зельеварка)
    const shopSection = document.createElement('button');
    shopSection.className = 'mm-card mm-shop-card';
    shopSection.type = 'button';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'mm-card-title';
    shopTitle.innerHTML = `<span class="mm-shop-icon"></span><span>${t('ui.menu.shop')}</span>`;
    shopSection.appendChild(shopTitle);
    const slotRow = document.createElement('div');
    slotRow.className = 'mm-shop-slots';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const slot = document.createElement('div');
      const id = opts.meta.inventory[i];
      const recipe = id ? POTION_BY_ID[id] : null;
      slot.className = `mm-shop-slot${recipe ? ' filled' : ''}`;
      if (recipe) {
        slot.title = t(`${recipe.i18nKey}.name`);
        slot.innerHTML = `<span class="mm-slot-potion" style="color:${recipe.color}">${recipe.glyph}</span>`;
      }
      slotRow.appendChild(slot);
    }
    shopSection.appendChild(slotRow);
    const craftHint = document.createElement('div');
    craftHint.className = 'mm-craft-level';
    craftHint.innerHTML = `<span>${t('ui.menu.craftingHint')}</span>`;
    shopSection.appendChild(craftHint);
    shopSection.addEventListener('click', opts.onCrafting);
    leftCol.appendChild(shopSection);

    // Laboratory (Лаборатория талантов)
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-card mm-lab-card';
    labBtn.type = 'button';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-card-title';
    labTitle.innerHTML = `<span class="mm-flask-icon"></span><span>${t('ui.menu.laboratory')}</span>`;
    labBtn.appendChild(labTitle);
    const labDesc = document.createElement('div');
    labDesc.className = 'mm-lab-desc';
    const hpNode = opts.meta.purchased.includes('hp_1') ? 10 : 0;
    const damageNode = opts.meta.purchased.includes('potion_damage_1') ? 5 : 0;
    labDesc.innerHTML = `
      <span class="mm-lab-tree">
        <span class="node core"></span>
        <span class="branch left"></span><span class="branch right"></span>
        <span class="node hp">HP<br>+${hpNode}%</span>
        <span class="node dmg">DMG<br>+${damageNode}%</span>
      </span>
    `;
    labBtn.appendChild(labDesc);
    labBtn.addEventListener('click', opts.onLaboratory);
    leftCol.appendChild(labBtn);

    body.appendChild(leftCol);

    // ─ Center column: Animated mannequin ─
    const centerCol = document.createElement('div');
    centerCol.className = 'mm-col mm-col-center';
    const illu = document.createElement('div');
    illu.className = 'mm-mannequin-display';
    illu.innerHTML = mannequinIllustrationSVG();
    centerCol.appendChild(illu);
    body.appendChild(centerCol);

    // ─ Right column: Leaderboard + Daily rewards calendar ─
    const rightCol = document.createElement('div');
    rightCol.className = 'mm-col mm-col-right';

    // Leaderboard
    const lbBtn = document.createElement('button');
    lbBtn.className = 'mm-card mm-lb-card';
    lbBtn.type = 'button';
    const lbTitle = document.createElement('div');
    lbTitle.className = 'mm-card-title';
    lbTitle.innerHTML = `<span class="mm-lb-icon">🏆</span><span>${t('ui.menu.leaderboards')}</span>`;
    lbBtn.appendChild(lbTitle);
    const statsRow = document.createElement('div');
    statsRow.className = 'mm-stats';
    statsRow.innerHTML = `<span>${t('ui.menu.runs', { n: opts.meta.totalRuns })}</span><span>${t('ui.menu.bestWave', { n: opts.meta.bestWave })}</span>`;
    lbBtn.appendChild(statsRow);
    lbBtn.addEventListener('click', opts.onLeaderboards);
    rightCol.appendChild(lbBtn);

    // Inline daily rewards calendar
    rightCol.appendChild(this.buildInlineDailyCalendar(opts));

    body.appendChild(rightCol);
    wrap.appendChild(body);

    // ─── Bottom row: battle button + mode buttons ─────────────────
    const bottomRow = document.createElement('div');
    bottomRow.className = 'mm-bottom-row';

    const modeBtns = document.createElement('div');
    modeBtns.className = 'mm-mode-btns';
    const dailyBtn2 = document.createElement('button');
    dailyBtn2.className = 'mm-mode-btn mm-daily-exp';
    dailyBtn2.textContent = t('ui.menu.dailyExperiment');
    dailyBtn2.addEventListener('click', opts.onDailyExperiment);
    modeBtns.appendChild(dailyBtn2);
    const bossBtn = document.createElement('button');
    bossBtn.className = 'mm-mode-btn mm-boss-challenge';
    bossBtn.textContent = t('ui.menu.bossChallenge');
    bossBtn.addEventListener('click', opts.onBossChallenge);
    modeBtns.appendChild(bossBtn);
    const bpBtn = document.createElement('button');
    bpBtn.className = 'mm-mode-btn mm-bp-mode';
    bpBtn.textContent = t('ui.menu.battlePass');
    bpBtn.addEventListener('click', opts.onBattlePass);
    modeBtns.appendChild(bpBtn);
    bottomRow.appendChild(modeBtns);

    const battleBtn = document.createElement('button');
    battleBtn.className = 'mm-battle-btn';
    battleBtn.textContent = t('ui.menu.toBattle');
    battleBtn.addEventListener('click', opts.onBattle);
    bottomRow.appendChild(battleBtn);

    wrap.appendChild(bottomRow);

    this.root.appendChild(wrap);
    this.root.classList.add('visible');
  }

  isVisible(): boolean {
    return this.root.classList.contains('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  /** Build the inline daily rewards calendar shown directly in the main menu
   *  right column. Includes the 7-day grid and a claim button. */
  private buildInlineDailyCalendar(opts: {
    meta: MetaSave;
    onDailyRewards: () => void;
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mm-card mm-daily-calendar';

    const calTitle = document.createElement('div');
    calTitle.className = 'mm-card-title';
    const weekNum = Math.floor(opts.meta.dailyDay / 7) + 1;
    calTitle.innerHTML = `<span class="mm-calendar-icon"></span><span>${t('ui.daily.title')}</span><span class="mm-daily-week-badge">${t('ui.daily.week', { n: weekNum })}</span>`;
    card.appendChild(calTitle);

    const grid = document.createElement('div');
    grid.className = 'mm-daily-grid';

    const startDay = Math.floor(opts.meta.dailyDay / 7) * 7;
    const claimable = canClaimDaily(opts.meta);

    for (let i = 0; i < 7; i++) {
      const dayIdx = startDay + i;
      const rewardDef = DAILY_REWARDS[dayIdx % DAILY_CYCLE]!;
      const cell = document.createElement('div');
      cell.className = 'mm-daily-cell';

      const claimed = dayIdx < opts.meta.dailyDay;
      const isToday = dayIdx === opts.meta.dailyDay;
      const locked = dayIdx > opts.meta.dailyDay;

      if (claimed) cell.classList.add('claimed');
      if (isToday) cell.classList.add('today');
      if (locked) cell.classList.add('locked');

      const dayLabel = document.createElement('div');
      dayLabel.className = 'mm-daily-day-label';
      dayLabel.textContent = isToday ? t('ui.daily.today') : t('ui.daily.day', { n: dayIdx + 1 });
      cell.appendChild(dayLabel);

      const icon = document.createElement('div');
      icon.className = 'mm-daily-icon';
      icon.textContent = claimed ? '✓' : rewardIcon(rewardDef.type);
      cell.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'mm-daily-reward-label';
      label.textContent = rewardLabel(rewardDef);
      cell.appendChild(label);

      grid.appendChild(cell);
    }
    card.appendChild(grid);

    // Claim button
    const claimBtn = document.createElement('button');
    claimBtn.className = 'mm-daily-claim';
    claimBtn.textContent = claimable ? t('ui.daily.claim') : t('ui.daily.claimed');
    claimBtn.disabled = !claimable;
    if (claimable) {
      claimBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dayIdx = opts.meta.dailyDay;
        const rewardDef = DAILY_REWARDS[dayIdx % DAILY_CYCLE]!;
        applyDailyReward(opts.meta, rewardDef);
        opts.meta.dailyDay += 1;
        opts.meta.dailyLastClaim = todayString();
        saveMeta(opts.meta);
        // Re-render the whole menu so currencies and calendar update
        this.show(opts as Parameters<MainMenu['show']>[0]);
      });
    }
    card.appendChild(claimBtn);

    return card;
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

/** Animated mannequin illustration for the centre of the main menu.
 *  A more polished pixel-art alchemist character on a glowing dais. */
function mannequinIllustrationSVG(): string {
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="mm-glow" cx="50%" cy="60%" r="45%">
        <stop offset="0%" stop-color="#7df9ff" stop-opacity="0.35"/>
        <stop offset="60%" stop-color="#7df9ff" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#7df9ff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mm-floor" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#454a60"/>
        <stop offset="80%" stop-color="#1a1d28"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <filter id="mm-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" />
      </filter>
    </defs>
    <!-- Background glow -->
    <ellipse cx="100" cy="155" rx="80" ry="60" fill="url(#mm-glow)" filter="url(#mm-soft)"/>
    <!-- Floor / dais -->
    <ellipse cx="100" cy="195" rx="55" ry="18" fill="url(#mm-floor)"/>
    <polygon points="60,185 100,170 140,185 100,200" fill="#454a60" stroke="#2a2c3a" stroke-width="2"/>
    <polygon points="60,185 100,200 100,208 55,192" fill="#2a2c3a"/>
    <polygon points="140,185 100,200 100,208 145,192" fill="#1a1d28"/>
    <!-- Shadow under mannequin -->
    <ellipse cx="100" cy="183" rx="22" ry="6" fill="rgba(0,0,0,0.4)"/>
    <!-- Mannequin body — warm wooden clockwork alchemist -->
    <!-- Feet -->
    <rect x="85" y="175" width="10" height="8" rx="2" fill="#c08a4a" stroke="#2a1810" stroke-width="1.5"/>
    <rect x="105" y="175" width="10" height="8" rx="2" fill="#c08a4a" stroke="#2a1810" stroke-width="1.5"/>
    <!-- Legs -->
    <rect x="87" y="160" width="8" height="17" rx="2" fill="#6a3a1a" stroke="#2a1810" stroke-width="1.5"/>
    <rect x="107" y="160" width="8" height="17" rx="2" fill="#6a3a1a" stroke="#2a1810" stroke-width="1.5"/>
    <!-- Torso -->
    <rect x="82" y="128" width="38" height="35" rx="4" fill="#9a5a2a" stroke="#2a1810" stroke-width="2"/>
    <!-- Torso detail — brass bands -->
    <rect x="84" y="136" width="34" height="3" rx="1" fill="#c9a96b"/>
    <rect x="84" y="148" width="34" height="3" rx="1" fill="#c9a96b"/>
    <!-- Core glow (cyan crystal heart) -->
    <rect x="93" y="138" width="16" height="14" rx="3" fill="#3ab3c9" stroke="#1c5a72" stroke-width="1.5"/>
    <rect x="96" y="141" width="10" height="8" rx="2" fill="#7df9ff"/>
    <rect x="99" y="143" width="4" height="4" rx="1" fill="#bdf6ff" opacity="0.8">
      <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
    </rect>
    <!-- Shoulders -->
    <rect x="72" y="128" width="14" height="12" rx="3" fill="#c9a96b" stroke="#2a1810" stroke-width="1.5"/>
    <rect x="116" y="128" width="14" height="12" rx="3" fill="#c9a96b" stroke="#2a1810" stroke-width="1.5"/>
    <!-- Arms -->
    <rect x="72" y="138" width="10" height="22" rx="3" fill="#6a3a1a" stroke="#2a1810" stroke-width="1.5"/>
    <rect x="120" y="138" width="10" height="22" rx="3" fill="#6a3a1a" stroke="#2a1810" stroke-width="1.5"/>
    <!-- Hands (brass) -->
    <circle cx="77" cy="163" r="5" fill="#c9a96b" stroke="#2a1810" stroke-width="1.5"/>
    <circle cx="125" cy="163" r="5" fill="#c9a96b" stroke="#2a1810" stroke-width="1.5"/>
    <!-- Potion in left hand -->
    <rect x="121" y="155" width="8" height="12" rx="3" fill="#4fd36a" stroke="#1f6b2a" stroke-width="1"/>
    <rect x="122" y="152" width="6" height="4" rx="1" fill="#8a5a30"/>
    <!-- Head -->
    <rect x="88" y="108" width="26" height="22" rx="5" fill="#9a5a2a" stroke="#2a1810" stroke-width="2"/>
    <!-- Face plate (iron) -->
    <rect x="91" y="112" width="20" height="14" rx="3" fill="#3a3a55"/>
    <!-- Eyes (glowing cyan) -->
    <rect x="94" y="116" width="5" height="4" rx="1" fill="#7df9ff">
      <animate attributeName="fill" values="#7df9ff;#bdf6ff;#7df9ff" dur="3s" repeatCount="indefinite"/>
    </rect>
    <rect x="103" y="116" width="5" height="4" rx="1" fill="#7df9ff">
      <animate attributeName="fill" values="#7df9ff;#bdf6ff;#7df9ff" dur="3s" repeatCount="indefinite"/>
    </rect>
    <!-- Antenna / horn -->
    <rect x="98" y="100" width="6" height="10" rx="2" fill="#3a3a55" stroke="#2a1810" stroke-width="1"/>
    <circle cx="101" cy="99" r="3" fill="#7df9ff" opacity="0.8">
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <!-- Gentle idle bob animation -->
    <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0" dur="2.5s" repeatCount="indefinite" />
  </svg>`;
}

/** RU/EN locale switcher. */
function buildLangSwitcher(meta: MetaSave, _onSettings: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mm-lang-switcher';
  wrap.title = t('ui.lang.tooltip');
  const buttons: { code: Locale; label: string }[] = [
    { code: 'ru', label: t('ui.lang.ru') },
    { code: 'en', label: t('ui.lang.en') },
  ];
  for (const { code, label } of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mm-lang-btn' + (getLocale() === code ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      if (getLocale() === code) return;
      setLocale(code);
      meta.locale = code;
      saveMeta(meta);
      window.dispatchEvent(new CustomEvent('asd-locale-changed'));
    });
    wrap.appendChild(b);
  }
  return wrap;
}
