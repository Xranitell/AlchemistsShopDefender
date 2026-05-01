import type { GameState } from '../game/state';
import { totalWaves, currentWaveDuration, currentPauseDuration, isNextWaveBoss } from '../game/wave';
import { getSprites } from '../render/sprites';
import type { BakedSprite } from '../render/sprite';
import { DIFFICULTY_MODES } from '../data/difficulty';
import {
  POTION_BY_ID,
  POTION_INVENTORY_SIZE,
  type PotionRecipe,
} from '../data/potions';
import { t } from '../i18n';

export interface HudHandlers {
  onPause(): void;
  onSkipPause(): void;
  onActivateOverload(): void;
  onActivateMagnet(): void;
  onUsePotion(slot: number): void;
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
  /** Ribbon under the WAVE widget showing the current difficulty. */
  private difficultyBadge!: HTMLDivElement;

  // Top-right pause button (also drives the keyboard shortcut). Holds its
  // own paused/playing state so the icon and aria-label stay in sync with
  // whatever the host code reports through `setPaused`.
  private pauseButton!: HTMLButtonElement;
  private isPaused = false;

  // Top-center HP bar
  private hpFill!: HTMLDivElement;
  private hpLabel!: HTMLSpanElement;

  // Top-right gold / essence
  private goldLabel!: HTMLSpanElement;
  private essenceLabel!: HTMLSpanElement;
  private catalystBadge!: HTMLDivElement;
  private catalystValue!: HTMLSpanElement;

  // (Magnet button removed — auto-magnet is always active)

  // Bottom-right ability / overload buttons
  private abilityButton!: HTMLButtonElement;
  private overloadButton!: HTMLButtonElement;
  private overloadFill!: HTMLDivElement;
  private overloadModule!: HTMLSpanElement;

  // Center-bottom hint + skip-wave (only during preparing phase)
  private hint!: HTMLDivElement;
  private skipBtn!: HTMLButtonElement;

  // Wave / pause timer bar (just below the WAVE badge)
  private timerBar!: HTMLDivElement;
  private timerFill!: HTMLDivElement;
  private timerLabel!: HTMLSpanElement;

  // Boss wave indicator (shown during preparing phase when next wave has a boss)
  private bossIndicator!: HTMLDivElement;

  // Bottom-center crafted-potion inventory (4 slots) + active-effect chips
  private potionBar!: HTMLDivElement;
  private potionSlots: HTMLButtonElement[] = [];
  private effectsBar!: HTMLDivElement;

  // Diff cache: HUD.update is called every render frame (60Hz). Without this
  // we'd write to `style.width`, `style.background` (conic-gradient) and
  // `innerHTML` regardless of whether the value actually changed, which
  // forces the browser to re-style/relayout/repaint the HUD every frame.
  private prevHpRatio = -1;
  private prevHpLabel = '';
  private prevOverloadDeg = -1;
  private prevGold = -1;
  private prevEssence = -1;
  private prevWaveValue = '';
  private prevCatalystVisible = -1; // -1 = unset, 0 = hidden, 1 = visible
  private prevCatalystValue = '';
  private prevDifficulty = '';
  private prevDifficultyHidden = -1;
  private prevSkipVisible = -1;
  private prevSkipText = '';
  private prevOverloadDisabled: boolean | null = null;
  private prevOverloadReady: boolean | null = null;
  private prevOverloadModule = '';
  private prevHint = '';
  private prevBossVisible = -1;
  private prevTimerBarDisplay = '';
  private prevTimerFillRatio = -1;
  private prevTimerLabel = '';
  private prevTimerClass = '';
  private prevPotionInteractive = -1;
  private prevPotionState: Array<string | null> = [];
  private prevEffectsHtml = '';

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
    // Wrap wave badge + difficulty ribbon into a single vertical stack so
    // the difficulty sits directly under the wave number.
    const waveStack = document.createElement('div');
    waveStack.className = 'hud-wave-stack';
    waveStack.appendChild(waveBadge);
    this.difficultyBadge = document.createElement('div');
    this.difficultyBadge.className = 'hud-difficulty-badge';
    waveStack.appendChild(this.difficultyBadge);

    // Wave / pause progress bar — shows time-left during a wave and a
    // count-down to the next wave during the preparing phase.
    this.timerBar = document.createElement('div');
    this.timerBar.className = 'hud-timer-bar';
    this.timerFill = document.createElement('div');
    this.timerFill.className = 'hud-timer-fill';
    this.timerLabel = document.createElement('span');
    this.timerLabel.className = 'hud-timer-label';
    this.timerBar.appendChild(this.timerFill);
    this.timerBar.appendChild(this.timerLabel);
    waveStack.appendChild(this.timerBar);

    top.appendChild(waveStack);

    // Boss wave warning indicator — appended to HUD root so it's centered on screen
    this.bossIndicator = document.createElement('div');
    this.bossIndicator.className = 'hud-boss-indicator';
    this.bossIndicator.textContent = t('ui.hud.bossIncoming');
    this.bossIndicator.style.display = 'none';
    this.root.appendChild(this.bossIndicator);

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

    // Catalyst slot counter: shows N/M (equipped/total). Hidden when no slots.
    this.catalystBadge = document.createElement('div');
    this.catalystBadge.className = 'hud-catalyst-badge';
    const catLab = document.createElement('div');
    catLab.className = 'hud-tag-label';
    catLab.textContent = t('ui.hud.catalysts');
    this.catalystValue = document.createElement('span');
    this.catalystValue.className = 'hud-resource-value';
    this.catalystValue.textContent = '0/0';
    this.catalystBadge.appendChild(catLab);
    this.catalystBadge.appendChild(this.catalystValue);
    rightStack.appendChild(this.catalystBadge);

    // Pause button — sits in the top-right corner, above the resource stack.
    // Tapping it toggles the run pause state via the `onPause` handler so
    // the same control works on desktop and mobile.
    this.pauseButton = document.createElement('button');
    this.pauseButton.className = 'hud-pause-btn';
    this.pauseButton.type = 'button';
    this.pauseButton.setAttribute('aria-label', t('ui.hud.pause'));
    this.pauseButton.title = t('ui.hud.pause');
    this.pauseButton.textContent = '❚❚';
    this.pauseButton.addEventListener('click', () => this.handlers.onPause());
    rightStack.appendChild(this.pauseButton);

    top.appendChild(rightStack);

    // ────────────── BOTTOM ROW ──────────────
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom-row';

    // Magnet button removed — auto-magnet is always active.

    // Bottom-center: hint + skip-wave button (during preparing phase only)
    const center = document.createElement('div');
    center.className = 'hud-center-bottom';
    this.hint = document.createElement('div');
    this.hint.className = 'hud-hint';
    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'hud-skip-btn';
    this.skipBtn.textContent = t('ui.hud.toBattle');
    this.skipBtn.addEventListener('click', () => this.handlers.onSkipPause());
    center.appendChild(this.hint);
    center.appendChild(this.skipBtn);

    // Active-effect chips (timed potions). Sit just above the inventory row.
    this.effectsBar = document.createElement('div');
    this.effectsBar.className = 'hud-potion-effects';
    center.appendChild(this.effectsBar);

    // Crafted-potion inventory (4 buttons, mobile-friendly).
    this.potionBar = document.createElement('div');
    this.potionBar.className = 'hud-potion-bar';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const btn = document.createElement('button');
      btn.className = 'hud-potion-slot';
      btn.dataset.slot = String(i);
      btn.disabled = true;
      // Fire on pointerdown so the action triggers on the very first frame
      // the user touches the slot — `click` can be flaky when the button is
      // briefly enabled/disabled across renders or when other overlays steal
      // focus mid-press. We track a per-slot "consumed-this-press" flag so
      // the synthetic `click` that follows doesn't double-fire.
      let pressedThisGesture = false;
      btn.addEventListener('pointerdown', (ev) => {
        if (btn.disabled) return;
        ev.preventDefault();
        ev.stopPropagation();
        pressedThisGesture = true;
        this.handlers.onUsePotion(i);
      });
      btn.addEventListener('click', (ev) => {
        if (pressedThisGesture) {
          pressedThisGesture = false;
          ev.preventDefault();
          return;
        }
        if (btn.disabled) return;
        this.handlers.onUsePotion(i);
      });
      this.potionSlots.push(btn);
      this.potionBar.appendChild(btn);
    }
    center.appendChild(this.potionBar);

    bottom.appendChild(center);

    // Bottom-right: ABILITY + OVERLOAD round buttons
    const rightButtons = document.createElement('div');
    rightButtons.className = 'hud-bottom-right';

    this.abilityButton = document.createElement('button');
    this.abilityButton.className = 'hud-round-btn hud-round-ability';
    this.abilityButton.appendChild(spriteEl(getSprites().iconAbility, 4));
    const abLabel = document.createElement('span');
    abLabel.className = 'hud-icon-label';
    abLabel.textContent = t('ui.hud.ability');
    this.abilityButton.appendChild(abLabel);
    this.abilityButton.disabled = true;
    this.abilityButton.title = t('ui.hud.abilityComingSoon');
    rightButtons.appendChild(this.abilityButton);

    this.overloadButton = document.createElement('button');
    this.overloadButton.className = 'hud-round-btn hud-round-overload';
    this.overloadButton.dataset.tutorialTarget = 'overload';
    this.overloadButton.appendChild(spriteEl(getSprites().iconLightning, 4));
    const olLabel = document.createElement('span');
    olLabel.className = 'hud-icon-label';
    olLabel.textContent = t('ui.hud.overload');
    this.overloadButton.appendChild(olLabel);
    this.overloadModule = document.createElement('span');
    this.overloadModule.className = 'hud-overload-module';
    this.overloadButton.appendChild(this.overloadModule);
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
    // Quantise to 0.1% so we don't churn the DOM for sub-pixel HP changes.
    const ratioRounded = Math.round(ratio * 1000) / 1000;
    if (ratioRounded !== this.prevHpRatio) {
      this.hpFill.style.width = `${ratioRounded * 100}%`;
      this.prevHpRatio = ratioRounded;
    }
    const hpLabel = `${Math.max(0, Math.round(m.hp))} / ${m.maxHp}`;
    if (hpLabel !== this.prevHpLabel) {
      this.hpLabel.textContent = hpLabel;
      this.prevHpLabel = hpLabel;
    }

    const o = state.overload;
    const ocharge = o.charge / o.maxCharge;
    // Round to whole degrees — conic-gradient changes below 1° are invisible
    // but every write triggers a full repaint of the overload ring.
    const odeg = Math.round(ocharge * 360);
    if (odeg !== this.prevOverloadDeg) {
      this.overloadFill.style.background = `conic-gradient(var(--cool-glow) ${odeg}deg, transparent ${odeg}deg)`;
      this.prevOverloadDeg = odeg;
    }

    if (state.gold !== this.prevGold) {
      this.goldLabel.textContent = `${state.gold}`;
      this.prevGold = state.gold;
    }
    if (state.essence !== this.prevEssence) {
      this.essenceLabel.textContent = `${state.essence}`;
      this.prevEssence = state.essence;
    }

    // Catalyst counter — show only when there's at least 1 slot.
    if (state.catalystSlots > 0) {
      if (this.prevCatalystVisible !== 1) {
        this.catalystBadge.style.display = '';
        this.prevCatalystVisible = 1;
      }
      const cv = `${state.equippedCatalysts.length}/${state.catalystSlots}`;
      if (cv !== this.prevCatalystValue) {
        this.catalystValue.textContent = cv;
        this.prevCatalystValue = cv;
      }
    } else if (this.prevCatalystVisible !== 0) {
      this.catalystBadge.style.display = 'none';
      this.prevCatalystVisible = 0;
    }

    const ws = state.waveState;
    const idx = ws.currentIndex;
    const total = totalWaves(state);
    let waveText: string;
    if (state.difficulty === 'endless') {
      const loop = state.endlessLoop;
      waveText = `${idx + 1} • ${t('ui.hud.loop', { n: loop + 1 })}`;
    } else if (idx < 0) {
      waveText = `0 / ${total}`;
    } else {
      waveText = `${idx + 1} / ${total}`;
    }
    if (waveText !== this.prevWaveValue) {
      this.waveValue.textContent = waveText;
      this.prevWaveValue = waveText;
    }

    if (state.difficulty !== this.prevDifficulty) {
      const difDef = DIFFICULTY_MODES[state.difficulty];
      this.difficultyBadge.textContent = t(`ui.difficulty.${state.difficulty}.short`);
      this.difficultyBadge.style.color = difDef.color;
      this.difficultyBadge.style.borderColor = difDef.color;
      this.prevDifficulty = state.difficulty;
    }
    const difHidden = state.difficulty === 'normal' ? 1 : 0;
    if (difHidden !== this.prevDifficultyHidden) {
      this.difficultyBadge.style.display = difHidden ? 'none' : '';
      this.prevDifficultyHidden = difHidden;
    }

    // Skip-wave button only active during preparing phase
    const showSkip = state.phase === 'preparing';
    const showSkipFlag = showSkip ? 1 : 0;
    if (showSkipFlag !== this.prevSkipVisible) {
      this.skipBtn.style.display = showSkip ? '' : 'none';
      this.skipBtn.disabled = !showSkip;
      this.prevSkipVisible = showSkipFlag;
    }
    const skipText = (showSkip && idx < 0) ? t('ui.hud.toBattleNow') : t('ui.hud.nextWave');
    if (skipText !== this.prevSkipText) {
      this.skipBtn.textContent = skipText;
      this.prevSkipText = skipText;
    }

    // Overload button enabled when fully charged
    const overloadDisabled = state.overload.charge < state.overload.maxCharge;
    if (overloadDisabled !== this.prevOverloadDisabled) {
      this.overloadButton.disabled = overloadDisabled;
      this.prevOverloadDisabled = overloadDisabled;
    }
    const overloadReady = !overloadDisabled;
    if (overloadReady !== this.prevOverloadReady) {
      this.overloadButton.classList.toggle('ready', overloadReady);
      this.prevOverloadReady = overloadReady;
    }
    const moduleLabel = activeModuleShortLabel(state.activeModuleId);
    if (moduleLabel !== this.prevOverloadModule) {
      this.overloadModule.textContent = moduleLabel;
      this.prevOverloadModule = moduleLabel;
    }

    // Hints
    let hintText: string;
    if (state.phase === 'preparing') {
      const next = idx + 1;
      hintText = next === 0
        ? t('ui.hud.hint.first')
        : t('ui.hud.hint.next', { n: next + 1 });
    } else if (state.phase === 'wave') {
      hintText = t('ui.hud.hint.wave', { idx: idx + 1, total });
    } else {
      hintText = '';
    }
    if (hintText !== this.prevHint) {
      this.hint.textContent = hintText;
      this.prevHint = hintText;
    }

    // Boss wave indicator
    const showBoss = state.phase === 'preparing' && isNextWaveBoss(state) ? 1 : 0;
    if (showBoss !== this.prevBossVisible) {
      this.bossIndicator.style.display = showBoss ? '' : 'none';
      this.prevBossVisible = showBoss;
    }

    // Wave / pause progress bar. Shown during 'wave' and 'preparing' only.
    this.updateTimerBar(state);

    // Crafted-potion inventory + active-effect chips.
    this.updatePotionBar(state);
  }

  /** Sync the pause button visual state with the host's run pause flag. */
  setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!this.pauseButton) return;
    this.pauseButton.classList.toggle('paused', paused);
    if (paused) {
      this.pauseButton.textContent = '▶';
      this.pauseButton.setAttribute('aria-label', t('ui.hud.resume'));
      this.pauseButton.title = t('ui.hud.resume');
    } else {
      this.pauseButton.textContent = '❚❚';
      this.pauseButton.setAttribute('aria-label', t('ui.hud.pause'));
      this.pauseButton.title = t('ui.hud.pause');
    }
  }

  /** Whether the HUD currently displays the paused state. */
  paused(): boolean {
    return this.isPaused;
  }

  private updatePotionBar(state: GameState): void {
    const interactive = state.phase === 'wave' || state.phase === 'preparing';
    const interactiveFlag = interactive ? 1 : 0;
    if (interactiveFlag !== this.prevPotionInteractive) {
      this.potionBar.style.display = interactive ? '' : 'none';
      this.effectsBar.style.display = interactive ? '' : 'none';
      this.prevPotionInteractive = interactiveFlag;
    }
    if (!interactive) return;

    // Potion slots: only re-render the slot when the recipe id changed.
    for (let i = 0; i < this.potionSlots.length; i++) {
      const btn = this.potionSlots[i]!;
      const id = state.inventory[i];
      const key = id ? id : '__empty__';
      if (this.prevPotionState[i] === key) continue;
      this.prevPotionState[i] = key;
      const recipe = id ? POTION_BY_ID[id] : null;
      btn.disabled = !recipe;
      if (recipe) {
        btn.style.color = recipe.color;
        btn.classList.add('filled');
        btn.title = `[${i + 1}] ${t(`${recipe.i18nKey}.name`)} — ${t(`${recipe.i18nKey}.desc`)}`;
        btn.innerHTML = `<span class="hud-potion-glyph">${recipe.glyph}</span><span class="hud-potion-key">${i + 1}</span>`;
      } else {
        btn.classList.remove('filled');
        btn.style.color = '';
        btn.title = t('ui.hud.potionEmpty');
        btn.innerHTML = `<span class="hud-potion-glyph hud-potion-empty">·</span><span class="hud-potion-key">${i + 1}</span>`;
      }
    }

    // Effect chips: timed potions + storm charges + shield HP. Build the
    // HTML in a string buffer and only write innerHTML when it actually
    // changed — `innerHTML` triggers a full re-parse + reflow each call.
    let chipsHtml = '';
    for (const ap of state.activePotions) {
      const recipe: PotionRecipe | undefined = POTION_BY_ID[ap.id];
      if (!recipe) continue;
      const sec = Math.max(0, ap.timeLeft).toFixed(0);
      chipsHtml +=
        `<span class="hud-effect-chip" style="border-color:${recipe.color};color:${recipe.color}"><span>${recipe.glyph}</span><span>${sec}s</span></span>`;
    }
    if (state.stormCharges > 0) {
      const r = POTION_BY_ID['storm']!;
      chipsHtml +=
        `<span class="hud-effect-chip" style="border-color:${r.color};color:${r.color}"><span>${r.glyph}</span><span>${state.stormCharges}×</span></span>`;
    }
    if (state.potionShieldHp > 0) {
      const r = POTION_BY_ID['stoneShield']!;
      chipsHtml +=
        `<span class="hud-effect-chip" style="border-color:${r.color};color:${r.color}"><span>${r.glyph}</span><span>${Math.round(state.potionShieldHp)}HP</span></span>`;
    }
    if (chipsHtml !== this.prevEffectsHtml) {
      this.effectsBar.innerHTML = chipsHtml;
      this.prevEffectsHtml = chipsHtml;
    }
  }

  private updateTimerBar(state: GameState): void {
    const ws = state.waveState;
    let display: string;
    let classMode = '';
    let ratioRounded = -1;
    let label = '';

    if (state.phase === 'wave') {
      const total = currentWaveDuration(state);
      const elapsed = Math.max(0, ws.timeInWave);
      const ratio = total > 0 ? Math.min(1, elapsed / total) : 0;
      display = '';
      classMode = 'wave';
      ratioRounded = Math.round(ratio * 1000) / 1000;
      const left = Math.max(0, total - elapsed);
      label = t('ui.hud.timer.battle', { sec: left.toFixed(1) });
    } else if (state.phase === 'preparing') {
      const total = currentPauseDuration(state);
      const left = Math.max(0, ws.pauseDurationLeft);
      const ratio = total > 0 ? 1 - Math.min(1, left / total) : 0;
      display = '';
      classMode = 'pause';
      ratioRounded = Math.round(ratio * 1000) / 1000;
      label = t('ui.hud.timer.pause', { sec: left.toFixed(1) });
    } else {
      display = 'none';
    }

    if (display !== this.prevTimerBarDisplay) {
      this.timerBar.style.display = display;
      this.prevTimerBarDisplay = display;
    }
    if (display === 'none') return;

    if (classMode !== this.prevTimerClass) {
      this.timerBar.classList.toggle('wave', classMode === 'wave');
      this.timerBar.classList.toggle('pause', classMode === 'pause');
      this.prevTimerClass = classMode;
    }
    if (ratioRounded !== this.prevTimerFillRatio) {
      this.timerFill.style.width = `${ratioRounded * 100}%`;
      this.prevTimerFillRatio = ratioRounded;
    }
    if (label !== this.prevTimerLabel) {
      this.timerLabel.textContent = label;
      this.prevTimerLabel = label;
    }
  }
}

function badgeFrame(extraClass: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `hud-badge ${extraClass}`;
  return el;
}

export function roundIconButton(extraClass: string): HTMLDivElement {
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

function activeModuleShortLabel(id: string): string {
  switch (id) {
    case 'lightning': return t('ui.hud.module.lightning');
    case 'chronos': return t('ui.hud.module.chronos');
    case 'transmute': return t('ui.hud.module.transmute');
    case 'alch_dome': return t('ui.hud.module.alch_dome');
    case 'frost_nova': return t('ui.hud.module.frost_nova');
    case 'vortex': return t('ui.hud.module.vortex');
    default: return '';
  }
}
