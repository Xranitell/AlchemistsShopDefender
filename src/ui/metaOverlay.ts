/**
 * Talent Laboratory — meta-progression overlay.
 *
 * Layout (post-redesign):
 *   ┌─ header (title glitch + currencies) ────────────────────────────┐
 *   │ ┌─ tabs ──┬─ canvas (one tree at a time, growing left→right) ─┬─ side ─┐ │
 *   │ │ school  │      ─•─•─•─                                       │  info │ │
 *   │ │ school  │   •─/         \─•                                  │       │ │
 *   │ │ school  │      ─•─•─•─                                       │       │ │
 *   │ └─────────┴───────────────────────────────────────────────────┴───────┘ │
 *   │ Назад / Сбросить                                                         │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * - The three "school" buttons on the left act as a tab control. Tapping
 *   one slides the current tree out the bottom and slides the new tree
 *   in from the top with an ease-in-out animation; the other tabs visually
 *   dim while the chosen one stays bright.
 * - Trees are rotated 90° relative to the original portrait layout —
 *   the root sits on the left, the keystone on the right, and tiers
 *   march horizontally across the canvas.
 * - The panel reuses the dramatic-stage backdrop (rotating rays, drifting
 *   sparks, pulsing sigil) and the glitch title family that's shared
 *   between the brewery / blessing / loadout overlays, so the lab now
 *   matches the rest of the run-start UI.
 */
import {
  META_UPGRADES,
  TREE_CENTERS,
  TREE_KEYSTONE_Y,
  TREE_ROOT_Y,
  branchName,
  type MetaBranch,
} from '../data/metaTree';
import { t } from '../i18n';
import { getSprites } from '../render/sprites';
import { spriteIcon } from '../render/spriteIcon';
import {
  isRootNode,
  allocatedSet,
  buyMetaUpgrade,
  canAllocate,
  isReachable,
  refundMetaUpgrade,
} from '../game/meta';
import type { MetaSave } from '../game/save';
import { metaNodeName, metaNodeDesc } from '../data/metaTree';
import { buildDramaticStage, appendGlitchTitleChars } from './dramaticStage';

const BRANCH_COLORS: Record<MetaBranch, string> = {
  potions: '#c084fc',     // purple — Мастер колб
  engineering: '#ff8c5a', // orange — Мастер стоек
  survival: '#a3e36a',    // green  — Выживаемость
};

/** Iconic glyphs shown next to each school tab — pulled from the kind of
 *  effects each branch grants so the player can scan tabs at a glance. */
const BRANCH_GLYPH: Record<MetaBranch, string> = {
  potions: '⚗',
  engineering: '⚒',
  survival: '🛡',
};

const BRANCH_ORDER: MetaBranch[] = ['potions', 'engineering', 'survival'];

const NODE_RADIUS: Record<string, number> = {
  root: 26,
  notable: 20,
  keystone: 22,
  small: 14,
};

/** Glyph for a node, derived from its effect kind. Unicode-only so we
 *  don't ship a sprite atlas — characters render in the native pixel
 *  font and pick up the branch colour via SVG `fill="currentColor"`. */
const EFFECT_ICONS: Record<string, string> = {
  // Potions
  potionDamage: '⚗',
  potionCooldown: '⏱',
  potionRadius: '◎',
  potionEchoChance: '⤴',
  potionAimBonus: '✦',
  potionLeavesFire: '🔥',
  // Engineering / towers
  towerDiscount: '$',
  towerStartLevel: '⭐',
  towerFireRate: '➤',
  towerDamage: '⚔',
  towerRange: '◉',
  runePointUnlock: '✚',
  // Core / arcanum
  overloadRate: '⚡',
  overloadMaxCharge: '🔋',
  auraRadius: '◯',
  reactionDamage: '✸',
  // Survival
  maxHp: '❤',
  armor: '🛡',
  autoRepair: '✚',
  bossShield: '⛨',
  thornyShell: '🜨',
  // Economy
  essenceBonus: '✦',
  startGold: '⛁',
  goldDrop: '⛁',
  lootRadius: '◌',
  // Combat extras
  armorPen: '⚒',
  critChance: '✦',
};

const ROOT_GLYPH = '✶';

function nodeGlyph(node: { id: string; effect: { kind: string } }): string {
  if (isRootNode(node.id)) return ROOT_GLYPH;
  return EFFECT_ICONS[node.effect.kind] ?? '✦';
}

// ────────── Horizontal-tree layout constants ──────────
//
// The data file lays nodes out in a vertical diamond per tree. We render
// only one tree at a time, rotated so the root sits on the left and the
// keystone on the right. The transform is:
//
//   tx = SVG_LEFT_MARGIN + (TREE_ROOT_Y - pos.y)
//   ty = SVG_VCENTER     + (pos.x - TREE_CENTERS[branch])
//
// View-box dimensions are tuned so every node — including the apex of
// the widest rhombus tier (offsetX = ±160) — fits with a comfortable
// margin on every side.
const SVG_LEFT_MARGIN = 80;
const SVG_VCENTER = 360;
const TREE_VIEW_W = SVG_LEFT_MARGIN + (TREE_ROOT_Y - TREE_KEYSTONE_Y) + 80; // 80 + 660 + 80
const TREE_VIEW_H = 720;

function transformPos(node: { branch: MetaBranch; pos: { x: number; y: number } }): {
  x: number;
  y: number;
} {
  return {
    x: SVG_LEFT_MARGIN + (TREE_ROOT_Y - node.pos.y),
    y: SVG_VCENTER + (node.pos.x - TREE_CENTERS[node.branch]),
  };
}

/** Tree-switch slide animation timings — kept short so the player can
 *  bounce between branches without feeling held up. */
const SLIDE_OUT_MS = 280;
const SLIDE_IN_MS = 320;

interface ShowOpts {
  meta: MetaSave;
  onSave: () => void;
  onStart: () => void;
  onReset?: () => void;
}

export class MetaOverlay {
  private root: HTMLElement;
  /** Currently inspected node id (selection survives across re-renders). */
  private selectedId: string | null = null;
  /** Currently visible school. Switching this triggers the slide animation. */
  private selectedBranch: MetaBranch = 'potions';
  /** True while a slide animation is in flight — guards against rapid clicks. */
  private switching = false;
  /** Cached opts so internal re-renders (tab switch / side-panel update)
   *  can reach back to the host's save / start / reset callbacks. */
  private opts: ShowOpts | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: ShowOpts): void {
    this.opts = opts;
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel meta-panel meta-tree-panel dramatic-meta';

    // Animated backdrop (rotating rays + drifting sparks + pulsing sigil)
    // pinned behind every foreground layer.
    panel.appendChild(buildDramaticStage());

    panel.appendChild(this.buildHeader(opts));

    // Body: vertical tab column · canvas · info side-panel.
    const body = document.createElement('div');
    body.className = 'meta-tree-body';
    panel.appendChild(body);

    const tabs = this.buildTabs();
    body.appendChild(tabs);

    const treeWrap = document.createElement('div');
    treeWrap.className = 'meta-tree-canvas';
    body.appendChild(treeWrap);

    const sidePanel = document.createElement('div');
    sidePanel.className = 'meta-tree-side';
    body.appendChild(sidePanel);

    if (this.selectedId === null) {
      // Default selection: the root of the currently-active tree.
      const firstRoot = META_UPGRADES.find(
        (u) => u.kind === 'root' && u.branch === this.selectedBranch,
      );
      this.selectedId = firstRoot ? firstRoot.id : null;
    }

    // Initial tree render.
    treeWrap.appendChild(this.buildTreeSvg());
    this.renderSidePanel(sidePanel);

    // Bottom action bar.
    const actions = document.createElement('div');
    actions.className = 'meta-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'meta-start';
    startBtn.textContent = t('ui.meta.back');
    startBtn.addEventListener('click', opts.onStart);
    actions.appendChild(startBtn);

    if (opts.onReset) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'meta-reset';
      resetBtn.textContent = t('ui.meta.resetTree');
      resetBtn.addEventListener('click', () => {
        if (confirm(t('ui.meta.resetConfirm'))) {
          opts.onReset!();
        }
      });
      actions.appendChild(resetBtn);
    }

    panel.appendChild(actions);

    const help = document.createElement('div');
    help.className = 'meta-tree-help';
    help.textContent = t('ui.meta.help');
    panel.appendChild(help);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
    this.opts = null;
    this.switching = false;
  }

  // ────────── Header (glitch title + currencies) ──────────
  private buildHeader(opts: ShowOpts): HTMLElement {
    const header = document.createElement('div');
    header.className = 'meta-tree-header';

    const titleLine = document.createElement('div');
    titleLine.className = 'meta-tree-title-line';

    const h = document.createElement('h2');
    h.className = 'meta-tree-glitch-title';
    appendGlitchTitleChars(h, t('ui.meta.title'));
    titleLine.appendChild(h);

    const tagline = document.createElement('div');
    tagline.className = 'meta-tree-tagline';
    tagline.textContent = t('ui.meta.tagline');
    titleLine.appendChild(tagline);

    header.appendChild(titleLine);

    // Currency strip — pixel sprite icon next to the amount, matching the
    // main-menu top bar so the player has one consistent way to read
    // currencies across every screen.
    const currencies = document.createElement('div');
    currencies.className = 'meta-currencies';
    const sprites = getSprites();

    const blueChip = document.createElement('span');
    blueChip.className = 'meta-currency blue';
    blueChip.appendChild(spriteIcon(sprites.iconBlueEssence, { scale: 2 }));
    const blueLabel = document.createElement('span');
    blueLabel.textContent = t('ui.meta.blue');
    blueChip.appendChild(blueLabel);
    const blueAmount = document.createElement('strong');
    blueAmount.textContent = `${opts.meta.blueEssence}`;
    blueChip.appendChild(blueAmount);
    currencies.appendChild(blueChip);

    const ancientChip = document.createElement('span');
    ancientChip.className = 'meta-currency ancient';
    ancientChip.appendChild(spriteIcon(sprites.iconAncientEssence, { scale: 2, extraClass: 'glow-gold' }));
    const ancientLabel = document.createElement('span');
    ancientLabel.textContent = t('ui.meta.ancient');
    ancientChip.appendChild(ancientLabel);
    const ancientAmount = document.createElement('strong');
    ancientAmount.textContent = `${opts.meta.ancientEssence}`;
    ancientChip.appendChild(ancientAmount);
    currencies.appendChild(ancientChip);

    const stats = document.createElement('span');
    stats.className = 'meta-stats';
    stats.textContent = t('ui.meta.statsLine', {
      runs: opts.meta.totalRuns,
      wave: opts.meta.bestWave,
    });
    currencies.appendChild(stats);
    header.appendChild(currencies);

    return header;
  }

  // ────────── Vertical tab column ──────────
  private buildTabs(): HTMLElement {
    const col = document.createElement('div');
    col.className = 'meta-tree-tabs';

    for (const branch of BRANCH_ORDER) {
      const btn = document.createElement('button');
      const isActive = branch === this.selectedBranch;
      btn.className = `meta-tree-tab meta-branch-${branch}${isActive ? ' active' : ' dim'}`;
      btn.style.setProperty('--branch-color', BRANCH_COLORS[branch]);

      const glyph = document.createElement('span');
      glyph.className = 'meta-tree-tab-glyph';
      glyph.textContent = BRANCH_GLYPH[branch];
      btn.appendChild(glyph);

      const text = document.createElement('span');
      text.className = 'meta-tree-tab-text';
      const name = document.createElement('span');
      name.className = 'meta-tree-tab-name';
      name.textContent = branchName(branch);
      text.appendChild(name);
      const tag = document.createElement('span');
      tag.className = 'meta-tree-tab-sub';
      tag.textContent = t(`ui.meta.tab.${branch}`);
      text.appendChild(tag);
      btn.appendChild(text);

      btn.addEventListener('click', () => this.switchBranch(branch));
      col.appendChild(btn);
    }

    return col;
  }

  private refreshTabStates(): void {
    const tabs = this.root.querySelectorAll<HTMLButtonElement>('.meta-tree-tab');
    tabs.forEach((tab) => {
      const isActive = tab.classList.contains(`meta-branch-${this.selectedBranch}`);
      tab.classList.toggle('active', isActive);
      tab.classList.toggle('dim', !isActive);
    });
  }

  // ────────── Branch switching with slide animation ──────────
  private switchBranch(branch: MetaBranch): void {
    if (this.switching || branch === this.selectedBranch || !this.opts) return;
    this.switching = true;

    const canvas = this.root.querySelector<HTMLElement>('.meta-tree-canvas');
    const oldSvg = canvas?.querySelector<SVGSVGElement>('.meta-tree-svg');
    if (!canvas || !oldSvg) {
      // Fallback to a full re-render if the DOM isn't where we expect.
      this.selectedBranch = branch;
      this.selectedId = this.defaultSelectionFor(branch);
      this.show(this.opts);
      this.switching = false;
      return;
    }

    // Old tree slides out the bottom.
    oldSvg.classList.add('leaving');

    // Update tab states immediately so the click feels responsive.
    this.selectedBranch = branch;
    this.selectedId = this.defaultSelectionFor(branch);
    this.refreshTabStates();
    const sidePanel = this.root.querySelector<HTMLElement>('.meta-tree-side');
    if (sidePanel) this.renderSidePanel(sidePanel);

    // Once the slide-out finishes, swap in the new tree which itself
    // animates from the top.
    window.setTimeout(() => {
      oldSvg.remove();
      const newSvg = this.buildTreeSvg();
      newSvg.classList.add('entering');
      canvas.appendChild(newSvg);
      window.setTimeout(() => {
        newSvg.classList.remove('entering');
        this.switching = false;
      }, SLIDE_IN_MS);
    }, SLIDE_OUT_MS);
  }

  private defaultSelectionFor(branch: MetaBranch): string | null {
    const root = META_UPGRADES.find((u) => u.kind === 'root' && u.branch === branch);
    return root ? root.id : null;
  }

  // ────────── Tree SVG ──────────
  /**
   * Builds the SVG containing only the currently-active branch's nodes
   * and edges, transformed to the horizontal "root-on-left" layout.
   */
  private buildTreeSvg(): SVGSVGElement {
    const opts = this.opts!;
    const branch = this.selectedBranch;
    const branchColor = BRANCH_COLORS[branch];

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${TREE_VIEW_W} ${TREE_VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('meta-tree-svg');
    svg.style.setProperty('--branch-color', branchColor);

    const allocated = allocatedSet(opts.meta);
    const drawnEdges = new Set<string>();

    // Filter to only nodes in the active branch.
    const branchNodes = META_UPGRADES.filter((u) => u.branch === branch);

    // 0) Faint diamond silhouette traced through the four extreme tier
    //    centres, transformed to the horizontal layout. Gives the empty
    //    canvas a visual anchor before any node is allocated.
    const tipLeft = transformPos({ branch, pos: { x: TREE_CENTERS[branch], y: TREE_ROOT_Y } });
    const tipRight = transformPos({ branch, pos: { x: TREE_CENTERS[branch], y: TREE_KEYSTONE_Y } });
    const tipTop = transformPos({ branch, pos: { x: TREE_CENTERS[branch] - 200, y: (TREE_KEYSTONE_Y + TREE_ROOT_Y) / 2 } });
    const tipBot = transformPos({ branch, pos: { x: TREE_CENTERS[branch] + 200, y: (TREE_KEYSTONE_Y + TREE_ROOT_Y) / 2 } });
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    diamond.setAttribute(
      'd',
      `M ${tipLeft.x - 30} ${tipLeft.y} L ${tipTop.x} ${tipTop.y} L ${tipRight.x + 30} ${tipRight.y} L ${tipBot.x} ${tipBot.y} Z`,
    );
    diamond.setAttribute('fill', 'none');
    diamond.setAttribute('stroke', 'rgba(255, 209, 102, 0.10)');
    diamond.setAttribute('stroke-width', '1');
    svg.appendChild(diamond);

    // 1) Edges first so they sit behind the nodes. Each edge is a
    //    quadratic Bézier whose control point sits on the side of the
    //    midpoint that bows away from the tree's vertical centre,
    //    producing outward arcs instead of straight cuts through the
    //    rhombus interior.
    const treeCx = SVG_VCENTER; // horizontal layout: tree is centred vertically
    for (const node of branchNodes) {
      const a = transformPos(node);
      for (const otherId of node.connects) {
        const key = node.id < otherId ? `${node.id}|${otherId}` : `${otherId}|${node.id}`;
        if (drawnEdges.has(key)) continue;
        drawnEdges.add(key);
        const other = META_UPGRADES.find((u) => u.id === otherId);
        if (!other || other.branch !== branch) continue;
        const b = transformPos(other);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        let nx = -dy / len;
        let ny = dx / len;
        // Bias the control point away from the tree's vertical centre
        // (treeCx) — rotated layout means "outward" is along the y-axis.
        const radialY = my - treeCx;
        if (ny * radialY < 0) {
          nx = -nx;
          ny = -ny;
        }
        const curveAmt = Math.min(40, len * 0.14);
        const cx = mx + nx * curveAmt;
        const cy = my + ny * curveAmt;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
        path.setAttribute('fill', 'none');
        const bothAllocated = allocated.has(node.id) && allocated.has(other.id);
        path.setAttribute('class', bothAllocated ? 'meta-edge meta-edge-on' : 'meta-edge');
        svg.appendChild(path);
      }
    }

    // 2) Nodes on top.
    for (const node of branchNodes) {
      const r = NODE_RADIUS[node.kind] ?? 12;
      const owned = allocated.has(node.id);
      const reachable = isReachable(opts.meta, node);
      const affordable = canAllocate(opts.meta, node);
      const isSelected = this.selectedId === node.id;
      const p = transformPos(node);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `meta-node meta-node-${node.kind} meta-branch-${node.branch}`);
      if (owned) g.classList.add('owned');
      else if (affordable) g.classList.add('available');
      else if (!reachable) g.classList.add('locked');
      if (isSelected) g.classList.add('selected');

      // Selection ring (sits behind the main circle).
      if (isSelected) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', `${p.x}`);
        ring.setAttribute('cy', `${p.y}`);
        ring.setAttribute('r', `${r + 6}`);
        ring.setAttribute('class', 'meta-node-selection');
        ring.setAttribute('stroke', branchColor);
        ring.setAttribute('fill', 'transparent');
        g.appendChild(ring);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', `${p.x}`);
      circle.setAttribute('cy', `${p.y}`);
      circle.setAttribute('r', `${r}`);
      circle.setAttribute('stroke', branchColor);
      circle.setAttribute('fill', owned ? branchColor : '#0d0a14');
      g.appendChild(circle);

      // Inner ring for notables / keystones.
      if (node.kind === 'notable' || node.kind === 'keystone') {
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        inner.setAttribute('cx', `${p.x}`);
        inner.setAttribute('cy', `${p.y}`);
        inner.setAttribute('r', `${r - 4}`);
        inner.setAttribute('stroke', branchColor);
        inner.setAttribute('fill', 'transparent');
        inner.setAttribute('stroke-width', '1');
        g.appendChild(inner);
      }

      // Glyph at the centre of the node — gives the player a quick
      // visual hint about what the node does even before they read
      // the side-panel description.
      const glyph = nodeGlyph(node);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', `${p.x}`);
      text.setAttribute('y', `${p.y}`);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('class', 'meta-node-glyph');
      text.setAttribute('font-size', `${Math.max(10, r * 1.05)}`);
      text.setAttribute('fill', owned ? '#0d0a14' : branchColor);
      text.textContent = glyph;
      g.appendChild(text);

      // Click: select (and on already-selected available node, allocate).
      g.addEventListener('click', () => {
        if (this.selectedId === node.id && !owned && canAllocate(opts.meta, node)) {
          if (buyMetaUpgrade(opts.meta, node)) {
            opts.onSave();
            this.refreshAfterAllocation();
            return;
          }
        }
        this.selectedId = node.id;
        const sidePanel = this.root.querySelector<HTMLElement>('.meta-tree-side');
        if (sidePanel) this.renderSidePanel(sidePanel);
        this.refreshTreeNodes();
      });
      // Right-click still works as a quick refund.
      g.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (isRootNode(node.id)) return;
        if (!owned) return;
        if (refundMetaUpgrade(opts.meta, node)) {
          opts.onSave();
          this.refreshAfterAllocation();
        }
      });

      svg.appendChild(g);
    }

    return svg;
  }

  /**
   * Re-render only the SVG and the side-panel after a successful
   * allocation / refund — keeps the tab strip and header stable, no
   * slide animation.
   */
  private refreshAfterAllocation(): void {
    const canvas = this.root.querySelector<HTMLElement>('.meta-tree-canvas');
    if (canvas) {
      const oldSvg = canvas.querySelector<SVGSVGElement>('.meta-tree-svg');
      if (oldSvg) oldSvg.remove();
      canvas.appendChild(this.buildTreeSvg());
    }
    const sidePanel = this.root.querySelector<HTMLElement>('.meta-tree-side');
    if (sidePanel) this.renderSidePanel(sidePanel);
    // Header currency amounts can change after allocation, so refresh those too.
    const blueAmount = this.root.querySelector('.meta-currency.blue strong');
    const ancientAmount = this.root.querySelector('.meta-currency.ancient strong');
    if (this.opts) {
      if (blueAmount) blueAmount.textContent = `${this.opts.meta.blueEssence}`;
      if (ancientAmount) ancientAmount.textContent = `${this.opts.meta.ancientEssence}`;
    }
  }

  /** Re-render only the SVG (e.g. on selection change) without touching the
   *  side-panel or any other layout — used after a click that doesn't
   *  allocate anything but does change the selection ring / styling. */
  private refreshTreeNodes(): void {
    const canvas = this.root.querySelector<HTMLElement>('.meta-tree-canvas');
    if (!canvas) return;
    const oldSvg = canvas.querySelector<SVGSVGElement>('.meta-tree-svg');
    if (oldSvg) oldSvg.remove();
    canvas.appendChild(this.buildTreeSvg());
  }

  // ────────── Right side panel ──────────
  private renderSidePanel(sidePanel: HTMLElement): void {
    const opts = this.opts!;
    const sprites = getSprites();

    sidePanel.innerHTML = '';
    const id = this.selectedId;
    const node = id ? META_UPGRADES.find((u) => u.id === id) ?? null : null;

    if (!node) {
      const hint = document.createElement('div');
      hint.className = 'meta-side-hint';
      hint.textContent = t('ui.meta.hint.pickNode');
      sidePanel.appendChild(hint);
      return;
    }

    const owned = opts.meta.purchased.includes(node.id) || isRootNode(node.id);
    const reachable = isReachable(opts.meta, node);
    const affordable = canAllocate(opts.meta, node);
    const branchColor = BRANCH_COLORS[node.branch];

    const name = document.createElement('div');
    name.className = 'meta-side-name';
    name.textContent = metaNodeName(node);
    name.style.color = branchColor;
    sidePanel.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'meta-side-meta';
    meta.innerHTML = `<span class="meta-side-kind">${kindLabel(node.kind)}</span> · <span class="meta-side-branch">${branchLabel(node.branch)}</span>`;
    sidePanel.appendChild(meta);

    const desc = document.createElement('div');
    desc.className = 'meta-side-desc';
    desc.textContent = metaNodeDesc(node);
    sidePanel.appendChild(desc);

    const cost = document.createElement('div');
    cost.className = 'meta-side-cost';
    if (node.cost <= 0) {
      cost.textContent = t('ui.meta.cost.free');
    } else {
      const prefix = document.createElement('span');
      prefix.textContent = t('ui.meta.cost.prefix') + ' ';
      cost.appendChild(prefix);
      const amount = document.createElement('strong');
      amount.textContent = `${node.cost}`;
      cost.appendChild(amount);
      const isAncient = node.currency === 'ancient';
      const sprite = isAncient ? sprites.iconAncientEssence : sprites.iconBlueEssence;
      cost.appendChild(spriteIcon(sprite, {
        scale: 2,
        extraClass: isAncient ? 'glow-gold' : undefined,
      }));
    }
    sidePanel.appendChild(cost);

    const status = document.createElement('div');
    status.className = 'meta-side-status';
    if (owned) {
      status.innerHTML = `<span class="meta-tip-owned">${t('ui.meta.status.owned')}</span>`;
    } else if (affordable) {
      status.innerHTML = `<span class="meta-tip-available">${t('ui.meta.status.available')}</span>`;
    } else if (!reachable) {
      status.innerHTML = `<span class="meta-tip-locked">${t('ui.meta.status.notConnected')}</span>`;
    } else {
      status.innerHTML = `<span class="meta-tip-locked">${t('ui.meta.status.notEnough')}</span>`;
    }
    sidePanel.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'meta-side-actions';

    if (!owned) {
      const learn = document.createElement('button');
      learn.className = 'meta-side-learn';
      learn.textContent = t('ui.meta.learn');
      learn.disabled = !affordable;
      learn.addEventListener('click', () => {
        if (buyMetaUpgrade(opts.meta, node)) {
          opts.onSave();
          this.refreshAfterAllocation();
        }
      });
      actions.appendChild(learn);
    } else if (!isRootNode(node.id)) {
      const undo = document.createElement('button');
      undo.className = 'meta-side-refund';
      undo.textContent = t('ui.meta.refund');
      undo.addEventListener('click', () => {
        if (refundMetaUpgrade(opts.meta, node)) {
          opts.onSave();
          this.refreshAfterAllocation();
        }
      });
      actions.appendChild(undo);
    }

    sidePanel.appendChild(actions);
  }
}

function kindLabel(k: string): string {
  switch (k) {
    case 'root': return t('ui.meta.kind.root');
    case 'small': return t('ui.meta.kind.small');
    case 'notable': return t('ui.meta.kind.notable');
    case 'keystone': return t('ui.meta.kind.keystone');
    default: return k;
  }
}

function branchLabel(b: MetaBranch): string {
  switch (b) {
    case 'potions': return t('ui.meta.branch.potions');
    case 'engineering': return t('ui.meta.branch.engineering');
    case 'survival': return t('ui.meta.branch.survival');
    default: return b;
  }
}
