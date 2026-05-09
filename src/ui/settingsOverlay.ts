import type { MetaSave, MotionMode } from '../game/save';
import { resetMeta, saveMeta } from '../game/save';
import { audio } from '../audio/audio';
import { applyMotionMode } from '../engine/motion';
import { t, getLocale, setLocale, type Locale } from '../i18n';

export class SettingsOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { meta: MetaSave; onClose: () => void; onReset: () => void }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel settings-panel';

    const header = document.createElement('div');
    header.className = 'settings-header';
    const h = document.createElement('h2');
    h.textContent = t('ui.settings.title');
    header.appendChild(h);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      opts.onClose();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'settings-body';

    // Audio section: SFX + music volume sliders. Edits flow straight through
    // to the audio engine in real-time, then persist via saveMeta() so the
    // chosen levels survive a reload.
    const audioSection = buildAudioSection(opts.meta);
    audioSection.dataset.tutorialTarget = 'settings-audio';
    body.appendChild(audioSection);

    // Language section (PR-9 i18n).
    const languageSection = buildLanguageSection(opts.meta);
    languageSection.dataset.tutorialTarget = 'settings-language';
    body.appendChild(languageSection);

    // Motion / animation section. Lets the player override the OS
    // `prefers-reduced-motion` query in either direction. Default for new
    // saves is `'minimal'` on touch devices (Android phones never set
    // the OS query) and `'auto'` on desktop / iOS.
    const motionSection = buildMotionSection(opts.meta);
    motionSection.dataset.tutorialTarget = 'settings-motion';
    body.appendChild(motionSection);

    // Stats section
    const stats = document.createElement('div');
    stats.className = 'settings-section';
    stats.dataset.tutorialTarget = 'settings-stats';
    stats.innerHTML = `
      <h3>${t('ui.settings.stats')}</h3>
      <div class="settings-stat">${t('ui.settings.stat.runs')}<strong>${opts.meta.totalRuns}</strong></div>
      <div class="settings-stat">${t('ui.settings.stat.bestWave')}<strong>${opts.meta.bestWave}</strong></div>
      <div class="settings-stat">${t('ui.settings.stat.blue')}<strong>${opts.meta.blueEssence}</strong></div>
      <div class="settings-stat">${t('ui.settings.stat.ancient')}<strong>${opts.meta.ancientEssence}</strong></div>
      <div class="settings-stat">${t('ui.settings.stat.epicKeys')}<strong>${opts.meta.epicKeys}</strong></div>
      <div class="settings-stat">${t('ui.settings.stat.ancientKeys')}<strong>${opts.meta.ancientKeys}</strong></div>
    `;
    body.appendChild(stats);

    // Reset section
    const resetSection = document.createElement('div');
    resetSection.className = 'settings-section settings-danger';
    resetSection.dataset.tutorialTarget = 'settings-reset';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.textContent = t('ui.settings.reset');
    resetBtn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      openResetConfirmDialog(panel, () => {
        resetMeta();
        opts.onReset();
      });
    });
    resetSection.appendChild(resetBtn);
    body.appendChild(resetSection);

    panel.appendChild(body);
    this.root.appendChild(panel);
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

/** Animation strength picker: 3-button segmented control (Auto / Minimal /
 *  Full). Edits flow through `applyMotionMode()` so the UI reacts on the
 *  next paint, then persist via `saveMeta()`. */
function buildMotionSection(meta: MetaSave): HTMLElement {
  const section = document.createElement('div');
  section.className = 'settings-section';
  const title = document.createElement('h3');
  title.textContent = t('ui.settings.motion');
  section.appendChild(title);

  const row = document.createElement('div');
  row.className = 'settings-motion-row';
  const modes: MotionMode[] = ['auto', 'minimal', 'full'];
  const buttons: HTMLButtonElement[] = [];
  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-motion-btn' + (meta.motionMode === mode ? ' active' : '');
    btn.textContent = t(`ui.settings.motion.${mode}`);
    btn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      if (meta.motionMode === mode) return;
      meta.motionMode = mode;
      saveMeta(meta);
      applyMotionMode(mode);
      for (const b of buttons) b.classList.remove('active');
      btn.classList.add('active');
    });
    buttons.push(btn);
    row.appendChild(btn);
  }
  section.appendChild(row);

  const hint = document.createElement('div');
  hint.className = 'settings-motion-hint';
  hint.textContent = t('ui.settings.motion.hint');
  section.appendChild(hint);

  return section;
}

/** Language picker: small RU/EN button row. Updates the locale immediately
 *  and persists via saveMeta. Other UI re-renders via the global
 *  `onLocaleChange` listener wired in main.ts. */
function buildLanguageSection(meta: MetaSave): HTMLElement {
  const section = document.createElement('div');
  section.className = 'settings-section';
  const title = document.createElement('h3');
  title.textContent = t('ui.settings.language');
  section.appendChild(title);

  const row = document.createElement('div');
  row.className = 'settings-lang-row';
  const codes: Locale[] = ['ru', 'en'];
  for (const code of codes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-lang-btn' + (getLocale() === code ? ' active' : '');
    btn.textContent = t(`ui.lang.${code}`);
    btn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      if (getLocale() === code) return;
      setLocale(code);
      meta.locale = code;
      // Once the player picks a language manually we stop letting the
      // Yandex SDK override it on subsequent sessions.
      meta.localeUserChoice = true;
      saveMeta(meta);
    });
    row.appendChild(btn);
  }
  section.appendChild(row);
  return section;
}

/** Build the "Звук" section of the settings panel: two range sliders for
 *  SFX and music. Both update the live audio engine immediately so the user
 *  can hear the change while dragging, and persist to localStorage on
 *  release. The SFX slider also fires a sample 'uiHover' on input so users
 *  hear the new level. */
function buildAudioSection(meta: MetaSave): HTMLElement {
  const section = document.createElement('div');
  section.className = 'settings-section';
  const title = document.createElement('h3');
  title.textContent = t('ui.settings.audio');
  section.appendChild(title);

  section.appendChild(
    buildVolumeSlider({
      label: t('ui.settings.sfx'),
      initial: meta.sfxVolume,
      onInput: (v) => {
        meta.sfxVolume = v;
        audio.setSfxVolume(v);
      },
      onChange: (v) => {
        meta.sfxVolume = v;
        saveMeta(meta);
        // Audible cue so the player can sample the new level on release.
        audio.playSfx('uiClick');
      },
    }),
  );

  section.appendChild(
    buildVolumeSlider({
      label: t('ui.settings.music'),
      initial: meta.musicVolume,
      onInput: (v) => {
        meta.musicVolume = v;
        audio.setMusicVolume(v);
      },
      onChange: (v) => {
        meta.musicVolume = v;
        saveMeta(meta);
      },
    }),
  );

  return section;
}

function buildVolumeSlider(opts: {
  label: string;
  initial: number;
  onInput: (value: number) => void;
  onChange: (value: number) => void;
}): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-volume-row';

  const label = document.createElement('label');
  label.className = 'settings-volume-label';
  label.textContent = opts.label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = String(Math.round(opts.initial * 100));
  slider.className = 'settings-volume-slider';

  const valueLabel = document.createElement('span');
  valueLabel.className = 'settings-volume-value';
  valueLabel.textContent = `${slider.value}%`;

  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100;
    valueLabel.textContent = `${slider.value}%`;
    opts.onInput(v);
  });
  slider.addEventListener('change', () => {
    const v = Number(slider.value) / 100;
    opts.onChange(v);
  });

  row.appendChild(label);
  row.appendChild(slider);
  row.appendChild(valueLabel);
  return row;
}

/** Custom in-app confirmation dialog for the destructive "Reset progress"
 *  action. Replaces the native `window.confirm()` so the prompt matches the
 *  game's pixel-art chrome and works inside Yandex Games where the native
 *  modal can be suppressed or themed inconsistently. Mirrors the structure
 *  of `pause-exit-confirm` (see `pauseStatsOverlay.ts`) and reuses the same
 *  CSS family of classes via the `.pause-exit-*` overlay style. */
function openResetConfirmDialog(host: HTMLElement, onConfirm: () => void): void {
  // Don't stack a second dialog if the player double-clicks the reset
  // button before the first has resolved.
  if (host.querySelector('.pause-exit-confirm.settings-reset-confirm') !== null) return;

  const overlay = document.createElement('div');
  overlay.className = 'pause-exit-confirm settings-reset-confirm';

  const dialog = document.createElement('div');
  dialog.className = 'pause-exit-dialog';

  const title = document.createElement('div');
  title.className = 'pause-exit-title';
  title.textContent = t('ui.resetConfirm.title');
  dialog.appendChild(title);

  const body = document.createElement('div');
  body.className = 'pause-exit-body';
  body.textContent = t('ui.resetConfirm.body');
  dialog.appendChild(body);

  const warn = document.createElement('div');
  warn.className = 'pause-exit-warning';
  warn.textContent = t('ui.resetConfirm.warning');
  dialog.appendChild(warn);

  const buttons = document.createElement('div');
  buttons.className = 'pause-exit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pause-exit-btn pause-exit-stay';
  cancelBtn.textContent = t('ui.resetConfirm.cancel');
  cancelBtn.addEventListener('click', () => {
    audio.playSfx('uiClick');
    overlay.remove();
    host.classList.remove('confirming-reset');
  });
  buttons.appendChild(cancelBtn);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'pause-exit-btn pause-exit-confirm-btn';
  confirmBtn.textContent = t('ui.resetConfirm.confirm');
  confirmBtn.addEventListener('click', () => {
    audio.playSfx('uiClick');
    overlay.remove();
    host.classList.remove('confirming-reset');
    onConfirm();
  });
  buttons.appendChild(confirmBtn);

  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  host.appendChild(overlay);
  host.classList.add('confirming-reset');

  // Default focus on the safer cancel button so a stray Enter keypress
  // doesn't wipe the player's account.
  requestAnimationFrame(() => cancelBtn.focus());
}
