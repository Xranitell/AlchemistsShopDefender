import type { MetaSave } from '../game/save';
import { resetMeta } from '../game/save';

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
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'settings-body';

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
