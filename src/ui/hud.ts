import type { GameState } from '../game/state';
import { totalWaves, currentWaveDuration, currentPauseDuration, isNextWaveBoss } from '../game/wave';
import { getSprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';
import { DIFFICULTY_MODES } from '../data/difficulty';
import { MUTATOR_BY_ID } from '../data/mutators';
import { CONTRACT_BY_ID } from '../data/contracts';
import { BLESSING_BY_ID, CURSE_BY_ID } from '../data/blessings';
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
  /** Side panel container holding the picked blessings/curses, the
   *  wave-rotating dungeon laws, and the run contracts. Lives on the
   *  left edge of the screen so the player can read the active rules,
   *  effects, and goals at all times during a run. */
  private runSidebar!: HTMLDivElement;
  /** Section inside the sidebar listing the picked blessings (and curse
   *  in Ancient). Built once per run since the picks don't change. */
  private blessingSection!: HTMLDivElement;
  /** Section inside the sidebar listing the active wave-rotating laws.
   *  Re-rendered each time the active mutator id list changes. */
  private mutatorSection!: HTMLDivElement;
  /** Section inside the sidebar listing the run contracts. Card text is
   *  re-rendered every frame because it shows live progress (X/N). */
  private contractSection!: HTMLDivElement;

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
  private prevDifficulty = '';
  private prevDifficultyHidden = -1;
  private prevMutatorKey = '';
  private prevContractKey = '';
  private prevBlessingKey = '';
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

    // Run sidebar — vertical panel anchored to the left edge of the
    // screen, below the wave/HP row. Holds the wave-rotating "dungeon
    // laws" and the run contracts as expanded cards (icon + name + short
    // description) so the player doesn't need to open the pause overlay
    // to read the current rules and goals.
    this.runSidebar = document.createElement('div');
    this.runSidebar.className = 'hud-run-sidebar';
    this.runSidebar.style.display = 'none';
    this.blessingSection = document.createElement('div');
    this.blessingSection.className = 'hud-run-section hud-run-section-blessings';
    this.mutatorSection = document.createElement('div');
    this.mutatorSection.className = 'hud-run-section hud-run-section-laws';
    this.contractSection = document.createElement('div');
    this.contractSection.className = 'hud-run-section hud-run-section-contracts';
    this.runSidebar.appendChild(this.blessingSection);
    this.runSidebar.appendChild(this.mutatorSection);
    this.runSidebar.appendChild(this.contractSection);
    this.root.appendChild(this.runSidebar);

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
    // Use the same blue-essence sprite as the main menu so the player sees a
    // single, consistent "essence" icon in the HUD and the meta UI.
    essBadge.appendChild(spriteEl(getSprites().iconBlueEssence, 3));
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

    const ws = state.waveState;
    const idx = ws.currentIndex;
    const total = totalWaves(state);
    let waveText: string;
    if (state.difficulty === 'endless' || state.difficulty === 'daily') {
      // Both Endless and Daily Events run infinitely — show the wave index
      // and the current cycle ("loop") instead of an idx/total fraction.
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

    // Sidebar visibility: only show when there is something to display.
    const hasMutators = state.activeMutatorIds.length > 0;
    const hasContracts = state.activeContractIds.length > 0;
    const hasBlessings = state.activeBlessingIds.length > 0 || state.activeCurseId !== null;
    this.runSidebar.style.display = (hasMutators || hasContracts || hasBlessings) ? '' : 'none';

    // Mutator section — re-rendered only when the active mutator id list
    // changes (i.e. on every wave reroll). Each card shows the icon, name
    // and a one-liner combining the i18nLines effect strings.
    const mutKey = state.activeMutatorIds.join(',');
    if (mutKey !== this.prevMutatorKey) {
      this.prevMutatorKey = mutKey;
      this.mutatorSection.innerHTML = '';
      if (hasMutators) {
        const head = document.createElement('div');
        head.className = 'hud-run-section-title';
        head.textContent = t('ui.pause.mutatorsTitle');
        this.mutatorSection.appendChild(head);
        for (const id of state.activeMutatorIds) {
          const def = MUTATOR_BY_ID[id];
          if (!def) continue;
          const card = document.createElement('div');
          card.className = 'hud-run-card hud-run-card-law';
          card.style.borderColor = def.color;
          const ico = document.createElement('div');
          ico.className = 'hud-run-card-icon';
          ico.style.color = def.color;
          ico.textContent = def.icon;
          card.appendChild(ico);
          const body = document.createElement('div');
          body.className = 'hud-run-card-body';
          const name = document.createElement('div');
          name.className = 'hud-run-card-name';
          name.style.color = def.color;
          name.textContent = t(def.i18nName);
          body.appendChild(name);
          const desc = document.createElement('div');
          desc.className = 'hud-run-card-desc';
          desc.textContent = def.i18nLines.map((k) => t(k)).join(' • ');
          body.appendChild(desc);
          card.appendChild(body);
          this.mutatorSection.appendChild(card);
        }
      }
    }

    // Blessing / curse section — rebuilt only when the picked set changes
    // (i.e. once per run, since blessings/curses are picked at run start
    // and stay for the whole run). Each card shows icon + name + the
    // one-line effect description.
    const blessingKey = state.activeBlessingIds.join(',') + '|' + (state.activeCurseId ?? '');
    if (blessingKey !== this.prevBlessingKey) {
      this.prevBlessingKey = blessingKey;
      this.blessingSection.innerHTML = '';
      if (hasBlessings) {
        const head = document.createElement('div');
        head.className = 'hud-run-section-title';
        head.textContent = t('ui.blessing.label');
        this.blessingSection.appendChild(head);
        for (const id of state.activeBlessingIds) {
          const def = BLESSING_BY_ID[id];
          if (!def) continue;
          const card = document.createElement('div');
          card.className = 'hud-run-card hud-run-card-blessing';
          card.style.borderColor = def.color;
          const ico = document.createElement('div');
          ico.className = 'hud-run-card-icon';
          ico.style.color = def.color;
          ico.textContent = def.icon;
          card.appendChild(ico);
          const body = document.createElement('div');
          body.className = 'hud-run-card-body';
          const name = document.createElement('div');
          name.className = 'hud-run-card-name';
          name.style.color = def.color;
          name.textContent = t(def.i18nName);
          body.appendChild(name);
          const desc = document.createElement('div');
          desc.className = 'hud-run-card-desc';
          desc.textContent = t(def.i18nEffect);
          body.appendChild(desc);
          card.appendChild(body);
          this.blessingSection.appendChild(card);
        }
        if (state.activeCurseId) {
          const def = CURSE_BY_ID[state.activeCurseId];
          if (def) {
            const card = document.createElement('div');
            card.className = 'hud-run-card hud-run-card-curse';
            card.style.borderColor = def.color;
            const ico = document.createElement('div');
            ico.className = 'hud-run-card-icon';
            ico.style.color = def.color;
            ico.textContent = def.icon;
            card.appendChild(ico);
            const body = document.createElement('div');
            body.className = 'hud-run-card-body';
            const name = document.createElement('div');
            name.className = 'hud-run-card-name';
            name.style.color = def.color;
            name.textContent = t(def.i18nName);
            body.appendChild(name);
            const desc = document.createElement('div');
            desc.className = 'hud-run-card-desc';
            desc.textContent = t(def.i18nEffect);
            body.appendChild(desc);
            card.appendChild(body);
            this.blessingSection.appendChild(card);
          }
        }
      }
    }

    // Contract section — card structure rebuilt only on id-list change,
    // but the body line (progress + reward + done/failed flag) is
    // refreshed every frame since the counters tick live.
    const contractIdKey = state.activeContractIds.join(',');
    if (contractIdKey !== this.prevContractKey) {
      this.prevContractKey = contractIdKey;
      this.contractSection.innerHTML = '';
      if (hasContracts) {
        const head = document.createElement('div');
        head.className = 'hud-run-section-title';
        head.textContent = t('ui.contract.label');
        this.contractSection.appendChild(head);
        for (const id of state.activeContractIds) {
          const def = CONTRACT_BY_ID[id];
          if (!def) continue;
          const card = document.createElement('div');
          card.className = 'hud-run-card hud-run-card-contract';
          card.dataset.contractId = id;
          const ico = document.createElement('div');
          ico.className = 'hud-run-card-icon';
          ico.textContent = def.icon;
          card.appendChild(ico);
          const body = document.createElement('div');
          body.className = 'hud-run-card-body';
          const name = document.createElement('div');
          name.className = 'hud-run-card-name';
          name.textContent = t(def.i18nName);
          body.appendChild(name);
          const desc = document.createElement('div');
          desc.className = 'hud-run-card-desc';
          // Body content set per-frame below by the live progress loop.
          body.appendChild(desc);
          card.appendChild(body);
          this.contractSection.appendChild(card);
        }
      }
    }
    // Per-frame: refresh contract card body lines with live progress.
    if (hasContracts) {
      for (const id of state.activeContractIds) {
        const def = CONTRACT_BY_ID[id];
        if (!def) continue;
        const card = this.contractSection.querySelector(
          `[data-contract-id="${id}"]`,
        );
        if (!card) continue;
        const desc = card.querySelector('.hud-run-card-desc') as HTMLDivElement | null;
        if (!desc) continue;
        const prog = def.progress(state);
        let line: string;
        if (prog.failed) {
          card.classList.remove('done');
          card.classList.add('failed');
          line = t('ui.contract.failed');
        } else if (prog.done) {
          card.classList.add('done');
          card.classList.remove('failed');
          line = t('ui.contract.done');
        } else {
          card.classList.remove('done', 'failed');
          line = `${prog.current}/${prog.target} · ${t(def.i18nDesc, { n: prog.target })}`;
        }
        if (desc.textContent !== line) desc.textContent = line;
      }
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

// HUD-flavoured wrapper around the shared sprite helper. The HUD adds a
// `hud-sprite` class so existing CSS selectors keep working.
function spriteEl(sprite: import('../render/sprite').BakedSprite, scale: number): HTMLCanvasElement {
  return spriteIcon(sprite, { scale, extraClass: 'hud-sprite' });
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
