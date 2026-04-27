import type { MetaSave } from '../game/save';
import { canClaimDaily } from '../game/save';

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
  }): void {
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'main-menu';

    // Top bar — currencies
    const topBar = document.createElement('div');
    topBar.className = 'mm-top-bar';
    topBar.innerHTML = `
      <span class="mm-currency gold">💎 <strong>${opts.meta.blueEssence}</strong></span>
      <span class="mm-currency essence">🔮 <strong>${opts.meta.ancientEssence}</strong></span>
      <span class="mm-currency keys">🗝️ <strong>${opts.meta.keys}</strong></span>
    `;
    wrap.appendChild(topBar);

    // Center content
    const center = document.createElement('div');
    center.className = 'mm-center';

    // Left column: My Shop + Laboratory + Settings
    const leftCol = document.createElement('div');
    leftCol.className = 'mm-left';

    // My Shop section
    const shopSection = document.createElement('div');
    shopSection.className = 'mm-section mm-shop';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'mm-section-title';
    shopTitle.textContent = 'Моя лавка';
    shopSection.appendChild(shopTitle);
    const craftLevel = document.createElement('div');
    craftLevel.className = 'mm-craft-level';
    craftLevel.textContent = `Ур. крафта ${opts.meta.craftingLevel}`;
    shopSection.appendChild(craftLevel);
    const statsRow = document.createElement('div');
    statsRow.className = 'mm-stats';
    statsRow.innerHTML = `<span>Забегов: ${opts.meta.totalRuns}</span><span>Лучшая: ${opts.meta.bestWave}</span>`;
    shopSection.appendChild(statsRow);
    leftCol.appendChild(shopSection);

    // Laboratory button
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-section mm-lab-btn';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-section-title';
    labTitle.textContent = 'Лаборатория';
    labBtn.appendChild(labTitle);
    const labDesc = document.createElement('div');
    labDesc.className = 'mm-lab-desc';
    labDesc.textContent = 'Дерево Манекена';
    labBtn.appendChild(labDesc);
    labBtn.addEventListener('click', opts.onLaboratory);
    leftCol.appendChild(labBtn);

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'mm-section mm-settings-btn';
    const settingsTitle = document.createElement('div');
    settingsTitle.className = 'mm-section-title';
    settingsTitle.textContent = 'Настройки';
    settingsBtn.addEventListener('click', opts.onSettings);
    settingsBtn.appendChild(settingsTitle);
    leftCol.appendChild(settingsBtn);

    center.appendChild(leftCol);

    // Middle: Title + TO BATTLE
    const midCol = document.createElement('div');
    midCol.className = 'mm-mid';
    const title = document.createElement('div');
    title.className = 'mm-title';
    title.innerHTML = "<span class=\"mm-title-top\">Alchemist's Shop</span><span class=\"mm-title-bottom\">Defender</span>";
    midCol.appendChild(title);

    const battleBtn = document.createElement('button');
    battleBtn.className = 'mm-battle-btn';
    battleBtn.textContent = 'В бой!';
    battleBtn.addEventListener('click', opts.onBattle);
    midCol.appendChild(battleBtn);

    center.appendChild(midCol);

    // Right column: Battle Pass + Daily Rewards
    const rightCol = document.createElement('div');
    rightCol.className = 'mm-right';

    const bpBtn = document.createElement('button');
    bpBtn.className = 'mm-section mm-bp-btn';
    const bpTitle = document.createElement('div');
    bpTitle.className = 'mm-section-title';
    bpTitle.textContent = 'Battle Pass';
    bpBtn.appendChild(bpTitle);
    const bpSub = document.createElement('div');
    bpSub.className = 'mm-bp-sub';
    bpSub.textContent = `Ур. ${opts.meta.bpLevel}`;
    bpBtn.appendChild(bpSub);
    bpBtn.addEventListener('click', opts.onBattlePass);
    rightCol.appendChild(bpBtn);

    const dailyBtn = document.createElement('button');
    dailyBtn.className = 'mm-section mm-daily-btn';
    const dailyTitle = document.createElement('div');
    dailyTitle.className = 'mm-section-title';
    dailyTitle.textContent = 'Награды';
    dailyBtn.appendChild(dailyTitle);
    if (canClaimDaily(opts.meta)) {
      const badge = document.createElement('div');
      badge.className = 'mm-daily-badge';
      badge.textContent = 'Забрать!';
      dailyBtn.appendChild(badge);
    }
    dailyBtn.addEventListener('click', opts.onDailyRewards);
    rightCol.appendChild(dailyBtn);

    center.appendChild(rightCol);
    wrap.appendChild(center);
    this.root.appendChild(wrap);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}
