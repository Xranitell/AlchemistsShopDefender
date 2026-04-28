import type { CardDef } from '../game/types';

export class CardOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(options: {
    title: string;
    subtitle: string;
    cards: CardDef[];
    onPick: (card: CardDef) => void;
    /** When provided, the overlay renders a "reroll for gold" button. */
    rerollGold?: { cost: number; canAfford: boolean; onReroll: () => void };
    /** When provided, the overlay renders a "free reroll via ad" button. */
    rerollAd?: { onReroll: () => void };
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const h = document.createElement('h2');
    h.textContent = options.title;
    panel.appendChild(h);

    const sub = document.createElement('p');
    sub.className = 'subtitle';
    sub.textContent = options.subtitle;
    panel.appendChild(sub);

    const cards = document.createElement('div');
    cards.className = 'cards';
    for (const card of options.cards) {
      const c = document.createElement('button');
      c.className = `card ${card.rarity}`;
      const r = document.createElement('div');
      r.className = 'rarity';
      r.textContent = `${card.rarity.toUpperCase()} · ${categoryLabel(card.category)}`;
      const n = document.createElement('div');
      n.className = 'name';
      n.textContent = card.name;
      const d = document.createElement('div');
      d.className = 'desc';
      d.textContent = card.desc;
      c.appendChild(r);
      c.appendChild(n);
      c.appendChild(d);
      c.addEventListener('click', () => options.onPick(card));
      cards.appendChild(c);
    }
    panel.appendChild(cards);

    if (options.cards.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'var(--fg-dim)';
      empty.textContent = 'Все карты MVP уже получены — жми «Дальше».';
      panel.appendChild(empty);
    }

    // Reroll row under the cards.
    if (options.cards.length > 0 && (options.rerollGold || options.rerollAd)) {
      const row = document.createElement('div');
      row.className = 'card-reroll-row';
      row.style.display = 'flex';
      row.style.gap = '12px';
      row.style.justifyContent = 'center';
      row.style.marginTop = '14px';

      if (options.rerollGold) {
        const btn = document.createElement('button');
        btn.textContent = `Реролл · ${options.rerollGold.cost} g`;
        btn.disabled = !options.rerollGold.canAfford;
        btn.addEventListener('click', () => options.rerollGold!.onReroll());
        row.appendChild(btn);
      }
      if (options.rerollAd) {
        const btn = document.createElement('button');
        btn.textContent = 'Реролл · реклама';
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = 'var(--accent)';
        btn.addEventListener('click', () => options.rerollAd!.onReroll());
        row.appendChild(btn);
      }
      panel.appendChild(row);
    }

    this.root.appendChild(panel);
    this.root.classList.add('visible');
  }

  showSimple(opts: {
    title: string;
    subtitle: string;
    buttons: { label: string; primary?: boolean; onClick: () => void }[];
  }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const h = document.createElement('h2');
    h.textContent = opts.title;
    panel.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'subtitle';
    sub.textContent = opts.subtitle;
    panel.appendChild(sub);
    const wrap = document.createElement('div');
    wrap.className = 'menu-buttons';
    for (const b of opts.buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      el.addEventListener('click', b.onClick);
      if (b.primary) {
        el.style.borderColor = 'var(--accent)';
        el.style.color = 'var(--accent)';
      }
      wrap.appendChild(el);
    }
    panel.appendChild(wrap);
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

function categoryLabel(c: CardDef['category']): string {
  switch (c) {
    case 'recipe': return 'Рецепт';
    case 'engineering': return 'Инженерия';
    case 'ritual': return 'Ритуал';
    case 'catalyst': return 'Катализатор';
  }
}
