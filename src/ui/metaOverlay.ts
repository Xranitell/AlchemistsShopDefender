import { META_UPGRADES, type MetaBranch, type MetaUpgrade } from '../data/metaTree';
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
 * lets the player allocate nodes by clicking. Right-click on an allocated
 * node refunds it (if removing it doesn't disconnect the rest of the tree).
 */
export class MetaOverlay {
  private root: HTMLElement;

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

    // Tooltip element that follows the cursor.
    const tooltip = document.createElement('div');
    tooltip.className = 'meta-tooltip';
    tooltip.style.display = 'none';
    panel.appendChild(tooltip);

    const treeWrap = document.createElement('div');
    treeWrap.className = 'meta-tree-canvas';
    panel.appendChild(treeWrap);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('meta-tree-svg');
    treeWrap.appendChild(svg);

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

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `meta-node meta-node-${node.kind} meta-branch-${node.branch}`);
        if (owned) g.classList.add('owned');
        else if (affordable) g.classList.add('available');
        else if (!reachable) g.classList.add('locked');

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

        // Hover handlers — show tooltip near the cursor.
        g.addEventListener('mousemove', (ev) => {
          tooltip.style.display = 'block';
          tooltip.innerHTML = formatTooltip(node, opts.meta);
          // Position relative to the panel.
          const rect = panel.getBoundingClientRect();
          const x = (ev as MouseEvent).clientX - rect.left + 12;
          const y = (ev as MouseEvent).clientY - rect.top + 12;
          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
        });
        g.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none';
        });

        // Left-click: allocate. Right-click: refund.
        g.addEventListener('click', () => {
          if (node.id === ROOT_NODE_ID) return;
          if (owned) return;
          if (!canAllocate(opts.meta, node)) return;
          if (buyMetaUpgrade(opts.meta, node)) {
            saveCallback();
            rerender();
          }
        });
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

    const saveCallback = () => opts.onSave();

    drawTree();

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
    help.textContent = 'ЛКМ — взять узел · ПКМ — вернуть · Узел доступен, если соединён с уже взятым.';
    panel.appendChild(help);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}

function formatTooltip(node: MetaUpgrade, meta: MetaSave): string {
  const owned = meta.purchased.includes(node.id) || node.id === ROOT_NODE_ID;
  const reachable = isReachable(meta, node);
  const costStr = node.cost > 0
    ? `${node.cost} ${node.currency === 'blue' ? 'СЭ' : 'ДЭ'}`
    : 'бесплатно';
  let status: string;
  if (owned) status = '<span class="meta-tip-owned">Взято</span>';
  else if (canAllocate(meta, node)) status = '<span class="meta-tip-available">Доступно</span>';
  else if (!reachable) status = '<span class="meta-tip-locked">Не подключено</span>';
  else status = '<span class="meta-tip-locked">Недостаточно эссенции</span>';

  return `
    <div class="meta-tip-name">${escapeHtml(node.name)}</div>
    <div class="meta-tip-kind">${kindLabel(node.kind)}</div>
    <div class="meta-tip-desc">${escapeHtml(node.desc)}</div>
    <div class="meta-tip-cost">${costStr}</div>
    <div class="meta-tip-status">${status}</div>
  `;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
