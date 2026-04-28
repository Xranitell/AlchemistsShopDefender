import type { CardDef } from '../game/types';
import { pickedSynergyNames } from '../data/cards';
import { audio } from '../audio/audio';

export class CardOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(options: {
    title: string;
    subtitle: string;
    cards: CardDef[];
    /** Cards already taken in this run, used to surface synergy hints on the
     *  cards being offered. */
    pickedIds?: readonly string[];
    onPick: (card: CardDef) => void;
    /** When provided, the overlay renders a "reroll for gold" button. */
    rerollGold?: { cost: number; canAfford: boolean; onReroll: () => void };
    /** When provided, the overlay renders a "free reroll via ad" button. */
    rerollAd?: { onReroll: () => void };
  }): void {
    this.root.innerHTML = '';
    this.root.classList.add('cards-mode');
    const stage = document.createElement('div');
    stage.className = 'cards-stage';

    const h = document.createElement('h2');
    h.className = 'cards-stage-title';
    h.textContent = options.title;
    stage.appendChild(h);

    if (options.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'cards-stage-subtitle';
      sub.textContent = options.subtitle;
      stage.appendChild(sub);
    }

    const cards = document.createElement('div');
    cards.className = 'cards-rh';
    const picked = options.pickedIds ?? [];
    for (const card of options.cards) {
      cards.appendChild(buildCardElement(card, picked, options.onPick));
    }
    stage.appendChild(cards);

    if (options.cards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cards-empty';
      empty.textContent = 'Все карты уже получены — жми «Дальше».';
      stage.appendChild(empty);
    }

    // Bottom action strip ("Реролл / Реролл реклама") — modeled after the
    // Reaper Hunt mockup. Each pill shows a label + counter; the counter is
    // the gold cost or remaining ad uses.
    if (options.cards.length > 0 && (options.rerollGold || options.rerollAd)) {
      const row = document.createElement('div');
      row.className = 'cards-action-row';

      if (options.rerollGold) {
        row.appendChild(
          buildActionPill({
            label: 'Реролл',
            counter: `${options.rerollGold.cost}`,
            disabled: !options.rerollGold.canAfford,
            onClick: () => options.rerollGold!.onReroll(),
          }),
        );
      }
      if (options.rerollAd) {
        row.appendChild(
          buildActionPill({
            label: 'Реролл реклама',
            counter: '1',
            accent: true,
            onClick: () => options.rerollAd!.onReroll(),
          }),
        );
      }
      stage.appendChild(row);
    }

    this.root.appendChild(stage);
    this.root.classList.add('visible');
  }

  showSimple(opts: {
    title: string;
    subtitle: string;
    buttons: { label: string; primary?: boolean; onClick: () => void }[];
  }): void {
    this.root.innerHTML = '';
    this.root.classList.remove('cards-mode');
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
      el.addEventListener('click', () => {
        audio.playSfx('uiClick');
        b.onClick();
      });
      el.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
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
    this.root.classList.remove('cards-mode');
    this.root.innerHTML = '';
  }

  isVisible(): boolean {
    return this.root.classList.contains('visible');
  }
}

/** Build one card in the Reaper-Hunt-style layout: angled top with a category
 *  glyph, name in caps, divider, a list of effect bullets, and an optional
 *  synergy footer.
 */
function buildCardElement(
  card: CardDef,
  picked: readonly string[],
  onPick: (c: CardDef) => void,
): HTMLElement {
  const c = document.createElement('button');
  c.className = `card-rh rarity-${card.rarity} cat-${card.category}`;
  c.setAttribute('aria-label', card.name);

  const frame = document.createElement('div');
  frame.className = 'card-rh-frame';
  c.appendChild(frame);

  // Top: category glyph in a colored panel.
  const top = document.createElement('div');
  top.className = 'card-rh-top';
  const glyph = document.createElement('div');
  glyph.className = 'card-rh-glyph';
  glyph.innerHTML = categoryGlyphSvg(card.category);
  top.appendChild(glyph);
  frame.appendChild(top);

  // Optional "NEW!" banner for legendary, mirrored from the reference image.
  if (card.rarity === 'legendary') {
    const tag = document.createElement('div');
    tag.className = 'card-rh-tag';
    tag.textContent = 'НОВОЕ!';
    frame.appendChild(tag);
  }

  // Title (small caps).
  const title = document.createElement('div');
  title.className = 'card-rh-title';
  title.textContent = card.name;
  frame.appendChild(title);

  // Divider line
  const div = document.createElement('div');
  div.className = 'card-rh-divider';
  frame.appendChild(div);

  // Effects: split desc into bullets at sentence-like boundaries and wrap any
  // numeric tokens with a bright value chip so the chrome reads at a glance.
  const ul = document.createElement('ul');
  ul.className = 'card-rh-effects';
  for (const line of splitDesc(card.desc)) {
    const li = document.createElement('li');
    li.innerHTML = formatEffectLine(line);
    ul.appendChild(li);
  }
  frame.appendChild(ul);

  // Synergy footer (GDD §15.2): "Синергирует с: ..." below the effects, kept
  // visually subtle so it doesn't compete with the title.
  const synergies = pickedSynergyNames(card.id, picked);
  if (synergies.length > 0) {
    const syn = document.createElement('div');
    syn.className = 'card-rh-synergy';
    syn.textContent = `Синергирует с: ${synergies.slice(0, 2).join(', ')}`;
    frame.appendChild(syn);
    c.classList.add('has-synergy');
  }

  c.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  c.addEventListener('click', () => {
    audio.playSfx('cardPick');
    onPick(card);
  });
  return c;
}

/** Split the card description into 1-3 short bullets at sentence-ish
 *  delimiters: ". ", "; ", " · ". Empty fragments are dropped. */
function splitDesc(desc: string): string[] {
  const parts = desc
    .split(/(?:\.\s+|;\s+|\s\u00B7\s)/)
    .map((p) => p.trim().replace(/\.$/, ''))
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [desc];
}

/** Wrap numeric tokens like "+30%", "×1.5", "5–8 врагов", "10 сек" with a
 *  highlighted value chip so the card chrome echoes the reference design. */
function formatEffectLine(line: string): string {
  // Escape HTML first.
  const escaped = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Numeric tokens: leading +/- optional, integers / decimals, optional %.
  // We avoid matching plain "10 сек" as a value chip — only flag explicit
  // multipliers / percentages / signed numbers.
  return escaped.replace(
    /([+\-−]?\s?\d+(?:[.,]\d+)?\s?%|×\s?\d+(?:[.,]\d+)?|\+\s?\d+(?:[.,]\d+)?)/g,
    '<span class="card-rh-val">$1</span>',
  );
}

/** SVG glyph for each card category — a tiny mark drawn in the top of the
 *  card. Kept inline so we don't need an asset pipeline. */
function categoryGlyphSvg(cat: CardDef['category']): string {
  switch (cat) {
    case 'recipe':
      // Bubbling potion bottle.
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 2 h6 v3 H9z" />
        <path d="M10 5 v3 l-3 5 a5 5 0 0 0 10 0 l-3 -5 v-3" />
        <circle cx="11" cy="14" r="0.6" fill="currentColor"/>
        <circle cx="13.5" cy="16" r="0.6" fill="currentColor"/>
      </svg>`;
    case 'engineering':
      // Crossed wrench/hammer = engineering.
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21 L13 11" />
        <path d="M11 13 a3 3 0 0 0 4 -4 l-2 2 -2 -2 -2 2 a3 3 0 0 0 2 2z" />
        <path d="M16 3 l5 5 -3 3 -5 -5 z" />
      </svg>`;
    case 'ritual':
      // Triangle warning = ritual rite.
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 L22 20 H2 Z" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="12" y1="17" x2="12" y2="17.4" />
      </svg>`;
    case 'catalyst':
      // Diamond / orbital catalyst = sparkle.
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 L19 12 L12 21 L5 12 Z" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>`;
  }
}

/** A single bottom-strip action pill: "Реролл [counter]". The counter is
 *  rendered inside a small angled chip on the right, matching the screenshot.
 */
function buildActionPill(opts: {
  label: string;
  counter: string;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'cards-action-pill';
  if (opts.accent) b.classList.add('accent');
  if (opts.disabled) b.disabled = true;
  const lab = document.createElement('span');
  lab.className = 'cards-action-label';
  lab.textContent = opts.label;
  const cnt = document.createElement('span');
  cnt.className = 'cards-action-counter';
  cnt.textContent = opts.counter;
  b.appendChild(lab);
  b.appendChild(cnt);
  b.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  b.addEventListener('click', () => {
    audio.playSfx('uiClick');
    opts.onClick();
  });
  return b;
}
