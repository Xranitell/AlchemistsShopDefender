import { TOWERS, TOWER_MAX_LEVEL, towerUpgradeCost, towerName } from '../data/towers';
import type { GameState } from '../game/state';
import { buyTower, cycleTargetingMode, targetingModeLabel, upgradeTower } from '../game/tower';
import { t } from '../i18n';

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

    // Rune-kind banner — tells the player up-front what kind of bonus the
    // tower placed here will get. Hidden for plain `normal` runes.
    if (rp.kind !== 'normal') {
      const banner = document.createElement('div');
      banner.className = 'tower-shop-rune-banner';
      banner.textContent = `${runeKindLabel(rp.kind)} — ${runeKindDesc(rp.kind)}`;
      el.appendChild(banner);
    }

    const tower = rp.towerId !== null
      ? this.state.towers.find((t) => t.id === rp.towerId) ?? null
      : null;

    if (!tower) {
      // Build menu.
      for (const kind of Object.values(TOWERS)) {
        const btn = document.createElement('button');
        const left = document.createElement('span');
        left.textContent = towerName(kind);
        const right = document.createElement('span');
        right.className = 'cost';
        const isFirst = this.state.towers.length === 0;
        const discount = isFirst ? this.state.metaTowerDiscount : 0;
        const archmaster = this.state.modifiers.archmasterActive;
        const baseCost = Math.max(0, kind.cost - discount);
        const displayCost = archmaster ? Math.ceil(baseCost * 1.25) : baseCost;
        right.textContent = archmaster
          ? t('ui.tower.cost.archmaster', { n: displayCost })
          : (discount > 0
              ? t('ui.tower.cost.discount', { n: displayCost, d: discount })
              : t('ui.tower.cost.plain', { n: kind.cost }));
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
      cancel.textContent = t('ui.tower.cancel');
      cancel.addEventListener('click', () => this.close());
      el.appendChild(cancel);
    } else {
      // Upgrade menu.
      const info = document.createElement('div');
      info.style.color = 'var(--fg-dim)';
      info.style.fontSize = '12px';
      info.textContent = t('ui.tower.info', {
        name: towerName(tower.kind),
        lvl: tower.level,
        max: TOWER_MAX_LEVEL,
      });
      el.appendChild(info);

      const upgrade = document.createElement('button');
      const left = document.createElement('span');
      const right = document.createElement('span');
      right.className = 'cost';
      if (tower.level >= TOWER_MAX_LEVEL) {
        left.textContent = t('ui.tower.upgrade.max');
        right.textContent = '—';
        upgrade.disabled = true;
      } else {
        const cost = towerUpgradeCost(tower.level);
        left.textContent = t('ui.tower.upgrade.next', { n: tower.level + 1 });
        right.textContent = t('ui.tower.cost.plain', { n: cost });
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
      // see the new label, keeping the UI stateless. Aura towers don't pick
      // targets, so we hide the control for them.
      if (tower.kind.behavior !== 'aura') {
        const tgt = document.createElement('button');
        const tgtLeft = document.createElement('span');
        tgtLeft.textContent = t('ui.tower.target');
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
      }

      const cancel = document.createElement('button');
      cancel.textContent = t('ui.tower.close');
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

function runeKindLabel(k: import('../game/state').RunePointKind): string {
  switch (k) {
    case 'reinforced': return t('ui.rune.reinforced');
    case 'unstable': return t('ui.rune.unstable');
    case 'resonant': return t('ui.rune.resonant');
    case 'defensive': return t('ui.rune.defensive');
    case 'normal':
    default: return t('ui.rune.normal');
  }
}

function runeKindDesc(k: import('../game/state').RunePointKind): string {
  switch (k) {
    case 'reinforced': return t('ui.rune.bonus.reinforced');
    case 'unstable': return t('ui.rune.bonus.unstable');
    case 'resonant': return t('ui.rune.bonus.resonant');
    case 'defensive': return t('ui.rune.bonus.defensive');
    case 'normal':
    default: return t('ui.rune.bonus.normal');
  }
}
