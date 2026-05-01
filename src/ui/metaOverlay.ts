import {
  META_UPGRADES,
  TREE_CENTERS,
  TREE_TITLE_Y,
  TREE_KEYSTONE_Y,
  TREE_ROOT_Y,
  VIEW_W,
  VIEW_H,
  branchName,
  type MetaBranch,
} from '../data/metaTree';
import { t } from '../i18n';
import {
  isRootNode,
  allocatedSet,
  buyMetaUpgrade,
  canAllocate,
  isReachable,
  refundMetaUpgrade,
} from '../game/meta';
import type { MetaSave } from '../game/save';
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
import { metaNodeName, metaNodeDesc } from '../data/metaTree';

const BRANCH_COLORS: Record<MetaBranch, string> = {
  potions: '#c084fc',     // purple — Мастер колб
  engineering: '#ff8c5a', // orange — Мастер стоек
  survival: '#a3e36a',    // green  — Выживаемость
};

const NODE_RADIUS: Record<string, number> = {
  root: 26,
  notable: 20,
  keystone: 22,
  small: 14,
};

// The visual centre of each diamond tree — used to pick the curve direction
// so connections bend outward along a radial arc instead of cutting through
// the middle of the rhombus.
const TREE_CY = (TREE_KEYSTONE_Y + TREE_ROOT_Y) / 2;

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
  catalystSlot: '◆',
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

const ACTIVE_MODULE_ICONS: Record<string, string> = {
  lightning: '⚡',
  chronos: '⏳',
  transmute: '⛁',
  alch_dome: '⛨',
  frost_nova: '❄',
  vortex: '🌀',
};
const AURA_MODULE_ICONS: Record<string, string> = {
  ether_amp: '✦',
  thorn_shell: '🜨',
  elem_reson: '◎',
  vital_pulse: '♥',
  gold_aura: '🜚',
  long_range: '➶',
};

function nodeGlyph(node: { id: string; effect: { kind: string } }): string {
  if (isRootNode(node.id)) return ROOT_GLYPH;
  return EFFECT_ICONS[node.effect.kind] ?? '✦';
}

function moduleGlyph(slot: 'active' | 'aura', id: string): string {
  return slot === 'active'
    ? ACTIVE_MODULE_ICONS[id] ?? '⚡'
    : AURA_MODULE_ICONS[id] ?? '◯';
}

/**
 * PoE-style passive tree overlay. Renders META_UPGRADES as an SVG graph and
 * lets the player allocate nodes by clicking. A side panel on the right
 * displays the currently-selected node's details and an "Изучить" / "Вернуть"
 * button — this gives mobile players a way to inspect nodes without hovering.
 *
 * Interaction:
 * - Tap / click a node                → select (populates side panel).
 * - "Изучить" button or double-click  → allocate.
 * - "Вернуть" button or right-click   → refund (if it doesn't disconnect).
 */
export class MetaOverlay {
  private root: HTMLElement;
  /** Currently inspected node id (selection survives across re-renders). */
  private selectedId: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    meta: MetaSave;
    /** Called whenever the meta save needs to be persisted (allocation /
     *  refund). The overlay drives allocation through `buyMetaUpgrade`
     *  directly so the host only has to flush to storage. */
    onSave: () => void;
    onStart: () => void;
    onReset?: () => void;
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel meta-panel meta-tree-panel';

    const header = document.createElement('div');
    header.className = 'meta-tree-header';

    const h = document.createElement('h2');
    h.textContent = t('ui.meta.title');
    header.appendChild(h);

    const currencies = document.createElement('div');
    currencies.className = 'meta-currencies';
    currencies.innerHTML = `
      <span class="meta-currency blue">${t('ui.meta.blue')}<strong>${opts.meta.blueEssence}</strong></span>
      <span class="meta-currency ancient">${t('ui.meta.ancient')}<strong>${opts.meta.ancientEssence}</strong></span>
      <span class="meta-stats">${t('ui.meta.statsLine', { runs: opts.meta.totalRuns, wave: opts.meta.bestWave })}</span>
    `;
    header.appendChild(currencies);

    panel.appendChild(header);

    // Body: loadout (left) + graph (centre) + info side panel (right). The
    // loadout used to live above the tree, but on smaller viewports it
    // pushed the SVG off-screen and triggered a vertical scrollbar. Moving
    // it to the side keeps the entire screen one fixed canvas.
    const body = document.createElement('div');
    body.className = 'meta-tree-body';
    panel.appendChild(body);

    const loadout = document.createElement('div');
    loadout.className = 'meta-loadout meta-loadout-side';
    body.appendChild(loadout);
    const renderLoadout = () => {
      loadout.innerHTML = '';
      loadout.appendChild(
        buildModuleSlot(t('ui.meta.activeModule'), 'active', opts.meta, () => {
          opts.onSave();
          renderLoadout();
        }),
      );
      loadout.appendChild(
        buildModuleSlot(t('ui.meta.auraModule'), 'aura', opts.meta, () => {
          opts.onSave();
          renderLoadout();
        }),
      );
    };
    renderLoadout();

    const treeWrap = document.createElement('div');
    treeWrap.className = 'meta-tree-canvas';
    body.appendChild(treeWrap);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('meta-tree-svg');
    treeWrap.appendChild(svg);

    const sidePanel = document.createElement('div');
    sidePanel.className = 'meta-tree-side';
    body.appendChild(sidePanel);

    if (this.selectedId === null) {
      // Default selection: the root of the first tree (Мастер колб).
      const firstRoot = META_UPGRADES.find((u) => u.kind === 'root');
      this.selectedId = firstRoot ? firstRoot.id : null;
    }

    const saveCallback = () => opts.onSave();

    const renderSidePanel = () => {
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
        const label = node.currency === 'blue' ? t('ui.meta.blueEssence') : t('ui.meta.ancientEssence');
        cost.innerHTML = t('ui.meta.cost.amount', { n: node.cost, label });
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
            saveCallback();
            rerender();
          }
        });
        actions.appendChild(learn);
      } else if (!isRootNode(node.id)) {
        const undo = document.createElement('button');
        undo.className = 'meta-side-refund';
        undo.textContent = t('ui.meta.refund');
        undo.addEventListener('click', () => {
          if (refundMetaUpgrade(opts.meta, node)) {
            saveCallback();
            rerender();
          }
        });
        actions.appendChild(undo);
      }

      sidePanel.appendChild(actions);
    };

    const rerender = () => this.show(opts);

    const drawTree = () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const allocated = allocatedSet(opts.meta);
      const drawnEdges = new Set<string>();

      // 0) Per-tree decorations: title text above each diamond, plus a
      //    faint diamond outline that traces the rhombus silhouette so
      //    the shape reads even before any nodes are allocated.
      for (const branch of Object.keys(TREE_CENTERS) as MetaBranch[]) {
        const cx = TREE_CENTERS[branch];
        const color = BRANCH_COLORS[branch];

        // Faint diamond silhouette (outline that hugs the widest tier 3
        // and tapers to the keystone / root apexes).
        const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const tipTopY = TREE_KEYSTONE_Y - 30;
        const tipBotY = TREE_ROOT_Y + 30;
        const wideY = (TREE_KEYSTONE_Y + TREE_ROOT_Y) / 2;
        const wideX = 200;
        diamond.setAttribute(
          'd',
          `M ${cx} ${tipTopY} L ${cx + wideX} ${wideY} L ${cx} ${tipBotY} L ${cx - wideX} ${wideY} Z`,
        );
        diamond.setAttribute('fill', 'none');
        diamond.setAttribute('stroke', 'rgba(255,255,255,0.07)');
        diamond.setAttribute('stroke-width', '1');
        svg.appendChild(diamond);

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', String(cx));
        title.setAttribute('y', String(TREE_TITLE_Y));
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('class', 'meta-tree-title');
        title.setAttribute('fill', color);
        title.textContent = branchName(branch);
        svg.appendChild(title);
      }

      // 1) Edges first (so they sit behind the nodes). Each edge is a
      //    quadratic Bézier curve whose control point sits *outside* the
      //    line connecting the two nodes, biased away from the owning
      //    tree's centre. This turns same-row connections into outward
      //    arcs that don't cut through the diamond's interior.
      for (const node of META_UPGRADES) {
        const treeCx = TREE_CENTERS[node.branch];
        for (const otherId of node.connects) {
          const a = node.id;
          const b = otherId;
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (drawnEdges.has(key)) continue;
          drawnEdges.add(key);
          const other = META_UPGRADES.find((u) => u.id === otherId);
          if (!other) continue;
          const x1 = node.pos.x;
          const y1 = node.pos.y;
          const x2 = other.pos.x;
          const y2 = other.pos.y;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.max(1, Math.hypot(dx, dy));
          // Perpendicular unit vector; pick the side whose direction
          // points away from the tree centre (radial outward).
          let nx = -dy / len;
          let ny = dx / len;
          const radialX = mx - treeCx;
          const radialY = my - TREE_CY;
          if (nx * radialX + ny * radialY < 0) {
            nx = -nx;
            ny = -ny;
          }
          const curveAmt = Math.min(40, len * 0.14);
          const cx = mx + nx * curveAmt;
          const cy = my + ny * curveAmt;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
          path.setAttribute('fill', 'none');
          const bothAllocated = allocated.has(node.id) && allocated.has(other.id);
          path.setAttribute('class', bothAllocated ? 'meta-edge meta-edge-on' : 'meta-edge');
          svg.appendChild(path);
        }
      }

      // 2) Nodes on top.
      for (const node of META_UPGRADES) {
        const r = NODE_RADIUS[node.kind] ?? 12;
        const owned = allocated.has(node.id);
        const reachable = isReachable(opts.meta, node);
        const affordable = canAllocate(opts.meta, node);
        const isSelected = this.selectedId === node.id;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `meta-node meta-node-${node.kind} meta-branch-${node.branch}`);
        if (owned) g.classList.add('owned');
        else if (affordable) g.classList.add('available');
        else if (!reachable) g.classList.add('locked');
        if (isSelected) g.classList.add('selected');

        // Selection ring (sits behind the main circle).
        if (isSelected) {
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ring.setAttribute('cx', `${node.pos.x}`);
          ring.setAttribute('cy', `${node.pos.y}`);
          ring.setAttribute('r', `${r + 6}`);
          ring.setAttribute('class', 'meta-node-selection');
          ring.setAttribute('stroke', BRANCH_COLORS[node.branch]);
          ring.setAttribute('fill', 'transparent');
          g.appendChild(ring);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', `${node.pos.x}`);
        circle.setAttribute('cy', `${node.pos.y}`);
        circle.setAttribute('r', `${r}`);
        circle.setAttribute('stroke', BRANCH_COLORS[node.branch]);
        circle.setAttribute('fill', owned ? BRANCH_COLORS[node.branch] : '#0d0a14');
        g.appendChild(circle);

        // Inner ring for notables / keystones.
        if (node.kind === 'notable' || node.kind === 'keystone') {
          const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          inner.setAttribute('cx', `${node.pos.x}`);
          inner.setAttribute('cy', `${node.pos.y}`);
          inner.setAttribute('r', `${r - 4}`);
          inner.setAttribute('stroke', BRANCH_COLORS[node.branch]);
          inner.setAttribute('fill', 'transparent');
          inner.setAttribute('stroke-width', '1');
          g.appendChild(inner);
        }

        // Glyph at the centre of the node — gives the player a quick
        // visual hint about what the node does even before they read
        // the side-panel description.
        const glyph = nodeGlyph(node);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${node.pos.x}`);
        text.setAttribute('y', `${node.pos.y}`);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('class', 'meta-node-glyph');
        text.setAttribute('font-size', `${Math.max(10, r * 1.05)}`);
        text.setAttribute('fill', owned ? '#0d0a14' : BRANCH_COLORS[node.branch]);
        text.textContent = glyph;
        g.appendChild(text);

        // Click: select (and on already-selected available node, allocate).
        g.addEventListener('click', () => {
          // If the node was already selected and is available, the click acts
          // as "Изучить" — saves a tap on touch devices.
          if (this.selectedId === node.id && !owned && canAllocate(opts.meta, node)) {
            if (buyMetaUpgrade(opts.meta, node)) {
              saveCallback();
              rerender();
              return;
            }
          }
          this.selectedId = node.id;
          renderSidePanel();
          drawTree();
        });
        // Right-click still works as a quick refund.
        g.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          if (isRootNode(node.id)) return;
          if (!owned) return;
          if (refundMetaUpgrade(opts.meta, node)) {
            saveCallback();
            rerender();
          }
        });

        svg.appendChild(g);
      }
    };

    drawTree();
    renderSidePanel();

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
  }
}

function kindLabel(k: string): string {
  switch (k) {
    case 'root': return t('ui.meta.kind.root');
    case 'small': return t('ui.meta.kind.small');
    case 'notable': return t('ui.meta.kind.notable');
    case 'keystone': return t('ui.meta.kind.keystone');
    default: return '';
  }
}

function branchLabel(b: MetaBranch): string {
  switch (b) {
    case 'potions': return t('ui.meta.branch.potions');
    case 'engineering': return t('ui.meta.branch.engineering');
    case 'survival': return t('ui.meta.branch.survival');
  }
}

/** Build the UI for one module slot (active or aura). The slot lists the
 *  available modules as buttons and visually marks the currently-selected
 *  one. Picking another button updates the meta save in-place and calls
 *  `onChange` so the host overlay can persist + re-render. */
function buildModuleSlot(
  label: string,
  slot: 'active' | 'aura',
  meta: MetaSave,
  onChange: () => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'meta-loadout-slot';

  const title = document.createElement('div');
  title.className = 'meta-loadout-title';
  title.textContent = label;
  wrap.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'meta-loadout-grid';
  wrap.appendChild(grid);

  const desc = document.createElement('div');
  desc.className = 'meta-loadout-desc';
  wrap.appendChild(desc);

  const pool = slot === 'active' ? ACTIVE_MODULES : AURA_MODULES;
  const currentRaw = slot === 'active' ? meta.selectedActiveModule : meta.selectedAuraModule;
  const valid = slot === 'active' ? isActiveModule(currentRaw) : isAuraModule(currentRaw);
  const current = valid ? currentRaw : Object.keys(pool)[0]!;

  const updateDesc = (id: string) => {
    const def = (pool as Record<string, ModuleDef>)[id];
    desc.textContent = def ? moduleDesc(def) : '';
  };

  for (const def of Object.values(pool)) {
    const btn = document.createElement('button');
    btn.className = 'meta-loadout-btn';
    const icon = document.createElement('span');
    icon.className = 'meta-loadout-btn-icon';
    icon.textContent = moduleGlyph(slot, def.id);
    const label = document.createElement('span');
    label.className = 'meta-loadout-btn-label';
    label.textContent = moduleName(def);
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.title = moduleDesc(def);
    if (def.id === current) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      if (slot === 'active') meta.selectedActiveModule = def.id as ActiveModuleId;
      else meta.selectedAuraModule = def.id as AuraModuleId;
      onChange();
    });
    btn.addEventListener('mouseenter', () => updateDesc(def.id));
    btn.addEventListener('mouseleave', () => updateDesc(current));
    grid.appendChild(btn);
  }

  updateDesc(current);
  return wrap;
}
