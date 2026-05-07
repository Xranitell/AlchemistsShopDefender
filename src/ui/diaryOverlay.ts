// ── Alchemist's Diary overlay ───────────────────────────────────────
//
// Three-column reference book opened from the main menu. Layout mirrors
// the design mockup the player provided:
//
//   ┌─────────┬──────────────────┬──────────────────┐
//   │ tabs    │ 3×N entry grid   │ info side panel  │
//   │ (left)  │ (middle)         │ (right)          │
//   └─────────┴──────────────────┴──────────────────┘
//
// Tabs:
//   • Алхимия   — element reference (fire / acid / mercury / aether / …)
//   • Бестиарий — every enemy kind, with silhouette + ??? until first
//                 kill (Terraria-style). Per-difficulty progress bars.
//   • Стойки    — every tower kind, with mechanical features.
//
// All content lives in `src/data/diary.ts` so adding a new element /
// enemy / tower entry is a one-file change. Localised text falls back to
// the Russian source-of-truth via `tWithFallback`.

import { audio } from '../audio/audio';
import { t, tWithFallback } from '../i18n';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';
import {
  BESTIARY_BY_ID,
  BESTIARY_ENTRIES,
  ELEMENT_ENTRIES,
  STANCE_ENTRIES,
  type BestiaryEntry,
  type ElementEntry,
  type StanceEntry,
} from '../data/diary';
import {
  bestiaryKills,
  isBestiaryDiscovered,
  type MetaSave,
} from '../game/save';
import { getSprites, type Sprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';
import { animatedSpriteIcon } from '../render/animatedSpriteIcon';
import { ENEMY_ANIMS } from '../render/creatureAnims';
import type { AnimRow } from '../render/animatedSprite';
import type { BakedSprite } from '../render/sprite';
import { paintedTurretIcon } from '../render/turretSheet';
import { appendGlitchTitleChars, buildDramaticStage } from './dramaticStage';

type DiaryTab = 'alchemy' | 'bestiary' | 'stances';

/** Difficulty modes that get a bestiary progress bar. Endless / daily
 *  share their counters with the player, but they're not displayed as
 *  separate bars to keep the right panel compact. */
const PROGRESS_DIFFICULTIES: DifficultyMode[] = ['normal', 'epic', 'ancient'];

const TAB_ORDER: { id: DiaryTab; labelKey: string; glyph: string }[] = [
  { id: 'alchemy', labelKey: 'ui.diary.tab.alchemy', glyph: '⚗' },
  { id: 'bestiary', labelKey: 'ui.diary.tab.bestiary', glyph: '☠' },
  { id: 'stances', labelKey: 'ui.diary.tab.stances', glyph: '🛡' },
];

interface ShowOpts {
  meta: MetaSave;
  onClose: () => void;
}

export class DiaryOverlay {
  private root: HTMLElement;
  private opts: ShowOpts | null = null;
  private activeTab: DiaryTab = 'alchemy';
  private selectedId: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: ShowOpts): void {
    this.opts = opts;
    this.root.innerHTML = '';
    this.root.classList.remove('cards-mode');
    this.root.classList.remove('cursed-mode');
    this.root.classList.add('visible');

    // Default selections per tab — first entry of the active tab.
    if (this.selectedId === null) this.selectedId = this.firstIdOfTab(this.activeTab);

    const wrap = document.createElement('div');
    wrap.className = 'diary-overlay';
    this.root.appendChild(wrap);

    const panel = document.createElement('div');
    panel.className = 'diary-panel';
    panel.appendChild(buildDramaticStage({ density: 'standard' }));
    wrap.appendChild(panel);

    // ── Header (glitch title + tagline + close button) ─────────────────
    const header = document.createElement('div');
    header.className = 'diary-head';
    const title = document.createElement('h2');
    title.className = 'diary-title';
    appendGlitchTitleChars(title, t('ui.diary.title'));
    header.appendChild(title);

    const tagline = document.createElement('div');
    tagline.className = 'diary-tagline';
    tagline.textContent = t('ui.diary.tagline');
    header.appendChild(tagline);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'diary-close';
    close.setAttribute('aria-label', t('ui.diary.close'));
    close.innerHTML = '×';
    close.addEventListener('click', () => this.handleClose());
    header.appendChild(close);

    panel.appendChild(header);

    // ── Body grid (tabs · entries · info) ──────────────────────────────
    const body = document.createElement('div');
    body.className = 'diary-body';
    panel.appendChild(body);

    const tabsCol = document.createElement('div');
    tabsCol.className = 'diary-col diary-col-tabs';
    body.appendChild(tabsCol);

    const entriesCol = document.createElement('div');
    entriesCol.className = 'diary-col diary-col-entries';
    body.appendChild(entriesCol);

    const infoCol = document.createElement('div');
    infoCol.className = 'diary-col diary-col-info';
    body.appendChild(infoCol);

    const renderAll = (): void => {
      this.renderTabs(tabsCol);
      this.renderEntries(entriesCol);
      this.renderInfo(infoCol);
    };
    renderAll();

    // Tab change → reset selection to first entry of the new tab.
    tabsCol.addEventListener('diary:select-tab', (ev: Event) => {
      const next = (ev as CustomEvent<DiaryTab>).detail;
      if (this.activeTab === next) return;
      this.activeTab = next;
      this.selectedId = this.firstIdOfTab(next);
      audio.playSfx('uiClick');
      renderAll();
    });

    // Entry click → update side panel only.
    entriesCol.addEventListener('diary:select-entry', (ev: Event) => {
      const next = (ev as CustomEvent<string>).detail;
      if (this.selectedId === next) return;
      this.selectedId = next;
      audio.playSfx('uiClick');
      this.renderInfo(infoCol);
      this.renderEntries(entriesCol); // refresh "selected" highlight
    });
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
    this.opts = null;
  }

  private handleClose(): void {
    audio.playSfx('uiClick');
    const onClose = this.opts?.onClose;
    this.hide();
    onClose?.();
  }

  // ── Tabs column ───────────────────────────────────────────────────────
  private renderTabs(host: HTMLElement): void {
    host.innerHTML = '';
    for (const def of TAB_ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diary-tab';
      if (def.id === this.activeTab) btn.classList.add('active');
      btn.setAttribute('aria-pressed', String(def.id === this.activeTab));

      const glyph = document.createElement('span');
      glyph.className = 'diary-tab-glyph';
      glyph.textContent = def.glyph;
      btn.appendChild(glyph);

      const label = document.createElement('span');
      label.className = 'diary-tab-label';
      label.textContent = t(def.labelKey);
      btn.appendChild(label);

      btn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
      btn.addEventListener('click', () => {
        host.dispatchEvent(new CustomEvent<DiaryTab>('diary:select-tab', { detail: def.id }));
      });

      host.appendChild(btn);
    }
  }

  // ── Middle column (3xN entry grid) ────────────────────────────────────
  private renderEntries(host: HTMLElement): void {
    host.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'diary-grid';
    host.appendChild(grid);

    const meta = this.opts?.meta;

    if (this.activeTab === 'alchemy') {
      for (const e of ELEMENT_ENTRIES) {
        grid.appendChild(this.buildElementCard(e, this.selectedId === e.id, host));
      }
      return;
    }

    if (this.activeTab === 'bestiary') {
      for (const e of BESTIARY_ENTRIES) {
        const discovered = meta ? isBestiaryDiscovered(meta, e.id) : false;
        grid.appendChild(this.buildBestiaryCard(e, discovered, this.selectedId === e.id, host));
      }
      return;
    }

    // stances
    for (const e of STANCE_ENTRIES) {
      grid.appendChild(this.buildStanceCard(e, this.selectedId === e.id, host));
    }
  }

  private buildElementCard(entry: ElementEntry, isSelected: boolean, host: HTMLElement): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'diary-entry diary-entry-element';
    if (isSelected) card.classList.add('selected');
    card.style.setProperty('--diary-accent', entry.color);

    const icon = document.createElement('div');
    icon.className = 'diary-entry-icon diary-entry-glyph';
    icon.textContent = entry.glyph;
    card.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'diary-entry-name';
    name.textContent = elementName(entry);
    card.appendChild(name);

    card.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
    card.addEventListener('click', () => {
      host.dispatchEvent(new CustomEvent<string>('diary:select-entry', { detail: entry.id }));
    });
    return card;
  }

  private buildBestiaryCard(entry: BestiaryEntry, discovered: boolean, isSelected: boolean, host: HTMLElement): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'diary-entry diary-entry-bestiary';
    if (isSelected) card.classList.add('selected');
    if (!discovered) card.classList.add('locked');

    const icon = document.createElement('div');
    icon.className = 'diary-entry-icon diary-entry-sprite';
    // Render sprite into a 128×128 box (2× larger than the default 64
    // we use elsewhere) but only fill ~70% of it so tall silhouettes
    // (golem, shaman, boss kinds) keep margin on every side and never
    // bleed into the card border.
    const sprite = enemySpriteIconNode(entry.id, 128, {
      silhouette: !discovered,
      fitScale: 0.7,
    });
    if (sprite) icon.appendChild(sprite);
    card.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'diary-entry-name';
    if (discovered) {
      name.textContent = enemyDisplayName(entry.id);
    } else {
      name.textContent = '???';
      name.classList.add('locked-name');
    }
    card.appendChild(name);

    card.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
    card.addEventListener('click', () => {
      host.dispatchEvent(new CustomEvent<string>('diary:select-entry', { detail: entry.id }));
    });
    return card;
  }

  private buildStanceCard(entry: StanceEntry, isSelected: boolean, host: HTMLElement): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'diary-entry diary-entry-stance';
    if (isSelected) card.classList.add('selected');

    const tower = TOWERS[entry.id];
    if (tower) card.style.setProperty('--diary-accent', tower.color);

    const icon = document.createElement('div');
    icon.className = 'diary-entry-icon diary-entry-sprite';
    const sprite = towerSpriteIconNode(entry.id, 64);
    if (sprite) icon.appendChild(sprite);
    card.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'diary-entry-name';
    name.textContent = towerDisplayName(entry.id);
    card.appendChild(name);

    card.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
    card.addEventListener('click', () => {
      host.dispatchEvent(new CustomEvent<string>('diary:select-entry', { detail: entry.id }));
    });
    return card;
  }

  // ── Right column (info panel) ─────────────────────────────────────────
  private renderInfo(host: HTMLElement): void {
    host.innerHTML = '';
    const id = this.selectedId;
    if (!id) return;

    if (this.activeTab === 'alchemy') {
      const entry = ELEMENT_ENTRIES.find((e) => e.id === id);
      if (entry) this.renderElementInfo(host, entry);
      return;
    }

    if (this.activeTab === 'bestiary') {
      const entry = BESTIARY_BY_ID[id];
      if (entry) this.renderBestiaryInfo(host, entry);
      return;
    }

    const entry = STANCE_ENTRIES.find((e) => e.id === id);
    if (entry) this.renderStanceInfo(host, entry);
  }

  private renderElementInfo(host: HTMLElement, entry: ElementEntry): void {
    host.style.setProperty('--diary-accent', entry.color);

    const head = document.createElement('div');
    head.className = 'diary-info-head';

    const name = document.createElement('div');
    name.className = 'diary-info-name';
    name.textContent = elementName(entry);
    head.appendChild(name);

    const sprite = document.createElement('div');
    sprite.className = 'diary-info-sprite diary-info-glyph';
    sprite.textContent = entry.glyph;
    head.appendChild(sprite);

    host.appendChild(head);

    host.appendChild(infoSectionLabel(t('ui.diary.section.description')));
    const desc = document.createElement('p');
    desc.className = 'diary-info-desc';
    desc.textContent = elementFlavor(entry);
    host.appendChild(desc);

    host.appendChild(infoSectionLabel(t('ui.diary.section.features')));
    host.appendChild(this.buildFeatureList(entry.i18nKey, entry.ruFeatures));
  }

  private renderBestiaryInfo(host: HTMLElement, entry: BestiaryEntry): void {
    const meta = this.opts?.meta;
    const discovered = meta ? isBestiaryDiscovered(meta, entry.id) : false;

    const head = document.createElement('div');
    head.className = 'diary-info-head';

    const name = document.createElement('div');
    name.className = 'diary-info-name';
    name.textContent = discovered ? enemyDisplayName(entry.id) : '???';
    head.appendChild(name);

    const spriteBox = document.createElement('div');
    spriteBox.className = 'diary-info-sprite';
    const node = enemySpriteIconNode(entry.id, 96, { silhouette: !discovered });
    if (node) spriteBox.appendChild(node);
    head.appendChild(spriteBox);
    host.appendChild(head);

    host.appendChild(infoSectionLabel(t('ui.diary.section.description')));
    const desc = document.createElement('p');
    desc.className = 'diary-info-desc';
    desc.textContent = discovered ? bestiaryFlavor(entry) : t('ui.diary.locked.description');
    host.appendChild(desc);

    host.appendChild(infoSectionLabel(t('ui.diary.section.stats')));
    host.appendChild(this.buildBestiaryStats(entry, discovered));

    host.appendChild(infoSectionLabel(t('ui.diary.section.features')));
    if (discovered) {
      host.appendChild(this.buildFeatureList(entry.i18nKey, entry.ruFeatures));
    } else {
      const locked = document.createElement('div');
      locked.className = 'diary-info-locked';
      locked.textContent = t('ui.diary.locked.features');
      host.appendChild(locked);
    }

    host.appendChild(infoSectionLabel(t('ui.diary.section.progress')));
    host.appendChild(this.buildBestiaryProgress(entry));
  }

  private renderStanceInfo(host: HTMLElement, entry: StanceEntry): void {
    const tower = TOWERS[entry.id];
    if (tower) host.style.setProperty('--diary-accent', tower.color);

    const head = document.createElement('div');
    head.className = 'diary-info-head';

    const name = document.createElement('div');
    name.className = 'diary-info-name';
    name.textContent = towerDisplayName(entry.id);
    head.appendChild(name);

    const spriteBox = document.createElement('div');
    spriteBox.className = 'diary-info-sprite';
    const node = towerSpriteIconNode(entry.id, 96);
    if (node) spriteBox.appendChild(node);
    head.appendChild(spriteBox);
    host.appendChild(head);

    host.appendChild(infoSectionLabel(t('ui.diary.section.description')));
    const desc = document.createElement('p');
    desc.className = 'diary-info-desc';
    desc.textContent = stanceFlavor(entry);
    host.appendChild(desc);

    host.appendChild(infoSectionLabel(t('ui.diary.section.stats')));
    host.appendChild(this.buildStanceStats(entry));

    host.appendChild(infoSectionLabel(t('ui.diary.section.features')));
    host.appendChild(this.buildFeatureList(entry.i18nKey, entry.ruFeatures));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private buildFeatureList(prefix: string, ruFallbacks: string[]): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'diary-info-features';
    for (let i = 0; i < ruFallbacks.length; i++) {
      const li = document.createElement('li');
      li.textContent = tWithFallback(`${prefix}.features.${i}`, ruFallbacks[i]!);
      list.appendChild(li);
    }
    return list;
  }

  private buildBestiaryStats(entry: BestiaryEntry, discovered: boolean): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'diary-info-stats';
    const kind = ENEMIES[entry.id];
    if (!kind) return wrap;

    const rows: { label: string; value: string }[] = discovered
      ? [
          { label: t('ui.diary.stat.hp'), value: String(kind.hp) },
          { label: t('ui.diary.stat.speed'), value: String(kind.speed) },
          { label: t('ui.diary.stat.armor'), value: `${Math.round(kind.armor * 100)}%` },
          { label: t('ui.diary.stat.damage'), value: String(kind.damage) },
          { label: t('ui.diary.stat.gold'), value: `${kind.goldDrop[0]}–${kind.goldDrop[1]}` },
        ]
      : [
          { label: t('ui.diary.stat.hp'), value: '???' },
          { label: t('ui.diary.stat.speed'), value: '???' },
          { label: t('ui.diary.stat.armor'), value: '???' },
          { label: t('ui.diary.stat.damage'), value: '???' },
          { label: t('ui.diary.stat.gold'), value: '???' },
        ];

    for (const row of rows) {
      const cell = document.createElement('div');
      cell.className = 'diary-stat-row';
      const k = document.createElement('span');
      k.className = 'diary-stat-key';
      k.textContent = row.label;
      const v = document.createElement('span');
      v.className = 'diary-stat-val';
      v.textContent = row.value;
      cell.appendChild(k);
      cell.appendChild(v);
      wrap.appendChild(cell);
    }
    return wrap;
  }

  private buildStanceStats(entry: StanceEntry): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'diary-info-stats';
    const kind = TOWERS[entry.id];
    if (!kind) return wrap;

    const rate = kind.fireRate > 0 ? kind.fireRate.toFixed(2) : '—';
    const splash = kind.splashRadius > 0 ? String(kind.splashRadius) : '—';
    const dmg = kind.damage > 0 ? String(kind.damage) : '—';

    const rows: { label: string; value: string }[] = [
      { label: t('ui.diary.stat.cost'), value: String(kind.cost) },
      { label: t('ui.diary.stat.damage'), value: dmg },
      { label: t('ui.diary.stat.range'), value: String(kind.range) },
      { label: t('ui.diary.stat.fireRate'), value: rate },
      { label: t('ui.diary.stat.splash'), value: splash },
    ];

    for (const row of rows) {
      const cell = document.createElement('div');
      cell.className = 'diary-stat-row';
      const k = document.createElement('span');
      k.className = 'diary-stat-key';
      k.textContent = row.label;
      const v = document.createElement('span');
      v.className = 'diary-stat-val';
      v.textContent = row.value;
      cell.appendChild(k);
      cell.appendChild(v);
      wrap.appendChild(cell);
    }

    // Element row gets a dedicated badge — coloured pill with the
    // element glyph on the left and its name to the right — so the
    // player can tell at a glance which element a tower lives in
    // without parsing the plain row above. Falls back to a plain row
    // if the tower's element somehow isn't in the diary table.
    const elementEntry = ELEMENT_ENTRIES.find((e) => e.id === kind.element);
    const elementRow = document.createElement('div');
    elementRow.className = 'diary-stat-row diary-stat-row-element';
    if (elementEntry) {
      // Set the element-tinted custom property on the row so both the
      // dashed bottom border (parent) and the inner badge (child)
      // pick up the same lore colour without duplicating the value.
      elementRow.style.setProperty('--element-color', elementEntry.color);
    }
    const elementKey = document.createElement('span');
    elementKey.className = 'diary-stat-key';
    elementKey.textContent = t('ui.diary.stat.element');
    elementRow.appendChild(elementKey);

    const badge = document.createElement('span');
    badge.className = 'diary-element-badge';
    const glyph = document.createElement('span');
    glyph.className = 'diary-element-badge-glyph';
    glyph.textContent = elementEntry ? elementEntry.glyph : '◆';
    const name = document.createElement('span');
    name.className = 'diary-element-badge-name';
    name.textContent = t(`ui.diary.element.short.${kind.element}`);
    badge.appendChild(glyph);
    badge.appendChild(name);
    elementRow.appendChild(badge);
    wrap.appendChild(elementRow);

    return wrap;
  }

  private buildBestiaryProgress(entry: BestiaryEntry): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'diary-info-progress';
    const meta = this.opts?.meta;

    for (const diff of PROGRESS_DIFFICULTIES) {
      const def = DIFFICULTY_MODES[diff];
      const threshold = entry.killThresholds[diff];
      const kills = meta ? bestiaryKills(meta, entry.id, diff) : 0;
      const completed = threshold > 0 && kills >= threshold;

      const row = document.createElement('div');
      row.className = `diary-progress-row diary-progress-${diff}`;
      if (completed) row.classList.add('is-complete');
      row.style.setProperty('--diary-progress-color', def.color);

      const head = document.createElement('div');
      head.className = 'diary-progress-head';
      const name = document.createElement('span');
      name.className = 'diary-progress-name';
      name.textContent = t(`ui.diary.difficulty.${diff}`);
      head.appendChild(name);
      const value = document.createElement('span');
      value.className = 'diary-progress-value';
      if (completed) {
        // Once the kill quota is met we no longer need to teach the
        // player about progress; the tag now reads as a "studied" stamp
        // so the row still has a right-side affordance.
        value.textContent = t('ui.diary.progress.complete');
      } else {
        const cap = Math.min(kills, threshold);
        value.textContent = `${cap} / ${threshold}`;
      }
      head.appendChild(value);
      row.appendChild(head);

      if (completed) {
        // Swap the bar for the tier note — the player has earned the
        // "real" entry for this difficulty, so we surface what the
        // enemy actually does on that mode instead of a redundant
        // 100%-filled bar.
        const note = document.createElement('div');
        note.className = 'diary-progress-note';
        const ruFallback = entry.ruTierNotes[diff] ?? '';
        note.textContent = tWithFallback(`${entry.i18nKey}.tier.${diff}`, ruFallback);
        row.appendChild(note);
      } else {
        const ratio = threshold > 0 ? Math.min(1, kills / threshold) : 0;
        const bar = document.createElement('div');
        bar.className = 'diary-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'diary-progress-fill';
        fill.style.width = `${Math.round(ratio * 100)}%`;
        bar.appendChild(fill);
        row.appendChild(bar);
      }

      wrap.appendChild(row);
    }

    return wrap;
  }

  private firstIdOfTab(tab: DiaryTab): string {
    if (tab === 'alchemy') return ELEMENT_ENTRIES[0]!.id;
    if (tab === 'bestiary') return BESTIARY_ENTRIES[0]!.id;
    return STANCE_ENTRIES[0]!.id;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Display-name helpers
// ────────────────────────────────────────────────────────────────────────

function elementName(entry: ElementEntry): string {
  return tWithFallback(`${entry.i18nKey}.name`, entry.ruName);
}

function elementFlavor(entry: ElementEntry): string {
  return tWithFallback(`${entry.i18nKey}.flavor`, entry.ruFlavor);
}

function enemyDisplayName(id: string): string {
  const kind = ENEMIES[id];
  return tWithFallback(`enemies.${id}.name`, kind?.name ?? id);
}

function bestiaryFlavor(entry: BestiaryEntry): string {
  return tWithFallback(`${entry.i18nKey}.flavor`, entry.ruFlavor);
}

function towerDisplayName(id: string): string {
  const kind = TOWERS[id];
  return tWithFallback(`towers.${id}.name`, kind?.name ?? id);
}

function stanceFlavor(entry: StanceEntry): string {
  return tWithFallback(`${entry.i18nKey}.flavor`, entry.ruFlavor);
}

function infoSectionLabel(text: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'diary-info-section-label';
  div.textContent = text;
  return div;
}

// ────────────────────────────────────────────────────────────────────────
// Sprite helpers
// ────────────────────────────────────────────────────────────────────────

interface SpriteIconNodeOpts {
  silhouette?: boolean;
  /** Fraction of the icon canvas the painted body should occupy.
   *  Defaults to 0.86 (matches the menu portraits). The bestiary
   *  cards pass a smaller value so tall sprites do not clip. */
  fitScale?: number;
}

function enemySpriteIconNode(
  id: string,
  size: number,
  opts: SpriteIconNodeOpts = {},
): HTMLElement | null {
  const fitScale = opts.fitScale ?? 0.86;
  const row: AnimRow | undefined = ENEMY_ANIMS[id];
  if (row) {
    const node = animatedSpriteIcon(row, {
      width: size,
      height: size,
      fps: 3,
      fitScale,
      extraClass: opts.silhouette ? 'diary-sprite diary-sprite-silhouette' : 'diary-sprite',
    });
    return node;
  }
  // Fall back to a baked sprite if there's no painted animation row.
  const sprites = getSprites();
  const baked = bakedEnemySprite(sprites, id);
  if (!baked) return null;
  const target = Math.floor(size * fitScale);
  const scale = Math.max(1, Math.floor(target / Math.max(baked.width, baked.height)));
  const icon = spriteIcon(baked, {
    scale,
    extraClass: opts.silhouette ? 'diary-sprite diary-sprite-silhouette' : 'diary-sprite',
  });
  return icon;
}

function towerSpriteIconNode(id: string, size: number): HTMLElement | null {
  // Painted turret sheet is the source of truth for tower visuals — every
  // tower kind has a hand-drawn frame (see `TURRET_FRAMES` in
  // `render/turretSheet.ts`). Use that here so the diary shows exactly
  // the same sprite the player sees on the rune dais. Falls back to the
  // baked pixel-art sprite if the painted sheet hasn't loaded yet (the
  // `paintedTurretIcon` helper auto-paints once the PNG resolves).
  const painted = paintedTurretIcon(id, size, {
    fitScale: 0.92,
    extraClass: 'diary-sprite',
  });
  if (painted) return painted;
  const sprites = getSprites();
  const baked = bakedTowerSprite(sprites, id);
  if (!baked) return null;
  const scale = Math.max(1, Math.floor(size / Math.max(baked.width, baked.height)));
  return spriteIcon(baked, { scale, extraClass: 'diary-sprite' });
}

function bakedEnemySprite(sprites: Sprites, id: string): BakedSprite | null {
  switch (id) {
    case 'slime': return sprites.slime;
    case 'rat': return sprites.rat;
    case 'golem': return sprites.golem;
    case 'miniboss_slime': return sprites.slimeBoss;
    case 'flying_flask': return sprites.flyingFlask;
    case 'shaman': return sprites.shaman;
    case 'boss_rat_king': return sprites.ratKing;
    case 'sapper': return sprites.sapper;
    case 'boss_homunculus': return sprites.homunculus;
    default: return null;
  }
}

function bakedTowerSprite(sprites: Sprites, id: string): BakedSprite | null {
  switch (id) {
    case 'needler': return sprites.towerNeedler;
    case 'mortar': return sprites.towerMortar;
    case 'mercury_sprayer': return sprites.towerMercury;
    case 'acid_injector': return sprites.towerAcid;
    case 'ether_coil': return sprites.towerMercury; // shares visual with mercury
    case 'watch_tower': return sprites.towerNeedler; // shares visual with needler
    default: return null;
  }
}
