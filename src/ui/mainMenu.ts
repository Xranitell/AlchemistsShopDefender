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
      <span class="mm-currency gold" title="Синяя эссенция">💎 <strong>${opts.meta.blueEssence}</strong></span>
      <span class="mm-currency essence" title="Древняя эссенция">🔮 <strong>${opts.meta.ancientEssence}</strong></span>
      <span class="mm-currency epic-key" title="Эпический ключ">🗝️ <strong>${opts.meta.epicKeys}</strong></span>
      <span class="mm-currency ancient-key" title="Древний ключ">🗝 <strong>${opts.meta.ancientKeys}</strong></span>
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

    // Middle: Title + illustration + TO BATTLE
    const midCol = document.createElement('div');
    midCol.className = 'mm-mid';
    const title = document.createElement('div');
    title.className = 'mm-title';
    title.innerHTML = "<span class=\"mm-title-top\">Alchemist's Shop</span><span class=\"mm-title-bottom\">Defender</span>";
    midCol.appendChild(title);

    // Central illustration — pixel-art style alchemist's shop with hero in front.
    const illu = document.createElement('div');
    illu.className = 'mm-illustration';
    illu.innerHTML = shopIllustrationSVG();
    midCol.appendChild(illu);

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

// Pixel-art-ish storefront illustration drawn in SVG so it ships with zero
// asset pipeline. Colours match the in-game palette (wood + copper + purple
// potions + warm lantern glow).
function shopIllustrationSVG(): string {
  return `<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <!-- Sky / twilight behind shop -->
    <defs>
      <radialGradient id="sky" cx="50%" cy="90%" r="80%">
        <stop offset="0%" stop-color="#3b2f52"/>
        <stop offset="100%" stop-color="#110a1f"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd27a" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#ffd27a" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="220" height="180" fill="url(#sky)"/>
    <!-- Moon -->
    <circle cx="178" cy="30" r="10" fill="#f5e0a0"/>
    <circle cx="174" cy="26" r="3" fill="#c6aa6a" opacity="0.6"/>

    <!-- Shop building -->
    <!-- roof -->
    <polygon points="28,78 110,38 192,78" fill="#5b3a22" stroke="#2b1a10" stroke-width="2"/>
    <polygon points="36,80 110,44 184,80" fill="#7a4f30"/>
    <!-- walls -->
    <rect x="40" y="78" width="140" height="84" fill="#d6b17a" stroke="#3f2d1a" stroke-width="2"/>
    <!-- timber frame -->
    <rect x="40" y="78" width="140" height="6" fill="#3f2d1a"/>
    <rect x="40" y="156" width="140" height="6" fill="#3f2d1a"/>
    <rect x="40" y="78" width="6" height="84" fill="#3f2d1a"/>
    <rect x="174" y="78" width="6" height="84" fill="#3f2d1a"/>
    <rect x="102" y="84" width="6" height="72" fill="#3f2d1a"/>
    <rect x="46" y="116" width="134" height="4" fill="#3f2d1a"/>

    <!-- Big shop window -->
    <rect x="52" y="90" width="44" height="22" fill="#223c52" stroke="#1a2a3a" stroke-width="1"/>
    <line x1="74" y1="90" x2="74" y2="112" stroke="#4a718f" stroke-width="1"/>
    <line x1="52" y1="101" x2="96" y2="101" stroke="#4a718f" stroke-width="1"/>
    <!-- tiny potion silhouettes in window -->
    <circle cx="62" cy="104" r="3" fill="#7df9ff"/>
    <circle cx="72" cy="106" r="2" fill="#ff6a3d"/>
    <circle cx="82" cy="104" r="3" fill="#c084fc"/>
    <circle cx="90" cy="106" r="2" fill="#a3e36a"/>

    <!-- Door -->
    <rect x="116" y="100" width="44" height="56" fill="#4a2e1a" stroke="#2b1a10" stroke-width="2"/>
    <rect x="120" y="104" width="36" height="6" fill="#7a4f30"/>
    <circle cx="154" cy="128" r="2" fill="#ffd166"/>
    <!-- hanging sign -->
    <rect x="124" y="78" width="28" height="14" fill="#3f2d1a"/>
    <rect x="126" y="80" width="24" height="10" fill="#d6b17a"/>
    <text x="138" y="88" text-anchor="middle" font-size="7" font-family="monospace" fill="#3f2d1a">⚗</text>

    <!-- Lantern glow -->
    <circle cx="100" cy="96" r="18" fill="url(#glow)"/>
    <circle cx="100" cy="96" r="2" fill="#ffd166"/>

    <!-- Chimney + smoke -->
    <rect x="150" y="52" width="10" height="18" fill="#3f2d1a"/>
    <ellipse cx="154" cy="48" rx="6" ry="3" fill="#8a8a9e" opacity="0.5"/>
    <ellipse cx="160" cy="40" rx="5" ry="2.5" fill="#8a8a9e" opacity="0.35"/>

    <!-- Barrel + crates outside door -->
    <rect x="30" y="140" width="16" height="20" fill="#6a4020" stroke="#2b1a10" stroke-width="1"/>
    <line x1="30" y1="146" x2="46" y2="146" stroke="#2b1a10"/>
    <line x1="30" y1="154" x2="46" y2="154" stroke="#2b1a10"/>
    <rect x="172" y="142" width="18" height="18" fill="#a87a46" stroke="#2b1a10" stroke-width="1"/>
    <line x1="172" y1="151" x2="190" y2="151" stroke="#2b1a10"/>
    <line x1="181" y1="142" x2="181" y2="160" stroke="#2b1a10"/>

    <!-- Cobblestone ground -->
    <rect x="0" y="160" width="220" height="20" fill="#2b2236"/>
    <ellipse cx="30" cy="170" rx="10" ry="3" fill="#3a3148"/>
    <ellipse cx="70" cy="172" rx="14" ry="3" fill="#3a3148"/>
    <ellipse cx="120" cy="170" rx="12" ry="3" fill="#3a3148"/>
    <ellipse cx="170" cy="172" rx="14" ry="3" fill="#3a3148"/>
  </svg>`;
}
