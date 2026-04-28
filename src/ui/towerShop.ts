import { TOWERS, TOWER_MAX_LEVEL, towerUpgradeCost } from '../data/towers';
import type { GameState } from '../game/state';
import { buyTower, cycleTargetingMode, targetingModeLabel, upgradeTower } from '../game/tower';

/**
 * Popup that opens when the player clicks a rune point on the arena. It shows
 * either the build menu (if the rune is empty) or the upgrade menu (if a
 * tower is already there). Mannequin-only actions (repair / temporary shield)
 * live in MannequinShop instead — the tower popup is now strictly about the
 * tower on this rune.
 */
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
        const isFirst = this.state.towers.length === 0;
        const discount = isFirst ? this.state.metaTowerDiscount : 0;
        const displayCost = Math.max(0, kind.cost - discount);
        right.textContent = discount > 0 ? `${displayCost} зол. (-${discount})` : `${kind.cost} зол.`;
        btn.appendChild(left);
        btn.appendChild(right);
        btn.disabled = this.state.gold < displayCost;
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
      const right = document.createElement('span');
      right.className = 'cost';
      if (tower.level >= TOWER_MAX_LEVEL) {
        left.textContent = 'Максимум';
        right.textContent = '—';
        upgrade.disabled = true;
      } else {
        const cost = towerUpgradeCost(tower.level);
        left.textContent = `Улучшить → Lv ${tower.level + 1}`;
        right.textContent = `${cost} зол.`;
        upgrade.disabled = this.state.gold < cost;
        upgrade.addEventListener('click', () => {
          if (!this.state) return;
          upgradeTower(this.state, tower.id);
          this.close();
        });
      }
      upgrade.appendChild(left);
      upgrade.appendChild(right);
      el.appendChild(upgrade);

      // Targeting mode cycle — closes on click so the player re-opens to
      // see the new label, keeping the UI stateless.
      const tgt = document.createElement('button');
      const tgtLeft = document.createElement('span');
      tgtLeft.textContent = 'Цель';
      const tgtRight = document.createElement('span');
      tgtRight.className = 'cost';
      tgtRight.textContent = targetingModeLabel(tower.targetingMode);
      tgt.appendChild(tgtLeft);
      tgt.appendChild(tgtRight);
      tgt.addEventListener('click', () => {
        cycleTargetingMode(tower);
        tgtRight.textContent = targetingModeLabel(tower.targetingMode);
      });
      el.appendChild(tgt);

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
