// ── Blessing & Curse picker ("Дар алхимика") ────────────────────────────
//
// Slay-the-Spire-style pre-run pick. In Epic the player picks 1 of 3
// random blessings (positive run-wide buff). In Ancient they pick 1 of 3
// blessings AND 1 of 3 curses (mandatory drawback). The overlay is shown
// once per Epic/Ancient run, right after `startRun` builds the state but
// before `state.phase` flips from `'menu'` to `'preparing'` — gameplay
// stays paused on the menu phase until the player confirms.
//
// The two-step picker is implemented as two sequential views inside the
// same overlay element (no animation), so the player sees the same panel
// shape with a different headline / accent for the curse step.

import { audio } from '../audio/audio';
import { t } from '../i18n';
import type { BlessingDef, CurseDef } from '../data/blessings';

export type BlessingPickResult = {
  blessingId: BlessingDef['id'];
  curseId: CurseDef['id'] | null;
};

interface ShowOpts {
  blessings: BlessingDef[];
  /** Pass an empty array (or omit) for Epic; pass 3 curses for Ancient. */
  curses?: CurseDef[];
  onComplete: (picks: BlessingPickResult) => void;
}

export class BlessingOverlay {
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
    wrap.className = 'blessing-overlay';
    this.root.appendChild(wrap);

    this.renderBlessingStep(wrap, opts);
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  // ─── Step 1: pick a blessing ───────────────────────────────────────────
  private renderBlessingStep(wrap: HTMLElement, opts: ShowOpts): void {
    wrap.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'blessing-panel blessing-step';

    const head = document.createElement('div');
    head.className = 'blessing-head';
    const title = document.createElement('h2');
    title.className = 'blessing-title';
    title.textContent = t('ui.blessing.pickTitle');
    head.appendChild(title);
    const sub = document.createElement('p');
    sub.className = 'blessing-subtitle';
    sub.textContent = t('ui.blessing.pickSubtitle');
    head.appendChild(sub);
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'blessing-grid';
    for (const def of opts.blessings) {
      grid.appendChild(this.buildCard(def, false, () => {
        audio.playSfx('uiClick');
        if (opts.curses && opts.curses.length > 0) {
          this.renderCurseStep(wrap, def, opts);
        } else {
          opts.onComplete({ blessingId: def.id, curseId: null });
        }
      }));
    }
    panel.appendChild(grid);

    wrap.appendChild(panel);
  }

  // ─── Step 2: pick a curse (Ancient only) ───────────────────────────────
  private renderCurseStep(wrap: HTMLElement, blessing: BlessingDef, opts: ShowOpts): void {
    wrap.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'blessing-panel blessing-step curse-step';

    const head = document.createElement('div');
    head.className = 'blessing-head';
    const title = document.createElement('h2');
    title.className = 'blessing-title curse';
    title.textContent = t('ui.curse.pickTitle');
    head.appendChild(title);
    const sub = document.createElement('p');
    sub.className = 'blessing-subtitle';
    sub.textContent = t('ui.curse.pickSubtitle', { name: t(blessing.i18nName) });
    head.appendChild(sub);
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'blessing-grid';
    for (const def of (opts.curses ?? [])) {
      grid.appendChild(this.buildCard(def, true, () => {
        audio.playSfx('uiClick');
        opts.onComplete({ blessingId: blessing.id, curseId: def.id });
      }));
    }
    panel.appendChild(grid);

    wrap.appendChild(panel);
  }

  // ─── Card factory (works for both blessings and curses) ────────────────
  private buildCard(def: BlessingDef | CurseDef, isCurse: boolean, onPick: () => void): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = isCurse ? 'blessing-card curse-card' : 'blessing-card';
    card.style.setProperty('--accent', def.color);

    const ico = document.createElement('div');
    ico.className = 'blessing-icon';
    ico.textContent = def.icon;
    card.appendChild(ico);

    const name = document.createElement('div');
    name.className = 'blessing-name';
    name.textContent = t(def.i18nName);
    card.appendChild(name);

    const flavor = document.createElement('div');
    flavor.className = 'blessing-flavor';
    flavor.textContent = t(def.i18nFlavor);
    card.appendChild(flavor);

    const effect = document.createElement('div');
    effect.className = 'blessing-effect';
    effect.textContent = t(def.i18nEffect);
    card.appendChild(effect);

    card.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
    card.addEventListener('click', onPick);

    return card;
  }
}
