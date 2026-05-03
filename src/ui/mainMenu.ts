import type { MetaSave } from '../game/save';
import { canClaimDaily, todayString, saveMeta } from '../game/save';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { POTION_BY_ID, POTION_INVENTORY_SIZE } from '../data/potions';
import { DAILY_REWARDS, DAILY_CYCLE, rewardLabel, rewardSprite } from '../data/dailyRewards';
import { buildLeaderboardPanel } from './leaderboardOverlay';
import { getSprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';
import { masteryEssenceMult } from '../game/meta';
import {
  ACTIVE_MODULES,
  AURA_MODULES,
  isActiveModule,
  isAuraModule,
  moduleName,
  type ActiveModuleId,
  type AuraModuleId,
} from '../data/modules';
import { moduleGlyph } from './loadoutOverlay';

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
    onLoadout: () => void;
  }): void {
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'main-menu';

    // Floating ember sparks behind the menu — pure decoration, mirrors
    // the language used by the run-end / chest stages so the main menu
    // reads as part of the same world. Each spark has a randomised x /
    // delay / duration / scale so the layer never visibly loops.
    wrap.appendChild(buildMenuSparks(18));

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

    // Loadout widget — «equipped» active module + aura. Click opens the
    // dedicated loadout picker. Mirrors the laboratory card visually so
    // both «meta state» cards live side-by-side in the left column.
    leftCol.appendChild(buildLoadoutCard(opts.meta, opts.onLoadout));

    body.appendChild(leftCol);

    // ─ Center column: Animated mannequin ─
    const centerCol = document.createElement('div');
    centerCol.className = 'mm-col mm-col-center';
    const illu = document.createElement('div');
    illu.className = 'mm-mannequin-display';
    illu.innerHTML = mannequinIllustrationSVG();
    centerCol.appendChild(illu);
    body.appendChild(centerCol);

    // ─ Right column: Leaderboard (full) + collapsible daily rewards.
    //   Default state: leaderboard expanded, daily calendar collapsed to
    //   just the header strip with a status indicator. Clicking the daily
    //   header animates daily open and shrinks leaderboard; clicking the
    //   leaderboard or the header again collapses daily back.
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

    rightCol.appendChild(this.buildInlineDailyCalendar(opts, () => {
      // After a successful daily claim the menu is fully re-rendered,
      // which resets the right-column state. Nothing extra needed here.
    }));

    // Toggle handlers — clicking the leaderboard while daily is open
    // collapses it back. Clicking the daily header toggles open / closed.
    lbWrap.addEventListener('click', () => {
      if (rightCol.classList.contains('daily-open')) {
        rightCol.classList.remove('daily-open');
      }
    });

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

  /** Builds the 7-day inline daily rewards calendar widget.
   *
   * The calendar lives in the right column under the leaderboard and
   * starts collapsed — only the header strip with a `!`/`✓` status
   * indicator is visible. Clicking the header toggles a `.daily-open`
   * class on the parent `.mm-col-right` which CSS uses to animate the
   * panel open and shrink the leaderboard above it. */
  private buildInlineDailyCalendar(opts: {
    meta: MetaSave;
    onDailyRewards: () => void;
  }, _onClaim: () => void): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mm-card mm-daily-calendar collapsed';

    const titleRow = document.createElement('div');
    titleRow.className = 'mm-card-title mm-daily-header';
    const claimable = canClaimDaily(opts.meta);
    const indicator = claimable
      ? `<span class="mm-daily-indicator mm-daily-indicator-claimable" title="${t('ui.daily.indicator.unclaimed')}">!</span>`
      : `<span class="mm-daily-indicator mm-daily-indicator-claimed" title="${t('ui.daily.indicator.claimed')}">✓</span>`;
    titleRow.innerHTML = `<span>📅</span><span class="mm-daily-header-text">${t('ui.daily.title')}</span>${indicator}`;

    const currentDay = opts.meta.dailyDay ?? 0;
    const pageStart = Math.floor(currentDay / 9) * 9;
    const pageNum = Math.floor(currentDay / 9) + 1;
    const badge = document.createElement('span');
    badge.className = 'mm-daily-week-badge';
    badge.textContent = t('ui.daily.week', { n: pageNum });
    const chev = document.createElement('span');
    chev.className = 'mm-daily-chev';
    chev.textContent = '▾';
    titleRow.appendChild(badge);
    titleRow.appendChild(chev);
    card.appendChild(titleRow);

    // The collapsing body lives inside .mm-daily-content; CSS animates
    // grid-template-rows from 0fr → 1fr to expand it smoothly.
    const content = document.createElement('div');
    content.className = 'mm-daily-content';
    const contentInner = document.createElement('div');
    contentInner.className = 'mm-daily-content-inner';
    content.appendChild(contentInner);

    const grid = document.createElement('div');
    grid.className = 'mm-daily-grid';

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
    contentInner.appendChild(grid);

    const claimBtn = document.createElement('button');
    claimBtn.className = 'mm-daily-claim';
    claimBtn.type = 'button';
    claimBtn.textContent = t('ui.daily.claim');
    claimBtn.disabled = !claimable;
    if (claimable) {
      claimBtn.addEventListener('click', (ev) => {
        ev.stopPropagation(); // don't toggle collapse on claim
        const reward = DAILY_REWARDS[currentDay % DAILY_CYCLE];
        applyDailyReward(opts.meta, reward);
        opts.meta.dailyDay = currentDay + 1;
        opts.meta.dailyLastClaim = todayString();
        saveMeta(opts.meta);
        this.show(opts as Parameters<MainMenu['show']>[0]);
      });
    }
    contentInner.appendChild(claimBtn);
    card.appendChild(content);

    // Toggle open / closed via the parent column's `.daily-open` class.
    card.addEventListener('click', (ev) => {
      // If the click landed on the claim button or its descendants, let
      // the button handle it without toggling the panel.
      const target = ev.target as HTMLElement | null;
      if (target && target.closest('.mm-daily-claim')) return;
      const col = card.closest('.mm-col-right');
      if (col) col.classList.toggle('daily-open');
    });

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
 *  Chunky pixel-art wooden artist's mannequin — every shape is built
 *  from rectangles snapped to a 2-unit pixel grid, joints are octagonal
 *  (square with 1-pixel chamfered corners), and the SVG renders with
 *  `shape-rendering="crispEdges"` so the silhouette has hard pixel
 *  borders matching the rest of the game's pixel-art UI. */
function mannequinIllustrationSVG(): string {
  // Palette — wooden mannequin: near-black outline, mid sienna body,
  // light tan highlight, mid-shadow used for seams.
  const O = '#2a1208';
  const S = '#7a4424';
  const M = '#b97a3f';
  const L = '#d49157';

  // 3-layer pixel block: outline border (2px), mid fill, top-left
  // 2-pixel highlight stripe. All coords assume a 2-svu pixel grid.
  const block = (x: number, y: number, w: number, h: number) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${O}"/>
    <rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="${M}"/>
    <rect x="${x + 2}" y="${y + 2}" width="2" height="${h - 4}" fill="${L}"/>
  `;

  // Octagonal "ball" joint: a square with the four 2x2 corners
  // chamfered out so the silhouette reads as a chunky pixel circle.
  // `size` must be an even number ≥ 8 and divisible by 2; cx/cy must
  // be chosen so cx-size/2 and cy-size/2 are even.
  const joint = (cx: number, cy: number, size: number) => {
    const x = cx - size / 2;
    const y = cy - size / 2;
    return `
      <!-- top / bottom outline edges (inset by 2 each side for chamfer) -->
      <rect x="${x + 2}" y="${y}" width="${size - 4}" height="2" fill="${O}"/>
      <rect x="${x + 2}" y="${y + size - 2}" width="${size - 4}" height="2" fill="${O}"/>
      <!-- left / right outline edges (inset top/bottom by 2) -->
      <rect x="${x}" y="${y + 2}" width="2" height="${size - 4}" fill="${O}"/>
      <rect x="${x + size - 2}" y="${y + 2}" width="2" height="${size - 4}" fill="${O}"/>
      <!-- corner chamfer outline pixels -->
      <rect x="${x + 2}" y="${y + 2}" width="2" height="2" fill="${O}"/>
      <rect x="${x + size - 4}" y="${y + 2}" width="2" height="2" fill="${O}"/>
      <rect x="${x + 2}" y="${y + size - 4}" width="2" height="2" fill="${O}"/>
      <rect x="${x + size - 4}" y="${y + size - 4}" width="2" height="2" fill="${O}"/>
      <!-- mid fill (octagonal interior) -->
      <rect x="${x + 4}" y="${y + 2}" width="${size - 8}" height="${size - 4}" fill="${M}"/>
      <rect x="${x + 2}" y="${y + 4}" width="${size - 4}" height="${size - 8}" fill="${M}"/>
      <!-- top-left highlight pixel -->
      <rect x="${x + 4}" y="${y + 4}" width="2" height="2" fill="${L}"/>
    `;
  };

  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
    <defs>
      <radialGradient id="mm-glow" cx="50%" cy="55%" r="55%">
        <stop offset="0%" stop-color="#ffb84a" stop-opacity="0.30"/>
        <stop offset="60%" stop-color="#d27a2a" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#d27a2a" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mm-floor" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#454a60"/>
        <stop offset="80%" stop-color="#1a1d28"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>

    <!-- Background warm glow (kept smooth — pure ambient light, behind
         everything; pixel-art rules apply only to the figure itself). -->
    <ellipse cx="100" cy="120" rx="80" ry="80" fill="url(#mm-glow)"/>

    <!-- Floor / dais — kept faceted-pixel style; matches the menu art. -->
    <ellipse cx="100" cy="195" rx="55" ry="18" fill="url(#mm-floor)"/>
    <polygon points="60,184 100,170 140,184 100,200" fill="#454a60" stroke="#2a2c3a" stroke-width="2"/>
    <polygon points="60,184 100,200 100,208 56,192" fill="#2a2c3a"/>
    <polygon points="140,184 100,200 100,208 144,192" fill="#1a1d28"/>

    <!-- Pixelated drop shadow (3 hard rect bands instead of an ellipse) -->
    <rect x="80" y="178" width="40" height="2" fill="#000" opacity="0.45"/>
    <rect x="76" y="180" width="48" height="2" fill="#000" opacity="0.30"/>
    <rect x="84" y="176" width="32" height="2" fill="#000" opacity="0.25"/>

    <g id="mm-figure">
      <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0" dur="2.5s" repeatCount="indefinite"/>

      <!-- ====== Feet ====== -->
      ${block(80, 168, 18, 10)}
      ${block(102, 168, 18, 10)}

      <!-- ====== Calves ====== -->
      ${block(86, 152, 12, 16)}
      ${block(102, 152, 12, 16)}

      <!-- ====== Knee joints ====== -->
      ${joint(92, 152, 12)}
      ${joint(108, 152, 12)}

      <!-- ====== Thighs ====== -->
      ${block(86, 134, 12, 18)}
      ${block(102, 134, 12, 18)}

      <!-- ====== Hip joints ====== -->
      ${joint(92, 132, 12)}
      ${joint(108, 132, 12)}

      <!-- ====== Pelvis (wider waist) ====== -->
      ${block(84, 122, 32, 8)}

      <!-- ====== Abdomen (narrower) ====== -->
      ${block(94, 114, 12, 8)}

      <!-- ====== Chest (octagonal silhouette: chamfered corners) ====== -->
      <!-- Outline ring -->
      <rect x="88" y="86" width="24" height="2" fill="${O}"/>
      <rect x="86" y="88" width="2" height="2" fill="${O}"/>
      <rect x="112" y="88" width="2" height="2" fill="${O}"/>
      <rect x="84" y="90" width="2" height="20" fill="${O}"/>
      <rect x="114" y="90" width="2" height="20" fill="${O}"/>
      <rect x="86" y="110" width="2" height="2" fill="${O}"/>
      <rect x="112" y="110" width="2" height="2" fill="${O}"/>
      <rect x="88" y="112" width="24" height="2" fill="${O}"/>
      <!-- Mid fill -->
      <rect x="88" y="88" width="24" height="2" fill="${M}"/>
      <rect x="86" y="90" width="28" height="20" fill="${M}"/>
      <rect x="88" y="110" width="24" height="2" fill="${M}"/>
      <!-- Highlight (top-left corner block + thin vertical stripe) -->
      <rect x="88" y="90" width="4" height="2" fill="${L}"/>
      <rect x="86" y="92" width="2" height="14" fill="${L}"/>
      <!-- Centre seam -->
      <rect x="100" y="90" width="2" height="20" fill="${S}"/>

      <!-- ====== Arms — upper ====== -->
      ${block(74, 96, 12, 20)}
      ${block(114, 96, 12, 20)}

      <!-- ====== Elbow joints ====== -->
      ${joint(80, 116, 12)}
      ${joint(120, 116, 12)}

      <!-- ====== Forearms ====== -->
      ${block(74, 118, 12, 20)}
      ${block(114, 118, 12, 20)}

      <!-- ====== Hand joints ====== -->
      ${joint(80, 140, 10)}
      ${joint(120, 140, 10)}

      <!-- ====== Shoulder joints (overlap chest top sides) ====== -->
      ${joint(80, 94, 14)}
      ${joint(120, 94, 14)}

      <!-- ====== Neck ====== -->
      ${block(96, 80, 8, 8)}

      <!-- ====== Head (octagonal, 24x22 px) ====== -->
      <!-- Outline ring -->
      <rect x="92" y="56" width="16" height="2" fill="${O}"/>
      <rect x="90" y="58" width="2" height="2" fill="${O}"/>
      <rect x="106" y="58" width="2" height="2" fill="${O}"/>
      <rect x="88" y="60" width="2" height="2" fill="${O}"/>
      <rect x="110" y="60" width="2" height="2" fill="${O}"/>
      <rect x="86" y="62" width="2" height="14" fill="${O}"/>
      <rect x="112" y="62" width="2" height="14" fill="${O}"/>
      <rect x="88" y="76" width="2" height="2" fill="${O}"/>
      <rect x="110" y="76" width="2" height="2" fill="${O}"/>
      <rect x="90" y="78" width="2" height="2" fill="${O}"/>
      <rect x="106" y="78" width="2" height="2" fill="${O}"/>
      <rect x="92" y="80" width="16" height="2" fill="${O}"/>
      <!-- Mid fill -->
      <rect x="92" y="58" width="16" height="2" fill="${M}"/>
      <rect x="90" y="60" width="20" height="2" fill="${M}"/>
      <rect x="88" y="62" width="24" height="14" fill="${M}"/>
      <rect x="90" y="76" width="20" height="2" fill="${M}"/>
      <rect x="92" y="78" width="16" height="2" fill="${M}"/>
      <!-- Top-left highlight cluster -->
      <rect x="92" y="60" width="4" height="2" fill="${L}"/>
      <rect x="90" y="62" width="2" height="6" fill="${L}"/>
      <rect x="92" y="62" width="2" height="2" fill="${L}"/>
    </g>
  </svg>`;
}

/** Builds the «Снаряжение Манекена» card on the main menu — a compact
 *  read-only widget that shows the currently-equipped active module and
 *  aura side-by-side. Click opens the dedicated loadout picker overlay. */
function buildLoadoutCard(meta: MetaSave, onOpen: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'mm-card mm-loadout-card';

  const titleRow = document.createElement('div');
  titleRow.className = 'mm-card-title';
  titleRow.innerHTML = `<span class="mm-loadout-icon">⚒</span><span>${t('ui.menu.loadout')}</span>`;
  card.appendChild(titleRow);

  const slots = document.createElement('div');
  slots.className = 'mm-loadout-slots';

  const activeId = isActiveModule(meta.selectedActiveModule)
    ? (meta.selectedActiveModule as ActiveModuleId)
    : (Object.keys(ACTIVE_MODULES)[0] as ActiveModuleId);
  const auraId = isAuraModule(meta.selectedAuraModule)
    ? (meta.selectedAuraModule as AuraModuleId)
    : (Object.keys(AURA_MODULES)[0] as AuraModuleId);

  slots.appendChild(buildLoadoutSlot('active', activeId));
  slots.appendChild(buildLoadoutSlot('aura', auraId));
  card.appendChild(slots);

  const hint = document.createElement('div');
  hint.className = 'mm-loadout-hint';
  hint.textContent = t('ui.menu.loadoutHint');
  card.appendChild(hint);

  card.addEventListener('click', onOpen);
  return card;
}

/** One inline `[icon] [name]` slot inside the loadout widget, tagged
 *  with the slot kind so CSS can colour the rim differently for active
 *  vs aura. */
function buildLoadoutSlot(slot: 'active' | 'aura', id: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `mm-loadout-slot mm-loadout-slot-${slot}`;

  const ico = document.createElement('span');
  ico.className = 'mm-loadout-slot-icon';
  ico.textContent = moduleGlyph(slot, id);
  wrap.appendChild(ico);

  const text = document.createElement('span');
  text.className = 'mm-loadout-slot-text';
  const tag = document.createElement('span');
  tag.className = 'mm-loadout-slot-tag';
  tag.textContent = slot === 'active'
    ? t('ui.menu.loadoutActiveTag')
    : t('ui.menu.loadoutAuraTag');
  text.appendChild(tag);

  const name = document.createElement('span');
  name.className = 'mm-loadout-slot-name';
  const def = slot === 'active' ? ACTIVE_MODULES[id as ActiveModuleId] : AURA_MODULES[id as AuraModuleId];
  name.textContent = def ? moduleName(def) : '—';
  text.appendChild(name);
  wrap.appendChild(text);

  return wrap;
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

/** Builds a layer of N decorative ember sparks that drift upward across
 *  the main menu background. Each spark gets randomised CSS variables so
 *  they desync naturally — see the `mm-spark-rise` keyframes for the
 *  actual motion. Mirrors the technique used by the defeat / chest
 *  stages (`defeat-spark` etc.). */
function buildMenuSparks(count: number): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'mm-sparks';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'mm-spark';
    s.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    s.style.setProperty('--delay', `${(Math.random() * 6).toFixed(2)}s`);
    s.style.setProperty('--dur', `${(6 + Math.random() * 4).toFixed(2)}s`);
    s.style.setProperty('--scale', `${(0.6 + Math.random() * 1.2).toFixed(2)}`);
    layer.appendChild(s);
  }
  return layer;
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
      // Once the player picks a language manually we stop letting the
      // Yandex SDK override it on subsequent sessions.
      meta.localeUserChoice = true;
      saveMeta(meta);
      window.dispatchEvent(new CustomEvent('asd-locale-changed'));
    });
    wrap.appendChild(b);
  }
  return wrap;
}
