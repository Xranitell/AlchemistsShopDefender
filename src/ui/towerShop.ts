import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_COST } from '../data/towers';
import type { GameState } from '../game/state';
import { buyTower, upgradeTower } from '../game/tower';

export class TowerShop {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private state: GameState | null = null;

  constructor(root: HTMLElement) { this.root = root; }

  attach(state: GameState): void { this.state = state; }

  /** Show shop near a rune point. */
  open(runePointId: number, screenPos: { x: number; y: number }): void {
    if (!this.state) return;
    const rp = this.state.runePoints.find((r) => r.id === runePointId);
    if (!rp || !rp.active) return;

    this.close();

    this.state.activeRunePoint = runePointId;
    const el = document.createElement('div');
    el.className = 'tower-shop';
    el.style.left = `${screenPos.x + 24}px`;
    el.style.top = `${screenPos.y - 20}px`;

    const tower = rp.towerId !== null
      ? this.state.towers.find((t) => t.id === rp.towerId) ?? null
      : null;

    if (!tower) {
      // Build menu.
      for (const kind of Object.values(TOWERS)) {
        const btn = document.createElement('button');
        const left = document.createElement('span');
        left.textContent = kind.name;
        const right = document.createElement('span');
        right.className = 'cost';
        right.textContent = `${kind.cost} зол.`;
        btn.appendChild(left);
        btn.appendChild(right);
        btn.disabled = this.state.gold < kind.cost;
        btn.addEventListener('click', () => {
          if (!this.state) return;
          const ok = buyTower(this.state, runePointId, kind.id);
          this.close();
          if (!ok) return;
        });
        el.appendChild(btn);
      }
      const cancel = document.createElement('button');
      cancel.textContent = 'Отмена';
      cancel.addEventListener('click', () => this.close());
      el.appendChild(cancel);
    } else {
      // Upgrade menu.
      const info = document.createElement('div');
      info.style.color = 'var(--fg-dim)';
      info.style.fontSize = '12px';
      info.textContent = `${tower.kind.name} · уровень ${tower.level}/${TOWER_MAX_LEVEL}`;
      el.appendChild(info);

      const upgrade = document.createElement('button');
      const left = document.createElement('span');
      left.textContent = 'Улучшить';
      const right = document.createElement('span');
      right.className = 'cost';
      right.textContent = `${TOWER_UPGRADE_COST} зол.`;
      upgrade.appendChild(left);
      upgrade.appendChild(right);
      const canUp = tower.level < TOWER_MAX_LEVEL && this.state.gold >= TOWER_UPGRADE_COST;
      upgrade.disabled = !canUp;
      upgrade.addEventListener('click', () => {
        if (!this.state) return;
        upgradeTower(this.state, tower.id);
        this.close();
      });
      el.appendChild(upgrade);

      const cancel = document.createElement('button');
      cancel.textContent = 'Закрыть';
      cancel.addEventListener('click', () => this.close());
      el.appendChild(cancel);
    }

    this.root.appendChild(el);
    this.el = el;
  }

  close(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    if (this.state) this.state.activeRunePoint = null;
  }

  isOpen(): boolean { return this.el !== null; }
}
