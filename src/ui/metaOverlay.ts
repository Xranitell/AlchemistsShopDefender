import { META_UPGRADES, type MetaBranch } from '../data/metaTree';
import {
  ROOT_NODE_ID,
  allocatedSet,
  buyMetaUpgrade,
  canAllocate,
  isReachable,
  refundMetaUpgrade,
} from '../game/meta';
import type { MetaSave } from '../game/save';

const BRANCH_COLORS: Record<MetaBranch, string> = {
  potions: '#c084fc',     // purple
  engineering: '#ff8c5a', // orange
  core: '#7df9ff',        // cyan
  survival: '#a3e36a',    // green
};

const NODE_RADIUS: Record<string, number> = {
  root: 22,
  notable: 16,
  keystone: 18,
  small: 10,
};

// SVG viewBox dimensions. Covers the entire node-position space defined in
// metaTree.ts (≈0..1100 × 0..740) plus a small margin.
const VIEW_W = 1100;
const VIEW_H = 740;

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
    h.textContent = 'Дерево Манекена';
    header.appendChild(h);

    const currencies = document.createElement('div');
    currencies.className = 'meta-currencies';
    currencies.innerHTML = `
      <span class="meta-currency blue">СЭ: <strong>${opts.meta.blueEssence}</strong></span>
      <span class="meta-currency ancient">ДЭ: <strong>${opts.meta.ancientEssence}</strong></span>
      <span class="meta-stats">Забегов: ${opts.meta.totalRuns} · Лучшая волна: ${opts.meta.bestWave}</span>
    `;
    header.appendChild(currencies);

    panel.appendChild(header);

    // Body: graph (left) + info side panel (right). The side panel is always
    // present so the player has a stable place to read details on touch
    // devices where hover-tooltips are unavailable.
    const body = document.createElement('div');
    body.className = 'meta-tree-body';
    panel.appendChild(body);

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
      this.selectedId = ROOT_NODE_ID;
    }

    const saveCallback = () => opts.onSave();

    const renderSidePanel = () => {
      sidePanel.innerHTML = '';
      const id = this.selectedId;
      const node = id ? META_UPGRADES.find((u) => u.id === id) ?? null : null;

      if (!node) {
        const hint = document.createElement('div');
        hint.className = 'meta-side-hint';
        hint.textContent = 'Выберите узел дерева, чтобы увидеть его эффект и стоимость.';
        sidePanel.appendChild(hint);
        return;
      }

      const owned = opts.meta.purchased.includes(node.id) || node.id === ROOT_NODE_ID;
      const reachable = isReachable(opts.meta, node);
      const affordable = canAllocate(opts.meta, node);
      const branchColor = BRANCH_COLORS[node.branch];

      const name = document.createElement('div');
      name.className = 'meta-side-name';
      name.textContent = node.name;
      name.style.color = branchColor;
      sidePanel.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'meta-side-meta';
      meta.innerHTML = `<span class="meta-side-kind">${kindLabel(node.kind)}</span> · <span class="meta-side-branch">${branchLabel(node.branch)}</span>`;
      sidePanel.appendChild(meta);

      const desc = document.createElement('div');
      desc.className = 'meta-side-desc';
      desc.textContent = node.desc;
      sidePanel.appendChild(desc);

      const cost = document.createElement('div');
      cost.className = 'meta-side-cost';
      if (node.cost <= 0) {
        cost.textContent = 'Стоимость: бесплатно';
      } else {
        const label = node.currency === 'blue' ? 'Синяя эссенция' : 'Древняя эссенция';
        cost.innerHTML = `Стоимость: <strong>${node.cost}</strong> ${label}`;
      }
      sidePanel.appendChild(cost);

      const status = document.createElement('div');
      status.className = 'meta-side-status';
      if (owned) {
        status.innerHTML = '<span class="meta-tip-owned">Изучено</span>';
      } else if (affordable) {
        status.innerHTML = '<span class="meta-tip-available">Доступно для изучения</span>';
      } else if (!reachable) {
        status.innerHTML = '<span class="meta-tip-locked">Нет связи с изученным узлом</span>';
      } else {
        status.innerHTML = '<span class="meta-tip-locked">Не хватает эссенции</span>';
      }
      sidePanel.appendChild(status);

      const actions = document.createElement('div');
      actions.className = 'meta-side-actions';

      if (!owned) {
        const learn = document.createElement('button');
        learn.className = 'meta-side-learn';
        learn.textContent = 'Изучить';
        learn.disabled = !affordable;
        learn.addEventListener('click', () => {
          if (buyMetaUpgrade(opts.meta, node)) {
            saveCallback();
            rerender();
          }
        });
        actions.appendChild(learn);
      } else if (node.id !== ROOT_NODE_ID) {
        const undo = document.createElement('button');
        undo.className = 'meta-side-refund';
        undo.textContent = 'Вернуть';
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

      // 1) Edges first (so they sit behind the nodes).
      for (const node of META_UPGRADES) {
        for (const otherId of node.connects) {
          const a = node.id;
          const b = otherId;
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (drawnEdges.has(key)) continue;
          drawnEdges.add(key);
          const other = META_UPGRADES.find((u) => u.id === otherId);
          if (!other) continue;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', `${node.pos.x}`);
          line.setAttribute('y1', `${node.pos.y}`);
          line.setAttribute('x2', `${other.pos.x}`);
          line.setAttribute('y2', `${other.pos.y}`);
          const bothAllocated = allocated.has(node.id) && allocated.has(other.id);
          line.setAttribute('class', bothAllocated ? 'meta-edge meta-edge-on' : 'meta-edge');
          svg.appendChild(line);
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
          if (node.id === ROOT_NODE_ID) return;
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
    startBtn.textContent = 'Назад';
    startBtn.addEventListener('click', opts.onStart);
    actions.appendChild(startBtn);

    if (opts.onReset) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'meta-reset';
      resetBtn.textContent = 'Сбросить дерево';
      resetBtn.addEventListener('click', () => {
        if (confirm('Сбросить весь мета-прогресс?')) {
          opts.onReset!();
        }
      });
      actions.appendChild(resetBtn);
    }

    panel.appendChild(actions);

    const help = document.createElement('div');
    help.className = 'meta-tree-help';
    help.textContent = 'Нажмите узел, чтобы увидеть детали справа · повторное нажатие — изучить · ПКМ — вернуть.';
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
    case 'root': return 'Корень';
    case 'small': return 'Малый узел';
    case 'notable': return 'Заметный узел';
    case 'keystone': return 'Краеугольный камень';
    default: return '';
  }
}

function branchLabel(b: MetaBranch): string {
  switch (b) {
    case 'potions': return 'Алхимия';
    case 'engineering': return 'Инженерия';
    case 'core': return 'Аркана';
    case 'survival': return 'Живучесть';
  }
}
