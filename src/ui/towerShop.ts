import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_COST } from '../data/towers';
import type { GameState } from '../game/state';
import { buyTower, cycleTargetingMode, targetingModeLabel, upgradeTower } from '../game/tower';

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

    // Mannequin repair + temporary shield (available any time the shop is open).
    this.appendRepairButton(el);
    this.appendShieldButton(el);

    this.root.appendChild(el);
    this.el = el;
  }

  private appendRepairButton(el: HTMLDivElement): void {
    if (!this.state) return;
    const m = this.state.mannequin;
    if (m.hp >= m.maxHp) return;
    const repairCost = 80;
    const repairAmount = Math.round(m.maxHp * 0.2);
    const btn = document.createElement('button');
    const left = document.createElement('span');
    left.textContent = `Ремонт (+${repairAmount} HP)`;
    const right = document.createElement('span');
    right.className = 'cost';
    right.textContent = `${repairCost} зол.`;
    btn.appendChild(left);
    btn.appendChild(right);
    btn.disabled = this.state.gold < repairCost;
    btn.addEventListener('click', () => {
      if (!this.state) return;
      if (this.state.gold < repairCost) return;
      this.state.gold -= repairCost;
      this.state.mannequin.hp = Math.min(
        this.state.mannequin.maxHp,
        this.state.mannequin.hp + repairAmount,
      );
      this.close();
    });
    el.appendChild(btn);
  }

  private appendShieldButton(el: HTMLDivElement): void {
    if (!this.state) return;
    const cost = 120;
    // Already shielded? show a decayed "active" indicator instead of selling
    // another one to avoid stacking weirdness.
    if (this.state.tempShieldTime > 0) {
      const info = document.createElement('div');
      info.style.color = 'var(--fg-dim)';
      info.style.fontSize = '12px';
      info.textContent = `Щит активен ${this.state.tempShieldTime.toFixed(1)} с`;
      el.appendChild(info);
      return;
    }
    const btn = document.createElement('button');
    const left = document.createElement('span');
    left.textContent = 'Щит (-50% урона 10 с)';
    const right = document.createElement('span');
    right.className = 'cost';
    right.textContent = `${cost} зол.`;
    btn.appendChild(left);
    btn.appendChild(right);
    btn.disabled = this.state.gold < cost;
    btn.addEventListener('click', () => {
      if (!this.state) return;
      if (this.state.gold < cost) return;
      this.state.gold -= cost;
      this.state.tempShieldTime = 10;
      this.state.tempShieldReduction = 0.5;
      this.close();
    });
    el.appendChild(btn);
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
