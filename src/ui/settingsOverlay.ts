import type { MetaSave } from '../game/save';
import { resetMeta, saveMeta } from '../game/save';
import { audio } from '../audio/audio';
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
    body.appendChild(buildAudioSection(opts.meta));

    // Language section (PR-9 i18n).
    body.appendChild(buildLanguageSection(opts.meta));

    // Stats section
    const stats = document.createElement('div');
    stats.className = 'settings-section';
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
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.textContent = t('ui.settings.reset');
    resetBtn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      if (confirm(t('ui.settings.resetConfirm'))) {
        resetMeta();
        opts.onReset();
      }
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
