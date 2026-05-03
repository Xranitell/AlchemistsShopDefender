/**
 * Tiny in-house i18n layer (PR-9 / GDD localization).
 *
 * Goals:
 *  - Zero runtime dependencies, zero bundle bloat.
 *  - Keep the source-of-truth Russian strings inline in `data/*.ts` as
 *    fallback so the game always has *some* text even if a key isn't in
 *    the dictionary yet (rolling localization).
 *  - Live locale switching via `setLocale(loc)`: every UI screen subscribes
 *    to `onLocaleChange` and rebuilds itself.
 *  - Default locale comes from the meta-save (`meta.locale`); when absent,
 *    we autodetect from `navigator.language` (`ru*` → 'ru', else 'en').
 *
 * Key naming convention:
 *  - `ui.<screen>.<element>`           — fixed UI strings.
 *  - `cards.<id>.name` / `.desc`       — content from data/cards.ts.
 *  - `towers.<id>.name` / `.desc`      — content from data/towers.ts.
 *  - `modules.<id>.name` / `.desc`     — content from data/modules.ts.
 *  - `enemies.<kind>.name`             — enemy display names.
 *  - `floating.<id>`                   — short floating-text strings.
 *
 * `t(key, params?)` substitutes `{name}` placeholders with values from
 * `params`. If `key` is missing in the active dictionary, the literal key
 * itself is returned — this surfaces missing translations loudly without
 * crashing the game.
 */

import { RU } from './ru';
import { EN } from './en';

export type Locale = 'ru' | 'en';

const DICTS: Record<Locale, Record<string, string>> = {
  ru: RU,
  en: EN,
};

let currentLocale: Locale = autodetect();
const listeners = new Set<() => void>();

function autodetect(): Locale {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'ru';
  return normalizeToLocale(lang);
}

/**
 * Normalize an arbitrary BCP-47 / Yandex SDK language tag (e.g. `"ru"`,
 * `"ru-RU"`, `"en-US"`, `"tr"`) to a supported `Locale`. Russian-family
 * tags map to `'ru'`; everything else falls back to `'en'`. Used both
 * by the autodetect path and by the runtime Yandex SDK integration —
 * keeping the rule centralised guarantees both sources agree.
 */
export function normalizeToLocale(lang: string | null | undefined): Locale {
  if (!lang) return 'ru';
  return String(lang).toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(loc: Locale): void {
  if (currentLocale === loc) return;
  currentLocale = loc;
  for (const cb of listeners) {
    try { cb(); } catch (e) { console.warn('[i18n] listener threw', e); }
  }
}

/**
 * Translate `key` with optional `{placeholder}` substitution. Falls back
 * to the literal key when missing — this is intentional, missing keys are
 * a visible localisation bug rather than a silent failure.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[currentLocale];
  let s = dict[key];
  if (s === undefined) {
    // Fallback chain: try the other locale (so RU strings show up even
    // when only RU has been authored yet for a particular key).
    const other: Locale = currentLocale === 'ru' ? 'en' : 'ru';
    s = DICTS[other][key];
  }
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/**
 * Subscribe to locale changes. Returns an unsubscribe function.
 */
export function onLocaleChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * Look up a content key with a fallback string. Used by the data-layer
 * accessors (e.g. `cardName(card)`): if no translation exists for the
 * given key, the data file's source-of-truth Russian string is returned
 * unchanged.
 */
export function tWithFallback(key: string, fallback: string): string {
  const dict = DICTS[currentLocale];
  if (dict[key] !== undefined) return dict[key];
  // Fallback chain: try the other locale (English coverage may be partial).
  const other: Locale = currentLocale === 'ru' ? 'en' : 'ru';
  if (DICTS[other][key] !== undefined) return DICTS[other][key];
  return fallback;
}
