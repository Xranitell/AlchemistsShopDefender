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
      <span class="mm-currency blue-essence" title="Синяя эссенция"><span class="mm-res-icon blue-essence"></span><strong>${opts.meta.blueEssence}</strong></span>
      <span class="mm-currency ancient-essence" title="Древняя эссенция"><span class="mm-res-icon ancient-essence"></span><strong>${opts.meta.ancientEssence}</strong></span>
      <span class="mm-currency epic-key" title="Эпический ключ"><span class="mm-res-icon key epic"></span><strong>${opts.meta.epicKeys}</strong></span>
      <span class="mm-currency ancient-key" title="Древний ключ"><span class="mm-res-icon key ancient"></span><strong>${opts.meta.ancientKeys}</strong></span>
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
    shopTitle.className = 'mm-section-title mm-title-with-icon';
    shopTitle.innerHTML = '<span class="mm-shop-icon"></span><span>MY SHOP</span><span class="mm-info-dot">i</span>';
    shopSection.appendChild(shopTitle);
    const slotRow = document.createElement('div');
    slotRow.className = 'mm-shop-slots';
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = `mm-shop-slot ${i === 0 ? 'filled' : ''}`;
      if (i === 0) slot.innerHTML = '<span class="mm-slot-potion"></span>';
      slotRow.appendChild(slot);
    }
    shopSection.appendChild(slotRow);
    const craftLevel = document.createElement('div');
    craftLevel.className = 'mm-craft-level';
    craftLevel.innerHTML = `<span>CRAFTING LEVEL ${opts.meta.craftingLevel}</span><span class="mm-craft-bar"><i style="width:${Math.min(100, 24 + opts.meta.craftingLevel * 8)}%"></i></span>`;
    shopSection.appendChild(craftLevel);
    const statsRow = document.createElement('div');
    statsRow.className = 'mm-stats';
    statsRow.innerHTML = `<span>RUNS ${opts.meta.totalRuns}</span><span>BEST WAVE ${opts.meta.bestWave}</span>`;
    shopSection.appendChild(statsRow);
    leftCol.appendChild(shopSection);

    // Laboratory button
    const labBtn = document.createElement('button');
    labBtn.className = 'mm-section mm-lab-btn';
    const labTitle = document.createElement('div');
    labTitle.className = 'mm-section-title';
    labTitle.innerHTML = '<span class="mm-flask-icon"></span><span>LABORATORY</span>';
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
    settingsTitle.innerHTML = '<span class="mm-gear-icon"></span><span>SETTINGS</span>';
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
    battleBtn.textContent = 'TO BATTLE';
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
    bpTitle.innerHTML = '<span>BATTLE PASS</span><span class="mm-chest-icon"></span>';
    bpBtn.appendChild(bpTitle);
    const bpSub = document.createElement('div');
    bpSub.className = 'mm-bp-sub';
    bpSub.innerHTML = `<span>LEVEL ${opts.meta.bpLevel}</span><span class="mm-mini-progress"><i style="width:${Math.min(100, (opts.meta.bpLevel / 50) * 100)}%"></i></span>`;
    bpBtn.appendChild(bpSub);
    bpBtn.addEventListener('click', opts.onBattlePass);
    rightCol.appendChild(bpBtn);

    const dailyBtn = document.createElement('button');
    dailyBtn.className = 'mm-section mm-daily-btn';
    const dailyTitle = document.createElement('div');
    dailyTitle.className = 'mm-section-title';
    dailyTitle.innerHTML = '<span>DAILY<br>REWARDS</span><span class="mm-calendar-icon"></span>';
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
    <defs>
      <radialGradient id="sky" cx="50%" cy="48%" r="72%">
        <stop offset="0%" stop-color="#27445b"/>
        <stop offset="58%" stop-color="#121a2a"/>
        <stop offset="100%" stop-color="#080b12"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd27a" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#ffd27a" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="220" height="180" fill="url(#sky)"/>
    <ellipse cx="110" cy="139" rx="76" ry="26" fill="#151c2c"/>
    <polygon points="56,122 110,96 164,122 110,154" fill="#4d596f"/>
    <polygon points="56,122 110,154 110,166 48,132" fill="#2c3448"/>
    <polygon points="164,122 110,154 110,166 172,132" fill="#242b3d"/>
    <polygon points="62,120 110,98 158,120 110,147" fill="#758096"/>
    <polyline points="72,122 110,104 148,122" fill="none" stroke="#9ba6bb" stroke-width="2"/>
    <polyline points="82,128 110,115 138,128" fill="none" stroke="#59657f" stroke-width="2"/>
    <polygon points="74,92 110,64 146,92 110,112" fill="#9a5a2a" stroke="#2a1810" stroke-width="3"/>
    <polygon points="82,92 110,70 138,92 110,107" fill="#c07a3e"/>
    <polygon points="78,94 110,111 110,143 78,126" fill="#6b4026" stroke="#2a1810" stroke-width="2"/>
    <polygon points="142,94 110,111 110,143 142,126" fill="#8a5a30" stroke="#2a1810" stroke-width="2"/>
    <polygon points="92,102 110,111 110,136 92,127" fill="#2a1810"/>
    <polygon points="119,106 134,99 134,122 119,130" fill="#24445d" stroke="#182436" stroke-width="2"/>
    <rect x="74" y="113" width="9" height="28" fill="#5a3622"/>
    <rect x="137" y="112" width="8" height="27" fill="#5a3622"/>
    <rect x="100" y="53" width="9" height="16" fill="#454a60" stroke="#1a1d28" stroke-width="2"/>
    <ellipse cx="103" cy="49" rx="7" ry="3" fill="#9c8a90" opacity="0.6"/>
    <circle cx="126" cy="112" r="12" fill="url(#glow)"/>
    <rect x="124" y="111" width="4" height="7" fill="#ffd166"/>
    <rect x="65" y="128" width="12" height="19" fill="#8a5a30" stroke="#2a1810" stroke-width="2"/>
    <rect x="145" y="130" width="18" height="17" fill="#b78250" stroke="#2a1810" stroke-width="2"/>
    <circle cx="89" cy="136" r="3" fill="#7df9ff"/>
    <circle cx="133" cy="132" r="3" fill="#c084fc"/>
    <circle cx="153" cy="139" r="3" fill="#4fd36a"/>
    <rect x="44" y="137" width="26" height="12" fill="#2a344c" opacity="0.65"/>
    <rect x="154" y="137" width="26" height="12" fill="#2a344c" opacity="0.65"/>
  </svg>`;
}
