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

    // Crafting card. Empty potion slots show a faded silhouette of an
    // unidentified vial so it's immediately obvious what the section is
    // for, even before the player has crafted anything. The decorative
    // alchemy backdrop (steam, glow) is layered behind the slots via
    // CSS pseudo-elements on `.mm-shop-card`. The previous "Уровень
    // крафта" line was removed — that information still lives inside
    // the crafting overlay itself.
    const shopBtn = document.createElement('button');
    shopBtn.className = 'mm-card mm-shop-card';
    shopBtn.type = 'button';
    shopBtn.dataset.tutorialTarget = 'menu-shop';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'mm-card-title';
    shopTitle.innerHTML = `<span class="mm-shop-icon"></span><span>${t('ui.menu.shop')}</span>`;
    shopBtn.appendChild(shopTitle);
    const shopBackdrop = document.createElement('div');
    shopBackdrop.className = 'mm-shop-backdrop';
    shopBackdrop.setAttribute('aria-hidden', 'true');
    shopBackdrop.innerHTML = shopBackdropSVG();
    shopBtn.appendChild(shopBackdrop);
    const shopSlots = document.createElement('div');
    shopSlots.className = 'mm-shop-slots';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'mm-shop-slot';
      const pid = opts.meta.inventory[i];
      if (pid) {
        const p = POTION_BY_ID[pid];
        if (p) {
          slot.classList.add('filled');
          slot.innerHTML = `<span class="mm-slot-potion" style="--potion-color:${p.color}">${p.glyph}</span>`;
          slot.title = t(p.i18nKey + '.name');
        }
      } else {
        // Empty slot: render a translucent vial silhouette so the player
        // can read the slot as "a potion goes here" at a glance.
        slot.classList.add('empty');
        slot.innerHTML = `<span class="mm-slot-silhouette" aria-hidden="true"></span>`;
      }
      shopSlots.appendChild(slot);
    }
    shopBtn.appendChild(shopSlots);
    shopBtn.addEventListener('click', opts.onCrafting);
    leftCol.appendChild(shopBtn);

    // Laboratory card. The header used to carry a small green-flask
    // pixel icon next to the title — removed per request, the title
    // now reads cleanly. The card body shows a decorative skill-tree
    // diorama (purely visual; the real talent tree opens in its own
    // overlay on click).
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-card mm-lab-card';
    labBtn.type = 'button';
    labBtn.dataset.tutorialTarget = 'menu-laboratory';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-card-title';
    labTitle.innerHTML = `<span>${t('ui.menu.laboratory')}</span>`;
    labBtn.appendChild(labTitle);
    const labDesc = document.createElement('div');
    labDesc.className = 'mm-lab-desc';
    labDesc.innerHTML = labSkillTreeSVG();
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
    lbWrap.dataset.tutorialTarget = 'menu-leaderboard';
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
    battleBtn.dataset.tutorialTarget = 'menu-battle';
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
    card.dataset.tutorialTarget = 'menu-daily';

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

    // When the player has already claimed today, `currentDay` points at
    // *tomorrow's* reward — that cell isn't actually claimable until the
    // date rolls over, so labelling it "Сегодня" is misleading. Shift the
    // highlight back onto the day we just claimed (`currentDay - 1`) and
    // drop the "Сегодня" label there.
    const highlightIdx = claimable ? currentDay : currentDay - 1;

    for (let i = 0; i < 9; i++) {
      const dayIdx = pageStart + i;
      const reward = DAILY_REWARDS[dayIdx % DAILY_CYCLE];
      const cell = document.createElement('div');
      cell.className = 'mm-daily-cell';

      const isHighlighted = dayIdx === highlightIdx;
      const isTodayLabel = isHighlighted && claimable;
      const isClaimed = dayIdx < currentDay;
      if (isHighlighted) cell.classList.add('today');
      if (isClaimed) cell.classList.add('claimed');
      if (dayIdx > currentDay) cell.classList.add('locked');

      const dayLabel = document.createElement('div');
      dayLabel.className = 'mm-daily-day-label';
      dayLabel.textContent = isTodayLabel ? t('ui.daily.today') : t('ui.daily.day', { n: dayIdx + 1 });
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
  // Mirrors `applyDailyReward` in `dailyRewardsOverlay.ts`. The two
  // copies exist because the main-menu card's "claim" tap takes a
  // shortcut path and never opens the full overlay; keep them in sync.
  switch (reward.type) {
    case 'blue_essence':
      meta.blueEssence += reward.amount;
      break;
    case 'ancient_essence':
      meta.ancientEssence += reward.amount;
      break;
    case 'epic_key':
      meta.epicKeys += reward.amount;
      break;
    case 'ancient_key':
      meta.ancientKeys += reward.amount;
      break;
    case 'rerolls':
      meta.bonusRerolls += reward.amount;
      break;
  }
}

/** Decorative skill-tree diorama for the laboratory card.
 *
 *  Renders a 1-3-5 mini diamond of glowing nodes connected by warm
 *  edges, mirroring the structure of the real Talent Laboratory tree
 *  (which is much larger — see `metaTree.ts`). The visualisation is
 *  purely cosmetic; clicking the card opens the actual tree overlay.
 *
 *  Node states are baked-in here (root + 3 owned + mix of available /
 *  locked) so the widget always reads as "in-progress" — the player
 *  sees a tree they could pour points into. The CSS animates the
 *  edges and "owned" nodes so the diorama feels alive. */
function labSkillTreeSVG(): string {
  return `<svg class="mm-lab-tree-svg" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <radialGradient id="mm-lab-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffe091" stop-opacity="0.35"/>
        <stop offset="60%" stop-color="#ff8c3a" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#ff8c3a" stop-opacity="0"/>
      </radialGradient>
      <filter id="mm-lab-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4"/>
      </filter>
    </defs>
    <!-- Soft warm halo behind the whole tree -->
    <ellipse cx="100" cy="60" rx="92" ry="46" fill="url(#mm-lab-glow)"/>

    <!-- Connecting edges: tier0→tier1, tier1→tier2 -->
    <g class="mm-lab-edges">
      <line class="edge owned" x1="100" y1="20" x2="60"  y2="50"/>
      <line class="edge owned" x1="100" y1="20" x2="100" y2="50"/>
      <line class="edge owned" x1="100" y1="20" x2="140" y2="50"/>
      <line class="edge avail" x1="60"  y1="50" x2="30"  y2="86"/>
      <line class="edge avail" x1="60"  y1="50" x2="60"  y2="86"/>
      <line class="edge avail" x1="100" y1="50" x2="100" y2="86"/>
      <line class="edge locked" x1="140" y1="50" x2="140" y2="86"/>
      <line class="edge locked" x1="140" y1="50" x2="170" y2="86"/>
    </g>

    <!-- Nodes: root (gold) → tier1 (3 owned) → tier2 (5 mixed) -->
    <g class="mm-lab-nodes">
      <!-- Tier 0: root keystone (gold) -->
      <circle class="node-halo" cx="100" cy="20" r="14"/>
      <circle class="node root" cx="100" cy="20" r="9"/>

      <!-- Tier 1: 3 owned, colour-coded -->
      <circle class="node-halo" cx="60"  cy="50" r="11"/>
      <circle class="node owned hp"      cx="60"  cy="50" r="7"/>
      <circle class="node-halo" cx="100" cy="50" r="11"/>
      <circle class="node owned utility" cx="100" cy="50" r="7"/>
      <circle class="node-halo" cx="140" cy="50" r="11"/>
      <circle class="node owned dmg"     cx="140" cy="50" r="7"/>

      <!-- Tier 2: 5 nodes, mixed states -->
      <circle class="node avail hp"        cx="30"  cy="86" r="6"/>
      <circle class="node avail hp"        cx="60"  cy="86" r="6"/>
      <circle class="node avail keystone"  cx="100" cy="86" r="9"/>
      <circle class="node locked dmg"      cx="140" cy="86" r="6"/>
      <circle class="node locked dmg"      cx="170" cy="86" r="6"/>
    </g>
  </svg>`;
}

/** Decorative alchemy-table backdrop for the crafting card.
 *
 *  Layered behind the potion slots so the section reads as an
 *  apothecary's bench rather than a row of empty squares. Drawn in
 *  pure SVG so the asset ships with the bundle and scales with the
 *  card. The slots themselves are absolutely positioned over this. */
function shopBackdropSVG(): string {
  return `<svg viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id="mm-shop-warm" cx="50%" cy="55%" r="65%">
        <stop offset="0%"  stop-color="#ffd166" stop-opacity="0.30"/>
        <stop offset="55%" stop-color="#ff8c3a" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#ff8c3a" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mm-shop-shelf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#3a1d10"/>
        <stop offset="100%" stop-color="#1a0c08"/>
      </linearGradient>
      <linearGradient id="mm-shop-shelf-edge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="#7a3a14"/>
        <stop offset="100%" stop-color="#3a1d10"/>
      </linearGradient>
    </defs>
    <!-- Warm radial glow behind everything -->
    <rect x="0" y="0" width="200" height="110" fill="url(#mm-shop-warm)"/>

    <!-- Wooden shelf the slots will sit on -->
    <rect x="0" y="74" width="200" height="22" fill="url(#mm-shop-shelf)"/>
    <rect x="0" y="74" width="200" height="3"  fill="url(#mm-shop-shelf-edge)"/>

    <!-- Drifting steam wisps (animated via CSS) -->
    <g class="mm-shop-steam">
      <ellipse cx="40"  cy="22" rx="18" ry="6" fill="rgba(255,210,140,0.18)"/>
      <ellipse cx="100" cy="14" rx="22" ry="5" fill="rgba(255,210,140,0.22)"/>
      <ellipse cx="160" cy="22" rx="18" ry="6" fill="rgba(255,210,140,0.18)"/>
    </g>

    <!-- Sparks: tiny warm dots scattered above the shelf -->
    <g class="mm-shop-sparkles">
      <circle cx="20"  cy="40" r="1.6" fill="#ffe091"/>
      <circle cx="50"  cy="32" r="1.2" fill="#ffd166"/>
      <circle cx="80"  cy="45" r="1.6" fill="#ffe091"/>
      <circle cx="120" cy="36" r="1.2" fill="#ffd166"/>
      <circle cx="150" cy="44" r="1.6" fill="#ffe091"/>
      <circle cx="180" cy="32" r="1.2" fill="#ffd166"/>
    </g>
  </svg>`;
}

/** Pixel-art wooden artist's mannequin (centre of the main menu).
 *
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
  card.dataset.tutorialTarget = 'menu-loadout';

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
