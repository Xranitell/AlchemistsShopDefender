// ── Mannequin Overload picker ───────────────────────────────────────
//
// Stand-alone overlay that lets the player pick a single Overload
// ability. The Overload bar charges during waves and is consumed when
// the player triggers it; each ability does something *unique* (chain
// lightning, full freeze, meteor shower, …) instead of a flat stat
// boost.
//
// Up until now the loadout had a second, passive "Aura" slot, but the
// passive +N-to-stat feel made the choice forgettable: the player just
// took whichever aura was strongest for their build and never thought
// about it again. The slot was removed in this redesign — only the
// Overload remains, and the pool was widened with three new abilities
// (Звездопад / Метка смерти / Призма стихий).
//
// Visual treatment matches the defeat / blessing / dungeon-entry family
// (`dramaticStage` helper, glitch title, pulsing tagline, gold/amber
// palette) so the whole "important moment" surface set reads as one.
//
// Picking an ability persists immediately (`saveMeta` is called via the
// host's `onChange` callback) and the panel re-renders to update the
// `selected` highlight; there's no separate confirm step. Closing the
// panel returns the player to the main menu.

import { audio } from '../audio/audio';
import { t } from '../i18n';
import {
  ACTIVE_MODULES,
  isActiveModule,
  moduleName,
  moduleDesc,
  type ActiveModuleId,
  type ModuleDef,
} from '../data/modules';
import type { MetaSave } from '../game/save';
import { appendGlitchTitleChars, buildDramaticStage } from './dramaticStage';

export const ACTIVE_MODULE_ICONS: Record<string, string> = {
  lightning: '⚡',
  chronos: '⏳',
  alch_dome: '⛨',
  frost_nova: '❄',
  vortex: '🌀',
  meteor_shower: '☄',
  death_mark: '💀',
  element_prism: '🔮',
};

export function moduleGlyph(id: string): string {
  return ACTIVE_MODULE_ICONS[id] ?? '⚡';
}

interface ShowOpts {
  meta: MetaSave;
  onSave: () => void;
  onClose: () => void;
}

export class LoadoutOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: ShowOpts): void {
    this.root.innerHTML = '';
    this.root.classList.remove('cards-mode');
    this.root.classList.remove('cursed-mode');
    this.root.classList.add('visible');

    const wrap = document.createElement('div');
    wrap.className = 'lo-overlay';
    this.root.appendChild(wrap);

    const panel = document.createElement('div');
    panel.className = 'lo-panel';
    panel.appendChild(buildDramaticStage({ density: 'standard' }));

    // ─── Header: glitch title + tagline ───────────────────────────────
    const head = document.createElement('div');
    head.className = 'lo-head';
    const title = document.createElement('h2');
    title.className = 'lo-title';
    appendGlitchTitleChars(title, t('ui.loadout.title'));
    head.appendChild(title);
    const tagline = document.createElement('div');
    tagline.className = 'lo-tagline';
    tagline.textContent = t('ui.loadout.tagline');
    head.appendChild(tagline);
    const sub = document.createElement('p');
    sub.className = 'lo-subtitle';
    sub.textContent = t('ui.loadout.subtitle');
    head.appendChild(sub);
    panel.appendChild(head);

    // ─── Body: single section with the Overload module grid ──────────
    const body = document.createElement('div');
    body.className = 'lo-body';
    const renderAll = () => {
      body.innerHTML = '';
      body.appendChild(this.buildSection({
        meta: opts.meta,
        onPick: () => {
          opts.onSave();
          renderAll();
        },
      }));
    };
    renderAll();
    panel.appendChild(body);

    // ─── Footer CTA ──────────────────────────────────────────────────
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'lo-cta';
    cta.textContent = t('ui.loadout.confirm');
    cta.addEventListener('click', () => {
      audio.playSfx('uiClick');
      this.hide();
      opts.onClose();
    });
    panel.appendChild(cta);

    wrap.appendChild(panel);
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  private buildSection(opts: {
    meta: MetaSave;
    onPick: () => void;
  }): HTMLElement {
    const sec = document.createElement('div');
    // The pre-redesign overlay had two sections (active + aura) so the
    // section headings were necessary. After the Aura slot was removed
    // we keep the section wrapper for layout consistency but drop the
    // heading — the dramatic-stage panel title already says «Перегрузка».
    sec.className = 'lo-section lo-section-active lo-section-solo';

    const grid = document.createElement('div');
    grid.className = 'lo-grid';
    sec.appendChild(grid);

    const currentRaw = opts.meta.selectedActiveModule;
    const current = isActiveModule(currentRaw)
      ? currentRaw
      : (Object.keys(ACTIVE_MODULES)[0] as string);

    for (const def of Object.values(ACTIVE_MODULES) as ModuleDef[]) {
      grid.appendChild(this.buildCard({
        def,
        isSelected: def.id === current,
        onPick: () => {
          opts.meta.selectedActiveModule = def.id as ActiveModuleId;
          audio.playSfx('uiClick');
          opts.onPick();
        },
      }));
    }

    return sec;
  }

  private buildCard(opts: {
    def: ModuleDef;
    isSelected: boolean;
    onPick: () => void;
  }): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lo-card';
    if (opts.isSelected) card.classList.add('selected');

    // Decorative shimmer that animates on hover, mirroring the blessing
    // picker.
    const shimmer = document.createElement('div');
    shimmer.className = 'lo-card-shimmer';
    shimmer.setAttribute('aria-hidden', 'true');
    card.appendChild(shimmer);

    const ico = document.createElement('div');
    ico.className = 'lo-card-icon';
    ico.textContent = moduleGlyph(opts.def.id);
    card.appendChild(ico);

    const name = document.createElement('div');
    name.className = 'lo-card-name';
    name.textContent = moduleName(opts.def);
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'lo-card-desc';
    desc.textContent = moduleDesc(opts.def);
    card.appendChild(desc);

    if (opts.isSelected) {
      const badge = document.createElement('div');
      badge.className = 'lo-card-badge';
      badge.textContent = t('ui.loadout.equipped');
      card.appendChild(badge);
    }

    card.title = moduleDesc(opts.def);
    card.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
    card.addEventListener('click', opts.onPick);

    return card;
  }
}
