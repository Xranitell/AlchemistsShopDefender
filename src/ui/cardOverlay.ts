import type { CardDef } from '../game/types';
import { pickedSynergyNames, cardName, cardDesc } from '../data/cards';
import { audio } from '../audio/audio';
import { t } from '../i18n';

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
    /** When provided, the overlay renders a "Skip" pill that lets the player
     *  decline the current offer entirely (no card applied). */
    onSkip?: () => void;
    /** When true, the overlay paints itself in the cursed colourway so the
     *  player can tell at a glance that this draft is the every-3rd-wave
     *  cursed offering. */
    cursed?: boolean;
  }): void {
    this.root.innerHTML = '';
    this.root.classList.add('cards-mode');
    this.root.classList.toggle('cursed-mode', !!options.cursed);
    const stage = document.createElement('div');
    stage.className = 'cards-stage';
    if (options.cursed) stage.classList.add('cursed');

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
      empty.textContent = t('ui.cards.empty');
      stage.appendChild(empty);
    }

    // Bottom action strip ("Реролл / Реролл реклама / Пропустить") — modeled
    // after the Reaper Hunt mockup. Each pill shows a label + optional
    // counter; the counter is the gold cost or remaining ad uses. The Skip
    // pill is rendered whenever an `onSkip` callback was provided so the
    // player can decline the offer entirely (e.g. on a cursed draft they
    // don't want to take).
    const showActionRow =
      options.cards.length > 0 &&
      (options.rerollGold || options.rerollAd || options.onSkip);
    if (showActionRow) {
      const row = document.createElement('div');
      row.className = 'cards-action-row';

      if (options.rerollGold) {
        row.appendChild(
          buildActionPill({
            label: t('ui.cards.reroll'),
            counter: `${options.rerollGold.cost}`,
            disabled: !options.rerollGold.canAfford,
            onClick: () => options.rerollGold!.onReroll(),
          }),
        );
      }
      if (options.rerollAd) {
        row.appendChild(
          buildActionPill({
            label: t('ui.cards.rerollAd'),
            counter: '1',
            accent: true,
            onClick: () => options.rerollAd!.onReroll(),
          }),
        );
      }
      if (options.onSkip) {
        row.appendChild(
          buildActionPill({
            label: t('ui.cards.skip'),
            danger: true,
            onClick: () => options.onSkip!(),
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
    this.root.classList.remove('cursed-mode');
    this.root.innerHTML = '';
  }

  isVisible(): boolean {
    return this.root.classList.contains('visible');
  }

  getRootElement(): HTMLElement {
    return this.root;
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
  if (card.isCursed) c.classList.add('cursed');
  c.setAttribute('aria-label', cardName(card));

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

  // Optional banner: cursed cards are flagged with a red "ПРОКЛЯТАЯ" tag,
  // legendaries with the existing yellow "НОВОЕ!" badge. Cursed wins if both
  // apply.
  if (card.isCursed) {
    const tag = document.createElement('div');
    tag.className = 'card-rh-tag cursed';
    tag.textContent = t('ui.cards.cursed');
    frame.appendChild(tag);
  } else if (card.rarity === 'legendary') {
    const tag = document.createElement('div');
    tag.className = 'card-rh-tag';
    tag.textContent = t('ui.cards.new');
    frame.appendChild(tag);
  }

  // Title (small caps).
  const title = document.createElement('div');
  title.className = 'card-rh-title';
  title.textContent = cardName(card);
  frame.appendChild(title);

  // Divider line
  const div = document.createElement('div');
  div.className = 'card-rh-divider';
  frame.appendChild(div);

  // Effects: split desc into bullets at sentence-like boundaries and wrap any
  // numeric tokens with a bright value chip so the chrome reads at a glance.
  // For cursed cards, lines that describe unique effects (not plain stat
  // changes) get a distinct frame + background so the player can tell the
  // special ability apart from the stat boosts.
  const ul = document.createElement('ul');
  ul.className = 'card-rh-effects';
  const descLines = splitDesc(cardDesc(card));
  for (const line of descLines) {
    const li = document.createElement('li');
    li.innerHTML = formatEffectLine(line);
    if (card.isCursed && isUniqueEffectLine(line)) {
      li.classList.add('card-rh-unique');
    }
    ul.appendChild(li);
  }
  frame.appendChild(ul);

  // Synergy footer (GDD §15.2): "Синергирует с: ..." below the effects, kept
  // visually subtle so it doesn't compete with the title.
  const synergies = pickedSynergyNames(card.id, picked);
  if (synergies.length > 0) {
    const syn = document.createElement('div');
    syn.className = 'card-rh-synergy';
    syn.textContent = t('ui.cards.synergy', { names: synergies.slice(0, 2).join(', ') });
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

/** Detect whether a description bullet describes a unique effect (vs a plain
 *  stat change). Stat lines start with +/-/×/numbers; unique lines start with
 *  verbs/nouns describing a special mechanic. */
function isUniqueEffectLine(line: string): boolean {
  const trimmed = line.trim();
  // Stat-change lines start with +, -, −, ×, or a digit (e.g. "50% шанс...")
  if (/^[+\-−×\d]/.test(trimmed)) return false;
  // Lines about enemies getting buffs are drawbacks, not unique effects
  if (/^враги\b/i.test(trimmed)) return false;
  // Lines about cooldown/cost penalties
  if (/откат|стоят|стоимость/i.test(trimmed) && /\+\d/.test(trimmed)) return false;
  return true;
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
  /** Optional small chip on the right (gold cost / counter). Hidden when
   *  omitted, e.g. on the Skip pill. */
  counter?: string;
  disabled?: boolean;
  accent?: boolean;
  /** Renders the pill in the warning/red colourway used for "Skip". */
  danger?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'cards-action-pill';
  if (opts.accent) b.classList.add('accent');
  if (opts.danger) b.classList.add('danger');
  if (opts.disabled) b.disabled = true;
  const lab = document.createElement('span');
  lab.className = 'cards-action-label';
  lab.textContent = opts.label;
  b.appendChild(lab);
  if (opts.counter !== undefined) {
    const cnt = document.createElement('span');
    cnt.className = 'cards-action-counter';
    cnt.textContent = opts.counter;
    b.appendChild(cnt);
  }
  b.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  b.addEventListener('click', () => {
    audio.playSfx('uiClick');
    opts.onClick();
  });
  return b;
}
