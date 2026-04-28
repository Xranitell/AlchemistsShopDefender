import { ENDLESS_MODIFIER_POOL, type EndlessModifier, type EndlessModifierId } from '../game/state';

/** Simple overlay that shows the player which random modifier was rolled
 *  for the upcoming endless cycle and lets them confirm to proceed. */
export class EndlessModifierOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: {
    modifierId: EndlessModifierId;
    loop: number;
    activeModifiers: EndlessModifier[];
    onConfirm: () => void;
  }): void {
    this.root.innerHTML = '';
    const mod = ENDLESS_MODIFIER_POOL.find((m) => m.id === opts.modifierId);
    if (!mod) return;

    const panel = document.createElement('div');
    panel.className = 'panel endless-modifier-panel';

    // Header
    const header = document.createElement('h2');
    header.className = 'em-title';
    header.textContent = `Бесконечный цикл ${opts.loop}`;
    panel.appendChild(header);

    const sub = document.createElement('p');
    sub.className = 'em-subtitle';
    sub.textContent = 'Новый модификатор для следующего цикла:';
    panel.appendChild(sub);

    // Modifier card
    const card = document.createElement('div');
    card.className = 'em-card';
    const cardLabel = document.createElement('div');
    cardLabel.className = 'em-card-label';
    cardLabel.textContent = mod.label;
    card.appendChild(cardLabel);
    const cardDesc = document.createElement('div');
    cardDesc.className = 'em-card-desc';
    cardDesc.textContent = mod.desc;
    card.appendChild(cardDesc);
    panel.appendChild(card);

    // Previously active modifiers
    if (opts.activeModifiers.length > 0) {
      const activeHeader = document.createElement('p');
      activeHeader.className = 'em-active-header';
      activeHeader.textContent = 'Активные модификаторы:';
      panel.appendChild(activeHeader);

      const list = document.createElement('ul');
      list.className = 'em-active-list';
      for (const am of opts.activeModifiers) {
        const li = document.createElement('li');
        li.textContent = `${am.label}: ${am.desc}`;
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    // Confirm button
    const btn = document.createElement('button');
    btn.className = 'em-confirm';
    btn.textContent = 'Продолжить';
    btn.addEventListener('click', opts.onConfirm);
    panel.appendChild(btn);

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }

  isVisible(): boolean {
    return this.root.classList.contains('visible');
  }
}
