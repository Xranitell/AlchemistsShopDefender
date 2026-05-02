import type { MetaSave } from '../game/save';
import { canClaimDaily, saveMeta } from '../game/save';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { POTION_BY_ID, POTION_INVENTORY_SIZE } from '../data/potions';

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
    onLeaderboards: () => void;
    onCrafting: () => void;
  }): void {
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'main-menu';

    // Top bar — currencies
    const topBar = document.createElement('div');
    topBar.className = 'mm-top-bar';
    topBar.innerHTML = `
      <span class="mm-currency blue-essence" title="${t('ui.menu.tooltip.blueEssence')}"><span class="mm-res-icon blue-essence"></span><strong>${opts.meta.blueEssence}</strong></span>
      <span class="mm-currency ancient-essence" title="${t('ui.menu.tooltip.ancientEssence')}"><span class="mm-res-icon ancient-essence"></span><strong>${opts.meta.ancientEssence}</strong></span>
      <span class="mm-currency epic-key" title="${t('ui.menu.tooltip.epicKey')}"><span class="mm-res-icon key epic"></span><strong>${opts.meta.epicKeys}</strong></span>
      <span class="mm-currency ancient-key" title="${t('ui.menu.tooltip.ancientKey')}"><span class="mm-res-icon key ancient"></span><strong>${opts.meta.ancientKeys}</strong></span>
    `;
    // RU/EN switcher in the top-right corner of the main menu (PR-9 i18n).
    topBar.appendChild(buildLangSwitcher(opts.meta, () => opts.onSettings()));
    wrap.appendChild(topBar);

    // Center content
    const center = document.createElement('div');
    center.className = 'mm-center';

    // Left column: My Shop + Laboratory + Settings
    const leftCol = document.createElement('div');
    leftCol.className = 'mm-left';

    // My Shop section — also doubles as the Alchemy crafting entry point.
    // Clicking the section (slots, title, or hint) opens the crafting overlay.
    const shopSection = document.createElement('button');
    shopSection.className = 'mm-section mm-shop mm-shop-btn';
    shopSection.type = 'button';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'mm-section-title mm-title-with-icon';
    shopTitle.innerHTML = `<span class="mm-shop-icon"></span><span>${t('ui.menu.shop')}</span><span class="mm-info-dot">i</span>`;
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
    const statsRow = document.createElement('div');
    statsRow.className = 'mm-stats';
    statsRow.innerHTML = `<span>${t('ui.menu.runs', { n: opts.meta.totalRuns })}</span><span>${t('ui.menu.bestWave', { n: opts.meta.bestWave })}</span>`;
    shopSection.appendChild(statsRow);
    shopSection.addEventListener('click', opts.onCrafting);
    leftCol.appendChild(shopSection);

    // Laboratory button
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-section mm-lab-btn';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-section-title';
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

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'mm-section mm-settings-btn';
    const settingsTitle = document.createElement('div');
    settingsTitle.className = 'mm-section-title';
    settingsTitle.innerHTML = `<span class="mm-gear-icon"></span><span>${t('ui.menu.settings')}</span>`;
    settingsBtn.addEventListener('click', opts.onSettings);
    settingsBtn.appendChild(settingsTitle);
    leftCol.appendChild(settingsBtn);

    center.appendChild(leftCol);

    // Middle: Title + illustration + TO BATTLE
    const midCol = document.createElement('div');
    midCol.className = 'mm-mid';
    const title = document.createElement('div');
    title.className = 'mm-title';
    title.innerHTML = `<span class="mm-title-top">${t('ui.menu.title.top')}</span><span class="mm-title-bottom">${t('ui.menu.title.bottom')}</span>`;
    midCol.appendChild(title);

    // Leaderboards button — placed directly under the logo so it's the first
    // thing the player sees after the title (between logo and the TO BATTLE
    // CTA), instead of being buried alongside the special-mode shortcuts.
    const lbBtn = document.createElement('button');
    lbBtn.className = 'mm-mode-btn mm-leaderboards mm-leaderboards-top';
    lbBtn.textContent = t('ui.menu.leaderboards');
    lbBtn.addEventListener('click', opts.onLeaderboards);
    midCol.appendChild(lbBtn);

    const battleBtn = document.createElement('button');
    battleBtn.className = 'mm-battle-btn';
    battleBtn.textContent = t('ui.menu.toBattle');
    battleBtn.addEventListener('click', opts.onBattle);
    midCol.appendChild(battleBtn);

    // Special mode buttons. Boss Challenge is now one of the rotating
    // Daily-Event days, so the standalone button has been removed; the
    // remaining "DAILY EXPERIMENT" entry shows today's event preview.
    const modeBtns = document.createElement('div');
    modeBtns.className = 'mm-mode-btns';

    const dailyBtn2 = document.createElement('button');
    dailyBtn2.className = 'mm-mode-btn mm-daily-exp';
    dailyBtn2.textContent = t('ui.menu.dailyExperiment');
    dailyBtn2.addEventListener('click', opts.onDailyExperiment);
    modeBtns.appendChild(dailyBtn2);

    midCol.appendChild(modeBtns);

    center.appendChild(midCol);

    // Right column: Battle Pass + Daily Rewards
    const rightCol = document.createElement('div');
    rightCol.className = 'mm-right';

    const bpBtn = document.createElement('button');
    bpBtn.className = 'mm-section mm-bp-btn';
    const bpTitle = document.createElement('div');
    bpTitle.className = 'mm-section-title';
    bpTitle.innerHTML = `<span>${t('ui.menu.battlePass')}</span><span class="mm-chest-icon"></span>`;
    bpBtn.appendChild(bpTitle);
    const bpSub = document.createElement('div');
    bpSub.className = 'mm-bp-sub';
    bpSub.innerHTML = `<span>${t('ui.menu.bpLevel', { level: opts.meta.bpLevel })}</span><span class="mm-mini-progress"><i style="width:${Math.min(100, (opts.meta.bpLevel / 50) * 100)}%"></i></span>`;
    bpBtn.appendChild(bpSub);
    bpBtn.addEventListener('click', opts.onBattlePass);
    rightCol.appendChild(bpBtn);

    const dailyBtn = document.createElement('button');
    dailyBtn.className = 'mm-section mm-daily-btn';
    const dailyTitle = document.createElement('div');
    dailyTitle.className = 'mm-section-title';
    dailyTitle.innerHTML = `<span>${t('ui.menu.dailyRewards').replace(/\n/g, '<br>')}</span><span class="mm-calendar-icon"></span>`;
    dailyBtn.appendChild(dailyTitle);
    if (canClaimDaily(opts.meta)) {
      const badge = document.createElement('div');
      badge.className = 'mm-daily-badge';
      badge.textContent = t('ui.menu.dailyClaim');
      dailyBtn.appendChild(badge);
    }
    dailyBtn.addEventListener('click', opts.onDailyRewards);
    rightCol.appendChild(dailyBtn);

    center.appendChild(rightCol);
    wrap.appendChild(center);
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
}

/** RU/EN locale switcher rendered in the top-right of the main menu (PR-9).
 *  Mirrors the slider in the Settings overlay so the player can flip the
 *  language without diving into a sub-menu. */
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
      // Re-render the menu by re-dispatching the existing onSettings hook —
      // safer than holding a ref to the original render fn. Caller refreshes.
      window.dispatchEvent(new CustomEvent('asd-locale-changed'));
    });
    wrap.appendChild(b);
  }
  return wrap;
}
