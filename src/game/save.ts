import {
  DEFAULT_ACTIVE_MODULE,
  DEFAULT_AURA_MODULE,
  isActiveModule,
  isAuraModule,
} from '../data/modules';
import {
  ALL_INGREDIENT_IDS,
  POTION_BY_ID,
  POTION_INVENTORY_SIZE,
  type IngredientId,
} from '../data/potions';
import { META_BY_ID } from '../data/metaTree';

const SAVE_KEY = 'asd_meta_v2';

export interface MetaSave {
  blueEssence: number;
  ancientEssence: number;
  keys: number;
  /** Unlocks Epic difficulty — one consumed per run. */
  epicKeys: number;
  /** Unlocks Ancient difficulty — one consumed per run. */
  ancientKeys: number;
  purchased: string[];
  bestWave: number;
  totalRuns: number;
  // Daily rewards
  dailyDay: number;
  dailyLastClaim: string;
  // Battle pass
  bpLevel: number;
  bpXp: number;
  bpPremium: boolean;
  bpClaimedFree: number[];
  bpClaimedPremium: number[];
  // Extra rerolls from daily rewards
  bonusRerolls: number;
  // Crafting level (shop upgrades)
  craftingLevel: number;
  /** Mannequin module loadout (GDD §11.2). One active + one aura. Defaults
   *  preserve pre-loadout behaviour: lightning Overload + magnet aura. */
  selectedActiveModule: string;
  selectedAuraModule: string;
  /** Audio volumes (0..1). Defaults match GDD §16 ambient/SFX balance. */
  sfxVolume: number;
  musicVolume: number;
  /** First-time-user-experience flag (GDD §18). True once the player has
   *  cleared wave 5 in the very first run, or hit "Skip tutorial". */
  tutorialDone: boolean;
  /** Set once the player has seen the pause-panel walkthrough at least
   *  once. Prevents the panel sequence from replaying every time the
   *  player opens the pause overlay. */
  pauseTutorialDone: boolean;
  /** Set once the player has seen the main-menu walkthrough. Same idea
   *  as `pauseTutorialDone` but for the between-runs main menu. */
  menuTutorialDone: boolean;
  /** UI locale for i18n (PR-9). 'ru' or 'en'. Empty/missing = autodetect. */
  locale: 'ru' | 'en';
  /** True once the player has explicitly picked a locale via the in-game
   *  language switcher. While false, we let the Yandex SDK's
   *  `environment.i18n.lang` override the locale on session start so the
   *  game follows the player's Yandex profile language without ever
   *  ignoring an in-game choice. */
  localeUserChoice: boolean;
  /** Mode-mastery counters: number of full victories per difficulty. Each
   *  Epic / Ancient victory grants +1 mastery, which scales blue-essence
   *  drops in *every* future run by a small amount (capped). This is the
   *  meta hook that makes higher modes worth replaying — see
   *  `masteryEssenceMult` in game/meta.ts. */
  epicMastery: number;
  ancientMastery: number;
  // ─── Potion crafting (PR-«крафт») ───────────────────────────────────────
  /** Stockpile of crafting ingredients. Keys come from `IngredientId`; missing
   *  keys are treated as 0. Drops persist across runs. */
  ingredients: Partial<Record<IngredientId, number>>;
  /** Brewed-potion inventory carried across runs. Fixed length =
   *  `POTION_INVENTORY_SIZE` (4); each slot is either a recipe id or `null`. */
  inventory: (string | null)[];
}

export function newMetaSave(): MetaSave {
  return {
    blueEssence: 0,
    ancientEssence: 0,
    keys: 0,
    // Give the player 1 of each at the very start so the new difficulty
    // modes are reachable without waiting for shop progression.
    epicKeys: 1,
    ancientKeys: 1,
    purchased: [],
    bestWave: 0,
    totalRuns: 0,
    dailyDay: 0,
    dailyLastClaim: '',
    bpLevel: 0,
    bpXp: 0,
    bpPremium: false,
    bpClaimedFree: [],
    bpClaimedPremium: [],
    bonusRerolls: 0,
    craftingLevel: 1,
    selectedActiveModule: DEFAULT_ACTIVE_MODULE,
    selectedAuraModule: DEFAULT_AURA_MODULE,
    sfxVolume: 0.6,
    musicVolume: 0.4,
    tutorialDone: false,
    pauseTutorialDone: false,
    menuTutorialDone: false,
    locale: defaultLocale(),
    localeUserChoice: false,
    epicMastery: 0,
    ancientMastery: 0,
    ingredients: {},
    inventory: emptyInventory(),
  };
}

function emptyInventory(): (string | null)[] {
  return Array.from({ length: POTION_INVENTORY_SIZE }, () => null);
}

function sanitizeIngredients(
  raw: unknown,
): Partial<Record<IngredientId, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<IngredientId, number>> = {};
  for (const id of ALL_INGREDIENT_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[id] = Math.floor(v);
    }
  }
  return out;
}

/** Drop any allocated upgrade ids that are no longer present in the meta
 *  tree. Old saves built against the previous tree layout would otherwise
 *  carry ghost ids that confuse refund-connectivity checks. */
function sanitizePurchased(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    if (!META_BY_ID[id]) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

function sanitizeInventory(raw: unknown): (string | null)[] {
  const out = emptyInventory();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
    const v = raw[i];
    if (typeof v === 'string' && POTION_BY_ID[v]) out[i] = v;
  }
  return out;
}

function defaultLocale(): 'ru' | 'en' {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'ru';
  return lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    // Also try migrating from v1
    const rawV1 = !raw ? localStorage.getItem('asd_meta_v1') : null;
    const source = raw ?? rawV1;
    if (!source) return newMetaSave();
    const data = JSON.parse(source) as Partial<MetaSave>;
    const result: MetaSave = {
      blueEssence: data.blueEssence ?? 0,
      ancientEssence: data.ancientEssence ?? 0,
      keys: data.keys ?? 0,
      epicKeys: data.epicKeys ?? 1,
      ancientKeys: data.ancientKeys ?? 1,
      purchased: sanitizePurchased(data.purchased),
      bestWave: data.bestWave ?? 0,
      totalRuns: data.totalRuns ?? 0,
      dailyDay: data.dailyDay ?? 0,
      dailyLastClaim: data.dailyLastClaim ?? '',
      bpLevel: data.bpLevel ?? 0,
      bpXp: data.bpXp ?? 0,
      bpPremium: data.bpPremium ?? false,
      bpClaimedFree: Array.isArray(data.bpClaimedFree) ? data.bpClaimedFree : [],
      bpClaimedPremium: Array.isArray(data.bpClaimedPremium) ? data.bpClaimedPremium : [],
      bonusRerolls: data.bonusRerolls ?? 0,
      craftingLevel: data.craftingLevel ?? 1,
      // Migration: existing saves predate the loadout. Default to the
      // pre-loadout behaviour (lightning + magnet) and validate against the
      // current module catalog so removed ids fall back gracefully.
      selectedActiveModule: isActiveModule(data.selectedActiveModule ?? '')
        ? (data.selectedActiveModule as string)
        : DEFAULT_ACTIVE_MODULE,
      selectedAuraModule: isAuraModule(data.selectedAuraModule ?? '')
        ? (data.selectedAuraModule as string)
        : DEFAULT_AURA_MODULE,
      sfxVolume: clampVolume(data.sfxVolume, 0.6),
      musicVolume: clampVolume(data.musicVolume, 0.4),
      // Migration: pre-FTUE saves had no tutorial flag. Treat any returning
      // player who has at least one finished run as having seen the
      // tutorial — we don't want to nag veterans with the wave-1 hint.
      tutorialDone: typeof data.tutorialDone === 'boolean'
        ? data.tutorialDone
        : (data.totalRuns ?? 0) > 0,
      // Migration: returning players with at least one finished run have
      // already discovered the pause / main-menu UI on their own — don't
      // pop the panel walkthrough at them retroactively. New saves get
      // both flags set to false so the walkthroughs play exactly once.
      pauseTutorialDone: typeof data.pauseTutorialDone === 'boolean'
        ? data.pauseTutorialDone
        : (data.totalRuns ?? 0) > 0,
      menuTutorialDone: typeof data.menuTutorialDone === 'boolean'
        ? data.menuTutorialDone
        : (data.totalRuns ?? 0) > 0,
      locale: data.locale === 'en' || data.locale === 'ru' ? data.locale : defaultLocale(),
      // Existing saves without the explicit-choice flag are treated as
      // "explicit" so we don't flip the player's previously persisted
      // language out from under them on the first session after the
      // Yandex SDK integration ships.
      localeUserChoice: typeof data.localeUserChoice === 'boolean' ? data.localeUserChoice : true,
      epicMastery: typeof data.epicMastery === 'number' ? Math.max(0, Math.floor(data.epicMastery)) : 0,
      ancientMastery: typeof data.ancientMastery === 'number' ? Math.max(0, Math.floor(data.ancientMastery)) : 0,
      ingredients: sanitizeIngredients((data as Record<string, unknown>).ingredients),
      inventory: sanitizeInventory((data as Record<string, unknown>).inventory),
    };
    // If migrated from v1, save as v2
    if (rawV1 && !raw) {
      saveMeta(result);
    }
    return result;
  } catch {
    return newMetaSave();
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
  } catch {
    // localStorage may be unavailable
  }
}

export function resetMeta(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('asd_meta_v1');
  } catch {
    // ignore
  }
}

function clampVolume(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function canClaimDaily(meta: MetaSave): boolean {
  return meta.dailyLastClaim !== todayString();
}
