import type { MetaSave } from '../game/save';
import { canClaimDaily, todayString, saveMeta } from '../game/save';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { POTION_BY_ID, POTION_INVENTORY_SIZE } from '../data/potions';
import { DAILY_REWARDS, DAILY_CYCLE, rewardLabel, rewardSprite } from '../data/dailyRewards';
import { buildLeaderboardPanel } from './leaderboardOverlay';
import { getSprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';
import { masteryEssenceMult } from '../game/meta';

export class MainMenu {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    onBattle: () => void;
    onLaboratory: () => void;
    onDailyRewards: () => void;
    onSettings: () => void;
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
    const sprites = getSprites();
    topLeft.appendChild(buildCurrencyChip(
      'blue-essence',
      spriteIcon(sprites.iconBlueEssence, { scale: 2 }),
      opts.meta.blueEssence,
      t('ui.menu.tooltip.blueEssence'),
    ));
    topLeft.appendChild(buildCurrencyChip(
      'ancient-essence',
      spriteIcon(sprites.iconAncientEssence, { scale: 2, extraClass: 'glow-gold' }),
      opts.meta.ancientEssence,
      t('ui.menu.tooltip.ancientEssence'),
    ));
    topLeft.appendChild(buildCurrencyChip(
      'epic-key',
      spriteIcon(sprites.iconEpicKey, { scale: 2 }),
      opts.meta.epicKeys,
      t('ui.menu.tooltip.epicKey'),
    ));
    topLeft.appendChild(buildCurrencyChip(
      'ancient-key',
      spriteIcon(sprites.iconAncientKey, { scale: 2, extraClass: 'glow-gold' }),
      opts.meta.ancientKeys,
      t('ui.menu.tooltip.ancientKey'),
    ));
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
    settingsBtn.addEventListener('click', opts.onSettings);
    topRight.appendChild(settingsBtn);
    topRow.appendChild(topRight);

    wrap.appendChild(topRow);

    // Mastery line (only visible once the player has Epic / Ancient victories)
    const masteryLine = buildMasteryLine(opts.meta);
    if (masteryLine) wrap.appendChild(masteryLine);

    // ─── Body: 3-column grid ──────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'mm-body';

    // ─ Left column: Crafting (Shop) + Laboratory + Daily rewards calendar ─
    const leftCol = document.createElement('div');
    leftCol.className = 'mm-col mm-col-left';

    // Crafting card
    const shopBtn = document.createElement('button');
    shopBtn.className = 'mm-card mm-shop-card';
    shopBtn.type = 'button';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'mm-card-title';
    shopTitle.innerHTML = `<span class="mm-shop-icon"></span><span>${t('ui.menu.shop')}</span>`;
    shopBtn.appendChild(shopTitle);
    const shopSlots = document.createElement('div');
    shopSlots.className = 'mm-shop-slots';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'mm-shop-slot';
      const pid = opts.meta.inventory[i];
      if (pid) {
        const p = POTION_BY_ID[pid];
        if (p) {
          slot.innerHTML = `<span class="mm-slot-potion">${p.glyph}</span>`;
          slot.title = t(p.i18nKey + '.name');
        }
      }
      shopSlots.appendChild(slot);
    }
    shopBtn.appendChild(shopSlots);
    const craftLvl = document.createElement('div');
    craftLvl.className = 'mm-craft-level';
    craftLvl.textContent = t('ui.menu.craftingLevel', { level: opts.meta.craftingLevel });
    shopBtn.appendChild(craftLvl);
    shopBtn.addEventListener('click', opts.onCrafting);
    leftCol.appendChild(shopBtn);

    // Laboratory card
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-card mm-lab-card';
    labBtn.type = 'button';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-card-title';
    labTitle.innerHTML = `<span class="mm-flask-icon"></span><span>${t('ui.menu.laboratory')}</span>`;
    labBtn.appendChild(labTitle);
    const labDesc = document.createElement('div');
    labDesc.className = 'mm-lab-desc';
    const hpNode = 0;
    const damageNode = 0;
    labDesc.innerHTML = `
      <span class="mm-lab-tree">
        <span class="branch left"></span><span class="branch right"></span>
        <span class="node core"></span>
        <span class="node hp">HP<br>+${hpNode}%</span>
        <span class="node dmg">DMG<br>+${damageNode}%</span>
      </span>
    `;
    labBtn.appendChild(labDesc);
    labBtn.addEventListener('click', opts.onLaboratory);
    leftCol.appendChild(labBtn);

    // Inline daily rewards calendar (lives alongside shop / laboratory in
    // the left column).
    leftCol.appendChild(this.buildInlineDailyCalendar(opts));

    body.appendChild(leftCol);

    // ─ Center column: Animated mannequin ─
    const centerCol = document.createElement('div');
    centerCol.className = 'mm-col mm-col-center';
    const illu = document.createElement('div');
    illu.className = 'mm-mannequin-display';
    illu.innerHTML = mannequinIllustrationSVG();
    centerCol.appendChild(illu);
    body.appendChild(centerCol);

    // ─ Right column: Leaderboard ─
    const rightCol = document.createElement('div');
    rightCol.className = 'mm-col mm-col-right';

    const lbWrap = document.createElement('div');
    lbWrap.className = 'mm-card mm-lb-card';
    const lbTitle = document.createElement('div');
    lbTitle.className = 'mm-card-title';
    lbTitle.innerHTML = `<span class="mm-lb-icon">🏆</span><span>${t('ui.menu.leaderboard')}</span>`;
    lbWrap.appendChild(lbTitle);
    lbWrap.appendChild(buildLeaderboardPanel({ topN: 10, compact: true }));
    rightCol.appendChild(lbWrap);

    body.appendChild(rightCol);
    wrap.appendChild(body);

    // ─── Bottom row: battle button ─────────────────────────────────
    const bottomRow = document.createElement('div');
    bottomRow.className = 'mm-bottom-row';

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

  /** Builds the 7-day inline daily rewards calendar widget. */
  private buildInlineDailyCalendar(opts: {
    meta: MetaSave;
    onDailyRewards: () => void;
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mm-card mm-daily-calendar';

    const titleRow = document.createElement('div');
    titleRow.className = 'mm-card-title';
    titleRow.innerHTML = `<span>📅</span><span>${t('ui.daily.title')}</span>`;

    const currentDay = opts.meta.dailyDay ?? 0;
    const pageStart = Math.floor(currentDay / 9) * 9;
    const pageNum = Math.floor(currentDay / 9) + 1;
    const badge = document.createElement('span');
    badge.className = 'mm-daily-week-badge';
    badge.textContent = t('ui.daily.week', { n: pageNum });
    titleRow.appendChild(badge);
    card.appendChild(titleRow);

    const grid = document.createElement('div');
    grid.className = 'mm-daily-grid';
    const claimable = canClaimDaily(opts.meta);

    for (let i = 0; i < 9; i++) {
      const dayIdx = pageStart + i;
      const reward = DAILY_REWARDS[dayIdx % DAILY_CYCLE];
      const cell = document.createElement('div');
      cell.className = 'mm-daily-cell';

      const isToday = dayIdx === currentDay;
      const isClaimed = dayIdx < currentDay;
      if (isToday) cell.classList.add('today');
      if (isClaimed) cell.classList.add('claimed');
      if (dayIdx > currentDay) cell.classList.add('locked');

      const dayLabel = document.createElement('div');
      dayLabel.className = 'mm-daily-day-label';
      dayLabel.textContent = isToday ? t('ui.daily.today') : t('ui.daily.day', { n: dayIdx + 1 });
      cell.appendChild(dayLabel);

      const iconEl = document.createElement('div');
      iconEl.className = 'mm-daily-icon';
      if (isClaimed) {
        iconEl.textContent = '✓';
      } else {
        iconEl.appendChild(spriteIcon(rewardSprite(reward.type), { scale: 2 }));
      }
      cell.appendChild(iconEl);

      const label = document.createElement('div');
      label.className = 'mm-daily-reward-label';
      label.textContent = rewardLabel(reward);
      cell.appendChild(label);

      grid.appendChild(cell);
    }
    card.appendChild(grid);

    const claimBtn = document.createElement('button');
    claimBtn.className = 'mm-daily-claim';
    claimBtn.type = 'button';
    claimBtn.textContent = t('ui.daily.claim');
    claimBtn.disabled = !claimable;
    if (claimable) {
      claimBtn.addEventListener('click', () => {
        const reward = DAILY_REWARDS[currentDay % DAILY_CYCLE];
        applyDailyReward(opts.meta, reward);
        opts.meta.dailyDay = currentDay + 1;
        opts.meta.dailyLastClaim = todayString();
        saveMeta(opts.meta);
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
 *  Wooden articulated artist's-mannequin: warm brown segments separated
 *  by visible ball joints (shoulders, elbows, hips, knees), no facial
 *  features, planted on the existing pixel-art dais. */
function mannequinIllustrationSVG(): string {
  // Palette — kept inline so the whole illustration reads as one block.
  // Tuned to match the reference art: warm sienna mid-tone, lighter
  // top-left highlight, deep brown shadow + near-black outline.
  const OUTLINE = '#2a1208';
  const SHADOW = '#7a4424';
  const MID = '#b97a3f';
  const HIGHLIGHT = '#d49157';

  // Helpers that emit the three layers (outline / mid / highlight) for a
  // segment or joint. Keeping these as template-literal helpers avoids
  // a runtime dependency and keeps the SVG self-contained.
  const segment = (x: number, y: number, w: number, h: number, r = 3) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r + 1}" fill="${OUTLINE}"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${r}" fill="${MID}"/>
    <rect x="${x + 1.5}" y="${y + 1.5}" width="${Math.max(2, w * 0.28)}" height="${h - 5}" fill="${HIGHLIGHT}" opacity="0.55"/>
  `;
  const joint = (cx: number, cy: number, r: number) => `
    <ellipse cx="${cx}" cy="${cy}" rx="${r + 0.8}" ry="${r + 0.4}" fill="${OUTLINE}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r - 0.4}" fill="${MID}"/>
    <ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" rx="${r * 0.45}" ry="${r * 0.4}" fill="${HIGHLIGHT}" opacity="0.7"/>
  `;

  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="mm-glow" cx="50%" cy="55%" r="50%">
        <stop offset="0%" stop-color="#ffb84a" stop-opacity="0.30"/>
        <stop offset="60%" stop-color="#d27a2a" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#d27a2a" stop-opacity="0"/>
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

    <!-- Background warm glow -->
    <ellipse cx="100" cy="125" rx="80" ry="80" fill="url(#mm-glow)" filter="url(#mm-soft)"/>

    <!-- Floor / dais (unchanged from previous design — keeps the menu
         silhouette and lighting consistent). -->
    <ellipse cx="100" cy="195" rx="55" ry="18" fill="url(#mm-floor)"/>
    <polygon points="60,185 100,170 140,185 100,200" fill="#454a60" stroke="#2a2c3a" stroke-width="2"/>
    <polygon points="60,185 100,200 100,208 55,192" fill="#2a2c3a"/>
    <polygon points="140,185 100,200 100,208 145,192" fill="#1a1d28"/>

    <!-- Soft drop shadow directly under the figure -->
    <ellipse cx="100" cy="180" rx="24" ry="5" fill="rgba(0,0,0,0.45)"/>

    <g id="mm-figure">
      <!-- Idle bob -->
      <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0" dur="2.5s" repeatCount="indefinite"/>

      <!-- ============ Feet ============ -->
      ${segment(83, 172, 17, 9, 2)}
      ${segment(100, 172, 17, 9, 2)}

      <!-- ============ Calves ============ -->
      ${segment(86, 158, 12, 16, 3)}
      ${segment(102, 158, 12, 16, 3)}

      <!-- ============ Knees ============ -->
      ${joint(92, 156, 6)}
      ${joint(108, 156, 6)}

      <!-- ============ Thighs ============ -->
      ${segment(85, 138, 14, 20, 4)}
      ${segment(101, 138, 14, 20, 4)}

      <!-- ============ Hip joints ============ -->
      ${joint(92, 138, 7)}
      ${joint(108, 138, 7)}

      <!-- ============ Pelvis (wider waist disc) ============ -->
      <rect x="85" y="123" width="30" height="15" rx="6" fill="${OUTLINE}"/>
      <rect x="86" y="124" width="28" height="13" rx="5" fill="${MID}"/>
      <rect x="87" y="124.5" width="22" height="2.5" fill="${HIGHLIGHT}" opacity="0.55"/>

      <!-- ============ Abdomen (narrower segment) ============ -->
      <rect x="92" y="116" width="16" height="9" rx="2" fill="${OUTLINE}"/>
      <rect x="93" y="117" width="14" height="7" rx="2" fill="${SHADOW}"/>

      <!-- ============ Chest ============ -->
      <path d="M 84,93 Q 84,88 89,88 L 111,88 Q 116,88 116,93 L 116,116 Q 116,118 114,118 L 86,118 Q 84,118 84,116 Z"
            fill="${OUTLINE}"/>
      <path d="M 85.5,94 Q 85.5,89.5 90,89.5 L 110,89.5 Q 114.5,89.5 114.5,94 L 114.5,115 Q 114.5,116.5 113,116.5 L 87,116.5 Q 85.5,116.5 85.5,115 Z"
            fill="${MID}"/>
      <!-- chest highlight (upper-left) -->
      <ellipse cx="93" cy="98" rx="5" ry="7" fill="${HIGHLIGHT}" opacity="0.55"/>
      <!-- subtle vertical centreline like a torso seam -->
      <line x1="100" y1="92" x2="100" y2="116" stroke="${SHADOW}" stroke-width="1" opacity="0.55"/>

      <!-- ============ Arms ============ -->
      <!-- Upper arms -->
      ${segment(76, 100, 12, 20, 4)}
      ${segment(112, 100, 12, 20, 4)}

      <!-- Elbow joints -->
      ${joint(82, 120, 6)}
      ${joint(118, 120, 6)}

      <!-- Forearms -->
      ${segment(76, 122, 12, 20, 4)}
      ${segment(112, 122, 12, 20, 4)}

      <!-- Hand balls -->
      ${joint(82, 143, 5.5)}
      ${joint(118, 143, 5.5)}

      <!-- ============ Shoulders (ball joints overlapping chest sides) ============ -->
      ${joint(82, 100, 9)}
      ${joint(118, 100, 9)}

      <!-- ============ Neck ============ -->
      <rect x="95" y="83" width="10" height="9" rx="2" fill="${OUTLINE}"/>
      <rect x="96" y="84" width="8" height="7" rx="2" fill="${SHADOW}"/>

      <!-- ============ Head (smooth wooden sphere, no face) ============ -->
      <ellipse cx="100" cy="73" rx="14" ry="13" fill="${OUTLINE}"/>
      <ellipse cx="100" cy="73" rx="12.5" ry="11.5" fill="${MID}"/>
      <!-- Soft top-left highlight -->
      <ellipse cx="95" cy="68" rx="5" ry="4" fill="${HIGHLIGHT}" opacity="0.65"/>
      <!-- Subtle chin-shadow under the head, hides the seam onto the neck -->
      <ellipse cx="100" cy="84" rx="6" ry="2" fill="${SHADOW}" opacity="0.5"/>
    </g>
  </svg>`;
}

/** Builds a single `[pixel-icon] [amount]` chip for the main-menu top bar. */
function buildCurrencyChip(
  modifier: string,
  icon: HTMLElement,
  amount: number,
  tooltip: string,
): HTMLElement {
  const chip = document.createElement('span');
  chip.className = `mm-currency ${modifier}`;
  chip.title = tooltip;
  chip.appendChild(icon);
  const amt = document.createElement('strong');
  amt.textContent = `${amount}`;
  chip.appendChild(amt);
  return chip;
}

/** Builds the small mastery summary line shown right below the top bar.
 *  Returns null while the player has 0 mastery in both modes. */
function buildMasteryLine(meta: MetaSave): HTMLElement | null {
  const epic = meta.epicMastery ?? 0;
  const ancient = meta.ancientMastery ?? 0;
  if (epic === 0 && ancient === 0) return null;
  const bonus = Math.round((masteryEssenceMult(meta) - 1) * 100);
  const wrap = document.createElement('div');
  wrap.className = 'mm-mastery-line';

  const sprites = getSprites();
  if (epic > 0) {
    const chip = document.createElement('span');
    chip.className = 'mm-mastery-chip mm-mastery-epic';
    chip.title = t('ui.menu.tooltip.epicMastery');
    chip.appendChild(spriteIcon(sprites.iconEpicKey, { scale: 2 }));
    const lbl = document.createElement('span');
    lbl.textContent = t('ui.menu.epicMastery');
    chip.appendChild(lbl);
    const amt = document.createElement('strong');
    amt.textContent = `${epic}`;
    chip.appendChild(amt);
    wrap.appendChild(chip);
  }
  if (ancient > 0) {
    const chip = document.createElement('span');
    chip.className = 'mm-mastery-chip mm-mastery-ancient';
    chip.title = t('ui.menu.tooltip.ancientMastery');
    chip.appendChild(spriteIcon(sprites.iconAncientKey, { scale: 2, extraClass: 'glow-gold' }));
    const lbl = document.createElement('span');
    lbl.textContent = t('ui.menu.ancientMastery');
    chip.appendChild(lbl);
    const amt = document.createElement('strong');
    amt.textContent = `${ancient}`;
    chip.appendChild(amt);
    wrap.appendChild(chip);
  }
  const bonusEl = document.createElement('span');
  bonusEl.className = 'mm-mastery-bonus';
  bonusEl.textContent = t('ui.menu.masteryBonus', { n: bonus });
  bonusEl.title = t('ui.menu.tooltip.masteryBonus');
  wrap.appendChild(bonusEl);
  return wrap;
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
