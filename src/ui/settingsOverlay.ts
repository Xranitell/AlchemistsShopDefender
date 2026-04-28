import type { MetaSave } from '../game/save';
import { resetMeta, saveMeta } from '../game/save';
import { audio } from '../audio/audio';

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
    h.textContent = 'Настройки';
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

    // Stats section
    const stats = document.createElement('div');
    stats.className = 'settings-section';
    stats.innerHTML = `
      <h3>Статистика</h3>
      <div class="settings-stat">Забегов: <strong>${opts.meta.totalRuns}</strong></div>
      <div class="settings-stat">Лучшая волна: <strong>${opts.meta.bestWave}</strong></div>
      <div class="settings-stat">СЭ: <strong>${opts.meta.blueEssence}</strong></div>
      <div class="settings-stat">ДЭ: <strong>${opts.meta.ancientEssence}</strong></div>
      <div class="settings-stat">Ключи: <strong>${opts.meta.keys}</strong></div>
    `;
    body.appendChild(stats);

    // Reset section
    const resetSection = document.createElement('div');
    resetSection.className = 'settings-section settings-danger';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-reset-btn';
    resetBtn.textContent = 'Сбросить прогресс';
    resetBtn.addEventListener('click', () => {
      audio.playSfx('uiClick');
      if (confirm('Сбросить весь прогресс? Это действие нельзя отменить.')) {
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

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
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
  title.textContent = 'Звук';
  section.appendChild(title);

  section.appendChild(
    buildVolumeSlider({
      label: 'SFX',
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
      label: 'Музыка',
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
