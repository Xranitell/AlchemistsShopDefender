import type { MetaSave } from '../game/save';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';
import { t, tWithFallback } from '../i18n';
import { getSprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';

export class DifficultyOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    onSelect: (mode: DifficultyMode) => void;
    onClose: () => void;
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel difficulty-panel';

    // Decorative ember layer drifting up across the panel (mirrors the
    // run-end / main-menu language so the dungeon-select screen feels
    // like the same cinematic surface). Each spark gets randomised
    // x/delay/duration/scale so the layer never visibly loops.
    const sparks = document.createElement('div');
    sparks.className = 'difficulty-sparks';
    sparks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'difficulty-spark';
      s.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      s.style.setProperty('--delay', `${(Math.random() * 6).toFixed(2)}s`);
      s.style.setProperty('--dur', `${(5 + Math.random() * 4).toFixed(2)}s`);
      s.style.setProperty('--scale', `${(0.5 + Math.random() * 1.1).toFixed(2)}`);
      sparks.appendChild(s);
    }
    panel.appendChild(sparks);

    const header = document.createElement('div');
    header.className = 'difficulty-header';
    const h = document.createElement('h2');
    h.textContent = t('ui.difficulty.title');
    header.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'difficulty-subtitle';
    sub.textContent = t('ui.difficulty.subtitle');
    header.appendChild(sub);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'difficulty-grid';

    // Daily slot was previously a separate main-menu button; now it lives
    // alongside the regular difficulty modes so the player picks it from a
    // single "where do I want to fight" surface. main.ts intercepts the
    // selection and shows the event preview overlay before starting the run.
    const modes: DifficultyMode[] = ['normal', 'epic', 'ancient', 'endless', 'daily'];
    for (const modeId of modes) {
      const def = DIFFICULTY_MODES[modeId];
      const card = document.createElement('button');
      card.className = `difficulty-card difficulty-${modeId}`;
      card.style.setProperty('--dif-color', def.color);

      // Top ribbon / label
      const label = document.createElement('div');
      label.className = 'difficulty-label';
      label.textContent = t(`ui.difficulty.${modeId}.short`).toUpperCase();
      card.appendChild(label);

      // Icon / large sigil. The glyph itself sits in `.difficulty-glyph`
      // so we can animate it (rotate / bob) independently of the halo
      // and orbiting sparkle dots that decorate it. Sparkle markup lives
      // here (rather than as ::before/::after) so we can have several
      // dots at separate offsets / phases per mode.
      const iconWrap = document.createElement('div');
      iconWrap.className = 'difficulty-icon';
      const halo = document.createElement('span');
      halo.className = 'difficulty-icon-halo';
      iconWrap.appendChild(halo);
      const glyph = document.createElement('span');
      glyph.className = 'difficulty-glyph';
      glyph.textContent = modeIcon(modeId);
      iconWrap.appendChild(glyph);
      // Three orbiting sparkle dots — picked up by per-mode CSS so each
      // dungeon has its own feel (orbit speed, distance, colour).
      for (let i = 0; i < 3; i++) {
        const orb = document.createElement('span');
        orb.className = `difficulty-orb difficulty-orb-${i + 1}`;
        iconWrap.appendChild(orb);
      }
      card.appendChild(iconWrap);

      // Name
      const name = document.createElement('div');
      name.className = 'difficulty-name';
      name.textContent = tWithFallback(`ui.difficulty.${modeId}.name`, def.name);
      card.appendChild(name);

      // Flavour
      const flav = document.createElement('div');
      flav.className = 'difficulty-flavor';
      flav.textContent = tWithFallback(`ui.difficulty.${modeId}.flavor`, def.flavor);
      card.appendChild(flav);

      // Cost footer. The key icons come from the same sprite atlas the
      // main menu uses so all three places that show key costs (top bar,
      // difficulty cards, daily-rewards calendar) are visually identical.
      const cost = document.createElement('div');
      cost.className = 'difficulty-cost';
      if (def.keyCost === 'none') {
        cost.textContent = t('ui.difficulty.noKey');
      } else {
        const isEpic = def.keyCost === 'epic';
        const sprite = isEpic ? getSprites().iconEpicKey : getSprites().iconAncientKey;
        const labelKey = isEpic ? 'ui.difficulty.epicKey' : 'ui.difficulty.ancientKey';
        const count = isEpic ? opts.meta.epicKeys : opts.meta.ancientKeys;
        const wrap = document.createElement('span');
        wrap.className = 'difficulty-cost-label';
        wrap.appendChild(spriteIcon(sprite, {
          scale: 2,
          extraClass: isEpic ? undefined : 'glow-gold',
        }));
        const txt = document.createElement('span');
        txt.textContent = t(labelKey);
        wrap.appendChild(txt);
        cost.appendChild(wrap);
        const countEl = document.createElement('span');
        countEl.className = 'key-count';
        countEl.textContent = `${count}`;
        cost.appendChild(countEl);
      }
      card.appendChild(cost);

      const canStart = canStartMode(opts.meta, modeId);
      if (!canStart) {
        card.disabled = true;
        const lock = document.createElement('div');
        lock.className = 'difficulty-lock';
        lock.textContent = t('ui.difficulty.lock');
        card.appendChild(lock);
      } else {
        card.addEventListener('click', () => opts.onSelect(modeId));
      }
      grid.appendChild(card);
    }

    panel.appendChild(grid);
    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

export function canStartMode(meta: MetaSave, mode: DifficultyMode): boolean {
  if (mode === 'epic') return meta.epicKeys > 0;
  if (mode === 'ancient') return meta.ancientKeys > 0;
  return true;
}

function modeIcon(mode: DifficultyMode): string {
  switch (mode) {
    case 'normal': return '⚔';
    case 'epic': return '✦';
    case 'ancient': return '☀';
    case 'endless': return '∞';
    case 'daily': return '📅';
  }
}
