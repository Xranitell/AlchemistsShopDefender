// ── Mannequin loadout picker (active module + aura) ─────────────────
//
// Stand-alone overlay that lets the player pick:
//   • one Active module  (consumes the Overload bar when triggered)
//   • one Aura module    (persistent passive)
//
// Up until now, both slots lived inside the laboratory's meta tree
// overlay on a thin side rail — easy to miss, especially on small
// viewports. They've been pulled into their own dedicated panel which
// is opened from a new "Снаряжение" widget on the main menu.
//
// Visual treatment matches the defeat / blessing / dungeon-entry family
// (`dramaticStage` helper, glitch title, pulsing tagline, gold/amber
// palette) so the whole "important moment" surface set reads as one.
//
// Picking a module persists immediately (`saveMeta` is called via the
// host's `onChange` callback) and the panel re-renders to update the
// `selected` highlight; there's no separate confirm step. Closing the
// panel returns the player to the main menu.
//
// The aura section gets a cyan accent on its title and a cyan
// "selected" rim so the two slots are visually distinguishable at a
// glance, while still living under the same warm body.

import { audio } from '../audio/audio';
import { t } from '../i18n';
import {
  ACTIVE_MODULES,
  AURA_MODULES,
  isActiveModule,
  isAuraModule,
  moduleName,
  moduleDesc,
  type ActiveModuleId,
  type AuraModuleId,
  type ModuleDef,
} from '../data/modules';
import type { MetaSave } from '../game/save';
import { appendGlitchTitleChars, buildDramaticStage } from './dramaticStage';

export const ACTIVE_MODULE_ICONS: Record<string, string> = {
  lightning: '⚡',
  chronos: '⏳',
  transmute: '⛁',
  alch_dome: '⛨',
  frost_nova: '❄',
  vortex: '🌀',
};

export const AURA_MODULE_ICONS: Record<string, string> = {
  ether_amp: '✦',
  thorn_shell: '🜨',
  elem_reson: '◎',
  vital_pulse: '♥',
  gold_aura: '🜚',
  long_range: '➶',
};

export function moduleGlyph(slot: 'active' | 'aura', id: string): string {
  return slot === 'active'
    ? ACTIVE_MODULE_ICONS[id] ?? '⚡'
    : AURA_MODULE_ICONS[id] ?? '◯';
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

    // ─── Body: two sections, each with a 3-col module grid ───────────
    const body = document.createElement('div');
    body.className = 'lo-body';
    const renderAll = () => {
      body.innerHTML = '';
      body.appendChild(this.buildSection({
        slot: 'active',
        label: t('ui.meta.activeModule'),
        meta: opts.meta,
        onPick: () => {
          opts.onSave();
          renderAll();
        },
      }));
      body.appendChild(this.buildSection({
        slot: 'aura',
        label: t('ui.meta.auraModule'),
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
    slot: 'active' | 'aura';
    label: string;
    meta: MetaSave;
    onPick: () => void;
  }): HTMLElement {
    const sec = document.createElement('div');
    sec.className = `lo-section lo-section-${opts.slot}`;

    const heading = document.createElement('div');
    heading.className = 'lo-section-title';
    heading.textContent = opts.label;
    sec.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'lo-grid';
    sec.appendChild(grid);

    const pool = opts.slot === 'active' ? ACTIVE_MODULES : AURA_MODULES;
    const currentRaw = opts.slot === 'active'
      ? opts.meta.selectedActiveModule
      : opts.meta.selectedAuraModule;
    const valid = opts.slot === 'active'
      ? isActiveModule(currentRaw)
      : isAuraModule(currentRaw);
    const current = valid ? currentRaw : Object.keys(pool)[0]!;

    for (const def of Object.values(pool) as ModuleDef[]) {
      grid.appendChild(this.buildCard({
        slot: opts.slot,
        def,
        isSelected: def.id === current,
        onPick: () => {
          if (opts.slot === 'active') {
            opts.meta.selectedActiveModule = def.id as ActiveModuleId;
          } else {
            opts.meta.selectedAuraModule = def.id as AuraModuleId;
          }
          audio.playSfx('uiClick');
          opts.onPick();
        },
      }));
    }

    return sec;
  }

  private buildCard(opts: {
    slot: 'active' | 'aura';
    def: ModuleDef;
    isSelected: boolean;
    onPick: () => void;
  }): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lo-card';
    if (opts.isSelected) card.classList.add('selected');
    if (opts.slot === 'aura') card.classList.add('lo-card-aura');

    // Decorative shimmer that animates on hover, mirroring the blessing
    // picker.
    const shimmer = document.createElement('div');
    shimmer.className = 'lo-card-shimmer';
    shimmer.setAttribute('aria-hidden', 'true');
    card.appendChild(shimmer);

    const ico = document.createElement('div');
    ico.className = 'lo-card-icon';
    ico.textContent = moduleGlyph(opts.slot, opts.def.id);
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
