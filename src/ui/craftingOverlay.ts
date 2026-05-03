/**
 * Crafting overlay — opened from the «My Shop» card on the main menu.
 *
 * Shows the player's brewed-potion inventory (4 slots), the ingredient
 * stockpile, and the list of recipes. Each recipe row has a brew button
 * that is enabled when the player has all the ingredients and a free
 * inventory slot.
 *
 * No game logic lives here — UI calls into `brewPotion` from
 * `src/game/potions.ts` which mutates the meta save and persists it.
 *
 * Layout (per design request):
 *   ┌─ left column ──────────────┬─ right column ──────────────┐
 *   │  Зелья (inventory)         │                              │
 *   │  ─────────────             │       Рецепты (crafts)       │
 *   │  Ингредиенты               │                              │
 *   └────────────────────────────┴──────────────────────────────┘
 * Visually it borrows the warm gold/amber dramatic-stage palette used
 * by the defeat / blessing / loadout panels (rotating rays, sparks,
 * glitch title) so the brewery feels like a part of the same family.
 */
import type { MetaSave } from '../game/save';
import { t } from '../i18n';
import {
  ALL_INGREDIENT_IDS,
  INGREDIENTS,
  POTION_RECIPES,
  POTION_BY_ID,
  POTION_INVENTORY_SIZE,
  type IngredientId,
  type PotionRecipe,
} from '../data/potions';
import { brewPotion, canBrew } from '../game/potions';
import { buildDramaticStage, appendGlitchTitleChars } from './dramaticStage';

export class CraftingOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { meta: MetaSave; onClose: () => void }): void {
    this.render(opts);
    // Mark the shared overlay container as visible so it covers the canvas
    // (otherwise the panel renders inside a `display:none` host and the
    // player just sees the last-rendered game state behind it).
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.innerHTML = '';
    this.root.classList.remove('visible');
  }

  private render(opts: { meta: MetaSave; onClose: () => void }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel craft-panel';

    // Animated backdrop (rotating rays + sparks + sigil) — shared with
    // the dramatic family. Sits below all foreground content thanks to
    // `.mp-stage`'s own z-index: 0.
    panel.appendChild(buildDramaticStage());

    // ─── Header ──────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'craft-head';
    const title = document.createElement('h2');
    title.className = 'craft-title';
    appendGlitchTitleChars(title, t('ui.craft.title'));
    header.appendChild(title);
    const tagline = document.createElement('div');
    tagline.className = 'craft-tagline';
    tagline.textContent = t('ui.craft.tagline');
    header.appendChild(tagline);
    const sub = document.createElement('div');
    sub.className = 'craft-sub';
    sub.textContent = t('ui.craft.subtitle');
    header.appendChild(sub);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ─── Body: left column (inventory + ingredients) | right column (recipes) ───
    const body = document.createElement('div');
    body.className = 'craft-body';

    const leftCol = document.createElement('div');
    leftCol.className = 'craft-col craft-col-left';

    // Inventory section
    leftCol.appendChild(this.buildInventorySection(opts));
    // Ingredients section sits under the inventory
    leftCol.appendChild(this.buildIngredientsSection(opts));

    body.appendChild(leftCol);

    const rightCol = document.createElement('div');
    rightCol.className = 'craft-col craft-col-right';
    rightCol.appendChild(this.buildRecipesSection(opts));
    body.appendChild(rightCol);

    panel.appendChild(body);

    this.root.innerHTML = '';
    this.root.appendChild(panel);
  }

  /** Section: 4-slot potion inventory at the top of the left column. */
  private buildInventorySection(opts: { meta: MetaSave; onClose: () => void }): HTMLElement {
    const section = document.createElement('div');
    section.className = 'craft-section craft-inventory';

    const titleRow = document.createElement('div');
    titleRow.className = 'craft-section-title';
    titleRow.innerHTML = `<span class="craft-section-icon">⚗</span><span>${t('ui.craft.inventoryTitle')}</span>`;
    section.appendChild(titleRow);

    const slots = document.createElement('div');
    slots.className = 'craft-inv-slots';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const id = opts.meta.inventory[i];
      const recipe = id ? POTION_BY_ID[id] : null;
      const slot = document.createElement('div');
      slot.className = `craft-inv-slot${recipe ? ' filled' : ''}`;
      if (recipe) {
        slot.title = `${t(`${recipe.i18nKey}.name`)} — ${t(`${recipe.i18nKey}.desc`)}`;
        slot.innerHTML = `
          <span class="craft-inv-glow" style="--glyph-color:${recipe.color}"></span>
          <span class="glyph" style="color:${recipe.color}">${recipe.glyph}</span>
        `;
      } else {
        slot.textContent = '—';
      }
      slots.appendChild(slot);
    }
    section.appendChild(slots);
    return section;
  }

  /** Section: ingredient stockpile, one chip per ingredient type. */
  private buildIngredientsSection(opts: { meta: MetaSave; onClose: () => void }): HTMLElement {
    const section = document.createElement('div');
    section.className = 'craft-section craft-ing-block';

    const titleRow = document.createElement('div');
    titleRow.className = 'craft-section-title';
    titleRow.innerHTML = `<span class="craft-section-icon">🜨</span><span>${t('ui.craft.ingredientsTitle')}</span>`;
    section.appendChild(titleRow);

    const grid = document.createElement('div');
    grid.className = 'craft-ing-grid';
    for (const id of ALL_INGREDIENT_IDS) {
      const def = INGREDIENTS[id];
      const have = opts.meta.ingredients[id] ?? 0;
      const cell = document.createElement('div');
      cell.className = `craft-ing-cell${have > 0 ? ' has-stock' : ' empty'}`;
      cell.title = t(def.i18nKey);
      cell.innerHTML = `
        <span class="craft-ing-glyph" style="color:${def.color}">${def.glyph}</span>
        <span class="craft-ing-name">${t(def.i18nKey)}</span>
        <span class="craft-ing-count">${have}</span>
      `;
      grid.appendChild(cell);
    }
    section.appendChild(grid);
    return section;
  }

  /** Section: scrollable recipe list in the right column. */
  private buildRecipesSection(opts: { meta: MetaSave; onClose: () => void }): HTMLElement {
    const section = document.createElement('div');
    section.className = 'craft-section craft-recipes-section';

    const titleRow = document.createElement('div');
    titleRow.className = 'craft-section-title craft-recipes-title';
    titleRow.innerHTML = `<span class="craft-section-icon">📜</span><span>${t('ui.craft.recipesTitle')}</span>`;
    section.appendChild(titleRow);

    const list = document.createElement('div');
    list.className = 'craft-recipes';
    for (const recipe of POTION_RECIPES) {
      list.appendChild(this.buildRecipeRow(recipe, opts));
    }
    section.appendChild(list);
    return section;
  }

  private buildRecipeRow(
    recipe: PotionRecipe,
    opts: { meta: MetaSave; onClose: () => void },
  ): HTMLElement {
    const row = document.createElement('div');
    const fits = canBrew(opts.meta, recipe);
    row.className = `craft-recipe${fits ? ' is-ready' : ''}`;
    row.style.setProperty('--recipe-color', recipe.color);

    // Sweeping shimmer used for hover and (when ready) a slow ambient
    // pass to highlight brewable potions.
    const shimmer = document.createElement('span');
    shimmer.className = 'craft-recipe-shimmer';
    row.appendChild(shimmer);

    const left = document.createElement('div');
    left.className = 'craft-recipe-left';
    left.innerHTML = `
      <span class="craft-recipe-glyph" style="color:${recipe.color}">${recipe.glyph}</span>
      <div class="craft-recipe-text">
        <div class="craft-recipe-name">${t(`${recipe.i18nKey}.name`)}</div>
        <div class="craft-recipe-desc">${t(`${recipe.i18nKey}.desc`)}</div>
      </div>
    `;
    row.appendChild(left);

    const cost = document.createElement('div');
    cost.className = 'craft-recipe-cost';
    for (const [idRaw, need] of Object.entries(recipe.cost)) {
      if (need === undefined) continue;
      const id = idRaw as IngredientId;
      const def = INGREDIENTS[id];
      const have = opts.meta.ingredients[id] ?? 0;
      const ok = have >= need;
      const chip = document.createElement('span');
      chip.className = `craft-cost-chip${ok ? ' has' : ' missing'}`;
      chip.title = t(def.i18nKey);
      chip.innerHTML = `<span class="craft-ing-glyph" style="color:${def.color}">${def.glyph}</span><span class="craft-cost-num">${have}/${need}</span>`;
      cost.appendChild(chip);
    }
    row.appendChild(cost);

    const brewBtn = document.createElement('button');
    brewBtn.className = 'craft-brew-btn';
    brewBtn.textContent = t('ui.craft.brew');
    brewBtn.disabled = !fits;
    if (!fits) {
      const missingSlot = !opts.meta.inventory.includes(null);
      brewBtn.title = missingSlot
        ? t('ui.craft.inventoryFull')
        : t('ui.craft.notEnough');
    }
    brewBtn.addEventListener('click', () => {
      if (brewPotion(opts.meta, recipe) >= 0) {
        // Re-render so counts and slots update without losing the user's
        // place at the top of the list.
        this.render(opts);
      }
    });
    row.appendChild(brewBtn);
    return row;
  }
}
