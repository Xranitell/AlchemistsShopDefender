import type { GameState } from '../game/state';
import { totalWaves } from '../game/wave';
import { getSprites } from '../render/sprites';
import type { BakedSprite } from '../render/sprite';

export interface HudHandlers {
  onPause(): void;
  onSkipPause(): void;
  onActivateOverload(): void;
}

// HUD layout matches the supplied reference image:
//   ┌──────────┐                ┌──────HP-bar──────┐                ┌──────────┐
//   │ WAVE 1/5 │                │ HP 120 / 120     │                │ GOLD 285 │
//   └──────────┘                └──────────────────┘                │ ESS  45  │
//                                                                   └──────────┘
//   ┌────────┐                                                  ┌──────┐ ┌──────┐
//   │ MAGNET │                                                  │ ABIL │ │ ODLD │
//   └────────┘                                                  └──────┘ └──────┘
export class Hud {
  private root: HTMLElement;
  private handlers: HudHandlers;

  // Top-left WAVE widget
  private waveValue!: HTMLSpanElement;

  // Top-center HP bar
  private hpFill!: HTMLDivElement;
  private hpLabel!: HTMLSpanElement;

  // Top-right gold / essence
  private goldLabel!: HTMLSpanElement;
  private essenceLabel!: HTMLSpanElement;

  // Bottom-left magnet info (loot radius indicator)
  // (Decorative for now, animates when picking up gold)
  private magnetButton!: HTMLDivElement;

  // Bottom-right ability / overload buttons
  private abilityButton!: HTMLButtonElement;
  private overloadButton!: HTMLButtonElement;
  private overloadFill!: HTMLDivElement;

  // Center-bottom hint + skip-wave (only during preparing phase)
  private hint!: HTMLDivElement;
  private skipBtn!: HTMLButtonElement;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.build();
  }

  private build(): void {
    this.root.innerHTML = '';

    // ────────────── TOP ROW ──────────────
    const top = document.createElement('div');
    top.className = 'hud-top';

    // Top-left: WAVE widget
    const waveBadge = badgeFrame('hud-wave-badge');
    const waveLabel = document.createElement('div');
    waveLabel.className = 'hud-tag-label';
    waveLabel.textContent = 'WAVE';
    this.waveValue = document.createElement('span');
    this.waveValue.className = 'hud-wave-value';
    this.waveValue.textContent = '1 / 5';
    const waveCol = document.createElement('div');
    waveCol.className = 'hud-wave-col';
    waveCol.appendChild(waveLabel);
    waveCol.appendChild(this.waveValue);
    waveBadge.appendChild(waveCol);
    waveBadge.appendChild(spriteEl(getSprites().iconWavePip, 4));
    top.appendChild(waveBadge);

    // Top-center: HP bar in metal frame
    const hpBadge = badgeFrame('hud-hp-badge');
    hpBadge.appendChild(spriteEl(getSprites().iconHpHeart, 4));
    const hpInner = document.createElement('div');
    hpInner.className = 'hud-hp-inner';
    const hpTagLabel = document.createElement('div');
    hpTagLabel.className = 'hud-tag-label hud-hp-label';
    hpTagLabel.textContent = 'HP';
    const hpBar = document.createElement('div');
    hpBar.className = 'hud-bar hud-hp-bar';
    this.hpFill = document.createElement('div');
    this.hpFill.className = 'hud-bar-fill hud-hp-fill';
    hpBar.appendChild(this.hpFill);
    this.hpLabel = document.createElement('span');
    this.hpLabel.className = 'hud-hp-label-num';
    this.hpLabel.textContent = '120 / 120';
    hpBar.appendChild(this.hpLabel);
    hpInner.appendChild(hpTagLabel);
    hpInner.appendChild(hpBar);
    hpBadge.appendChild(hpInner);
    top.appendChild(hpBadge);

    // Top-right: GOLD + ESSENCE stack
    const rightStack = document.createElement('div');
    rightStack.className = 'hud-right-stack';

    const goldBadge = badgeFrame('hud-resource-badge');
    goldBadge.appendChild(spriteEl(getSprites().iconCoin, 3));
    const goldInner = document.createElement('div');
    goldInner.className = 'hud-resource-inner';
    const goldLab = document.createElement('div');
    goldLab.className = 'hud-tag-label hud-tag-gold';
    goldLab.textContent = 'GOLD';
    this.goldLabel = document.createElement('span');
    this.goldLabel.className = 'hud-resource-value';
    this.goldLabel.textContent = '0';
    goldInner.appendChild(goldLab);
    goldInner.appendChild(this.goldLabel);
    goldBadge.appendChild(goldInner);
    rightStack.appendChild(goldBadge);

    const essBadge = badgeFrame('hud-resource-badge');
    essBadge.appendChild(spriteEl(getSprites().iconEssence, 3));
    const essInner = document.createElement('div');
    essInner.className = 'hud-resource-inner';
    const essLab = document.createElement('div');
    essLab.className = 'hud-tag-label hud-tag-essence';
    essLab.textContent = 'ESSENCE';
    this.essenceLabel = document.createElement('span');
    this.essenceLabel.className = 'hud-resource-value';
    this.essenceLabel.textContent = '0';
    essInner.appendChild(essLab);
    essInner.appendChild(this.essenceLabel);
    essBadge.appendChild(essInner);
    rightStack.appendChild(essBadge);

    top.appendChild(rightStack);

    // ────────────── BOTTOM ROW ──────────────
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom-row';

    // Bottom-left: MAGNET round button (loot radius indicator).
    this.magnetButton = roundIconButton('hud-icon-magnet');
    this.magnetButton.appendChild(spriteEl(getSprites().iconMagnet, 4));
    const magLabel = document.createElement('span');
    magLabel.className = 'hud-icon-label';
    magLabel.textContent = 'MAGNET';
    this.magnetButton.appendChild(magLabel);
    bottom.appendChild(this.magnetButton);

    // Bottom-center: hint + skip-wave button (during preparing phase only)
    const center = document.createElement('div');
    center.className = 'hud-center-bottom';
    this.hint = document.createElement('div');
    this.hint.className = 'hud-hint';
    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'hud-skip-btn';
    this.skipBtn.textContent = 'В БОЙ';
    this.skipBtn.addEventListener('click', () => this.handlers.onSkipPause());
    center.appendChild(this.hint);
    center.appendChild(this.skipBtn);
    bottom.appendChild(center);

    // Bottom-right: ABILITY + OVERLOAD round buttons
    const rightButtons = document.createElement('div');
    rightButtons.className = 'hud-bottom-right';

    this.abilityButton = document.createElement('button');
    this.abilityButton.className = 'hud-round-btn hud-round-ability';
    this.abilityButton.appendChild(spriteEl(getSprites().iconAbility, 4));
    const abLabel = document.createElement('span');
    abLabel.className = 'hud-icon-label';
    abLabel.textContent = 'ABILITY';
    this.abilityButton.appendChild(abLabel);
    rightButtons.appendChild(this.abilityButton);

    this.overloadButton = document.createElement('button');
    this.overloadButton.className = 'hud-round-btn hud-round-overload';
    this.overloadButton.appendChild(spriteEl(getSprites().iconLightning, 4));
    const olLabel = document.createElement('span');
    olLabel.className = 'hud-icon-label';
    olLabel.textContent = 'OVERLOAD';
    this.overloadButton.appendChild(olLabel);
    // Charge ring (visualised as a circular progress underneath)
    this.overloadFill = document.createElement('div');
    this.overloadFill.className = 'hud-overload-charge';
    this.overloadButton.appendChild(this.overloadFill);
    this.overloadButton.addEventListener('click', () => this.handlers.onActivateOverload());
    rightButtons.appendChild(this.overloadButton);

    bottom.appendChild(rightButtons);

    this.root.appendChild(top);
    this.root.appendChild(bottom);
  }

  update(state: GameState): void {
    const m = state.mannequin;
    const ratio = Math.max(0, m.hp / m.maxHp);
    this.hpFill.style.width = `${ratio * 100}%`;
    this.hpLabel.textContent = `${Math.max(0, Math.round(m.hp))} / ${m.maxHp}`;

    const o = state.overload;
    const ocharge = o.charge / o.maxCharge;
    this.overloadFill.style.background = `conic-gradient(var(--cool-glow) ${ocharge * 360}deg, transparent ${ocharge * 360}deg)`;

    this.goldLabel.textContent = `${state.gold}`;
    this.essenceLabel.textContent = `${state.essence}`;

    const ws = state.waveState;
    const idx = ws.currentIndex;
    const total = totalWaves();
    if (idx < 0) {
      this.waveValue.textContent = `0 / ${total}`;
    } else {
      this.waveValue.textContent = `${idx + 1} / ${total}`;
    }

    // Skip-wave button only active during preparing phase
    const showSkip = state.phase === 'preparing';
    this.skipBtn.style.display = showSkip ? '' : 'none';
    this.skipBtn.disabled = !showSkip;
    if (showSkip && idx < 0) {
      this.skipBtn.textContent = 'В БОЙ!';
    } else {
      this.skipBtn.textContent = 'СЛЕДУЮЩАЯ ВОЛНА';
    }

    // Overload button enabled when fully charged
    this.overloadButton.disabled = state.overload.charge < state.overload.maxCharge;
    this.overloadButton.classList.toggle('ready', state.overload.charge >= state.overload.maxCharge);

    // Hints
    if (state.phase === 'preparing') {
      const next = idx + 1;
      this.hint.textContent = next === 0
        ? 'Кликни по руне, чтобы поставить стойку. Готов? Жми «В БОЙ».'
        : `Готовься к волне ${next + 1}. Покупай и улучшай стойки на рунах.`;
    } else if (state.phase === 'wave') {
      const left = ws.timeInWave;
      this.hint.textContent = `Волна ${idx + 1}/${total} • ЛКМ — бросок • Q — Overload • ${left.toFixed(1)} с`;
    } else {
      this.hint.textContent = '';
    }
  }
}

function badgeFrame(extraClass: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `hud-badge ${extraClass}`;
  return el;
}

function roundIconButton(extraClass: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `hud-round-btn ${extraClass}`;
  return el;
}

// Embed a baked sprite as an HTMLCanvasElement scaled up via CSS image-rendering: pixelated.
function spriteEl(sprite: BakedSprite, scale: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = sprite.width;
  out.height = sprite.height;
  out.className = 'hud-sprite';
  const c = out.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(sprite.canvas, 0, 0);
  out.style.width = `${sprite.width * scale}px`;
  out.style.height = `${sprite.height * scale}px`;
  return out;
}
