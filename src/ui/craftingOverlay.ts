/**
 * Crafting overlay — opened from the «My Shop» card on the main menu.
 *
 * Shows the player's ingredient stockpile, the brewed-potion inventory
 * (4 slots), and the 10 recipes. Each recipe row has a brew button that is
 * enabled when the player has all the ingredients and a free inventory slot.
 *
 * No game logic lives here — UI calls into `brewPotion` from
 * `src/game/potions.ts` which mutates the meta save and persists it.
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

export class CraftingOverlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(opts: { meta: MetaSave; onClose: () => void }): void {
    this.render(opts);
  }

  hide(): void {
    this.root.innerHTML = '';
  }

  private render(opts: { meta: MetaSave; onClose: () => void }): void {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel craft-panel';

    // ─── Header ──────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'craft-header';
    const h = document.createElement('h2');
    h.textContent = t('ui.craft.title');
    header.appendChild(h);
    const sub = document.createElement('span');
    sub.className = 'craft-sub';
    sub.textContent = t('ui.craft.subtitle');
    header.appendChild(sub);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', opts.onClose);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ─── Inventory + ingredients summary ─────────────────────────
    const summary = document.createElement('div');
    summary.className = 'craft-summary';

    const invBlock = document.createElement('div');
    invBlock.className = 'craft-inventory';
    const invTitle = document.createElement('div');
    invTitle.className = 'craft-section-title';
    invTitle.textContent = t('ui.craft.inventoryTitle');
    invBlock.appendChild(invTitle);
    const invSlots = document.createElement('div');
    invSlots.className = 'craft-inv-slots';
    for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
      const id = opts.meta.inventory[i];
      const recipe = id ? POTION_BY_ID[id] : null;
      const slot = document.createElement('div');
      slot.className = `craft-inv-slot${recipe ? ' filled' : ''}`;
      if (recipe) {
        slot.title = `${t(`${recipe.i18nKey}.name`)} — ${t(`${recipe.i18nKey}.desc`)}`;
        slot.innerHTML = `<span class="glyph" style="color:${recipe.color}">${recipe.glyph}</span>`;
      } else {
        slot.textContent = '—';
      }
      invSlots.appendChild(slot);
    }
    invBlock.appendChild(invSlots);
    summary.appendChild(invBlock);

    const ingBlock = document.createElement('div');
    ingBlock.className = 'craft-ing-block';
    const ingTitle = document.createElement('div');
    ingTitle.className = 'craft-section-title';
    ingTitle.textContent = t('ui.craft.ingredientsTitle');
    ingBlock.appendChild(ingTitle);
    const ingGrid = document.createElement('div');
    ingGrid.className = 'craft-ing-grid';
    for (const id of ALL_INGREDIENT_IDS) {
      const def = INGREDIENTS[id];
      const have = opts.meta.ingredients[id] ?? 0;
      const cell = document.createElement('div');
      cell.className = 'craft-ing-cell';
      cell.innerHTML = `
        <span class="craft-ing-glyph" style="color:${def.color}">${def.glyph}</span>
        <span class="craft-ing-name">${t(def.i18nKey)}</span>
        <span class="craft-ing-count">${have}</span>
      `;
      ingGrid.appendChild(cell);
    }
    ingBlock.appendChild(ingGrid);
    summary.appendChild(ingBlock);

    panel.appendChild(summary);

    // ─── Recipes ─────────────────────────────────────────────────
    const recipesTitle = document.createElement('div');
    recipesTitle.className = 'craft-section-title craft-recipes-title';
    recipesTitle.textContent = t('ui.craft.recipesTitle');
    panel.appendChild(recipesTitle);

    const list = document.createElement('div');
    list.className = 'craft-recipes';

    for (const recipe of POTION_RECIPES) {
      list.appendChild(this.buildRecipeRow(recipe, opts));
    }
    panel.appendChild(list);

    this.root.innerHTML = '';
    this.root.appendChild(panel);
  }

  private buildRecipeRow(
    recipe: PotionRecipe,
    opts: { meta: MetaSave; onClose: () => void },
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'craft-recipe';

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
      chip.className = `craft-cost-chip${ok ? '' : ' missing'}`;
      chip.title = t(def.i18nKey);
      chip.innerHTML = `<span class="craft-ing-glyph" style="color:${def.color}">${def.glyph}</span><span class="craft-cost-num">${have}/${need}</span>`;
      cost.appendChild(chip);
    }
    row.appendChild(cost);

    const brewBtn = document.createElement('button');
    brewBtn.className = 'craft-brew-btn';
    brewBtn.textContent = t('ui.craft.brew');
    const fits = canBrew(opts.meta, recipe);
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
