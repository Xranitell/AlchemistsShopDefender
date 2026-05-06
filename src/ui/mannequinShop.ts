import type { GameState } from '../game/state';
import { placePopupNearAnchor } from './popupPlacement';
import { t } from '../i18n';
import { tutorial } from './tutorial';

/**
 * Popup attached to the Mannequin (the centre of the arena). Exposes the
 * actions that affect the Mannequin itself — currently HP repair and a
 * temporary damage-reduction shield. These used to live inside the tower
 * popup which was confusing because towers can't actually be damaged.
 */
export class MannequinShop {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  private state: GameState | null = null;

  constructor(root: HTMLElement) { this.root = root; }

  attach(state: GameState): void { this.state = state; }

  open(screenPos: { x: number; y: number }): void {
    if (!this.state) return;
    // Defence-in-depth: repair / shield is a between-waves action only.
    // The click handler in main.ts already gates on phase, but if any
    // other call site forgets to we silently no-op here too — this also
    // protects against the popup re-opening if the state flips into a
    // wave while it's already on screen.
    if (this.state.phase !== 'preparing') return;
    this.close();
    const el = document.createElement('div');
    el.className = 'tower-shop mannequin-shop';
    el.style.left = `${screenPos.x + 24}px`;
    el.style.top = `${screenPos.y - 20}px`;

    const title = document.createElement('div');
    title.className = 'tower-shop-info';
    title.textContent = t('ui.mannequin.title');
    el.appendChild(title);

    this.appendRepairButton(el);
    this.appendShieldButton(el);

    const cancel = document.createElement('button');
    cancel.className = 'tower-shop-cancel';
    cancel.textContent = t('ui.mannequin.close');
    cancel.addEventListener('click', () => this.close());
    el.appendChild(cancel);

    this.root.appendChild(el);
    this.el = el;
    placePopupNearAnchor(el, screenPos);
    // Tell the FTUE controller that the player has discovered the
    // repair / shield panel — dismisses the `w2-mannequin-shop` hint.
    tutorial.notify('mannequinShopOpened');
  }

  private appendRepairButton(el: HTMLDivElement): void {
    if (!this.state) return;
    const m = this.state.mannequin;
    const repairCost = 80;
    const repairAmount = Math.round(m.maxHp * 0.2);
    const btn = document.createElement('button');
    const left = document.createElement('span');
    left.textContent = t('ui.mannequin.repair', { n: repairAmount });
    const right = document.createElement('span');
    right.className = 'cost';
    right.textContent = t('ui.mannequin.gold', { n: repairCost });
    btn.appendChild(left);
    btn.appendChild(right);
    btn.disabled = this.state.gold < repairCost || m.hp >= m.maxHp;
    btn.addEventListener('click', () => {
      if (!this.state) return;
      if (this.state.gold < repairCost) return;
      const mq = this.state.mannequin;
      if (mq.hp >= mq.maxHp) return;
      this.state.gold -= repairCost;
      mq.hp = Math.min(mq.maxHp, mq.hp + repairAmount);
      this.close();
    });
    el.appendChild(btn);
  }

  private appendShieldButton(el: HTMLDivElement): void {
    if (!this.state) return;
    const cost = 120;
    if (this.state.tempShieldTime > 0) {
      const info = document.createElement('div');
      info.className = 'tower-shop-info';
      info.textContent = t('ui.mannequin.shieldActive', { sec: this.state.tempShieldTime.toFixed(1) });
      el.appendChild(info);
      return;
    }
    const btn = document.createElement('button');
    const left = document.createElement('span');
    left.textContent = t('ui.mannequin.shieldBuy');
    const right = document.createElement('span');
    right.className = 'cost';
    right.textContent = t('ui.mannequin.gold', { n: cost });
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
  }

  isOpen(): boolean { return this.el !== null; }
}
