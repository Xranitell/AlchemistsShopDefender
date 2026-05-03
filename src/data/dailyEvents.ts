// ── Daily Events (Daily Experiment) ─────────────────────────────────────────
// One unique event per weekday that rotates on a 7-day cycle anchored to
// 00:00 Europe/Moscow. The event is selected via `getTodayEvent()` from the
// current MSK weekday; its modifiers and visual flags are applied during
// `startRun('daily')` in `main.ts`.
//
// Events reuse the existing `DifficultyModifier` shape (hp/speed/dmg/gold
// multipliers + ability flags) where possible, plus a small set of
// extra knobs read by gameplay/render to add things like the night-mode
// vignette or the boss-only wave list. New flags are simple booleans on
// the event def — no per-event class hierarchy.

import type { DifficultyModifier } from './difficulty';

export type DailyEventId =
  | 'night'
  | 'boss'
  | 'speedrun'
  | 'glass_cannon'
  | 'horde'
  | 'abundance'
  | 'chaos';

export interface DailyEventDef {
  id: DailyEventId;
  /** 0=Sun, 1=Mon … 6=Sat (matches `moscowToday().weekday`). */
  weekday: number;
  /** i18n key for the human-readable event name. */
  i18nName: string;
  /** i18n key for a one-line tagline shown on the day-card. */
  i18nFlavor: string;
  /** i18n key for the multi-line description paragraph. */
  i18nDescription: string;
  /** i18n keys for the bullet-list of effects shown in the preview panel. */
  i18nLines: string[];
  /** Emoji / glyph used as the day icon. */
  icon: string;
  /** Accent colour for ribbon / border. */
  color: string;
  /** Stat multipliers applied to every spawned enemy. */
  modifier: DifficultyModifier;
  // ── Per-event flags (read by gameplay / render) ───────────────────────
  /** Use `BOSS_WAVES` in `wave.ts` instead of the standard wave list. */
  useBossWaves?: boolean;
  /** Apply an extra spawn-count multiplier on top of base wave defs. */
  spawnCountMult?: number;
  /** Halve the player's mannequin HP at run start (Glass Cannon). */
  playerHpMult?: number;
  /** Multiplier applied to thrown-potion damage (Glass Cannon / Abundance). */
  playerDamageMult?: number;
  /** Activate a "fog of war" / dark vignette in the renderer (Night Mode). */
  nightMode?: boolean;
  /** Trigger a random "rare" endless modifier roll at run start (Chaos). */
  chaosModifier?: boolean;
}

export const DAILY_EVENTS: DailyEventDef[] = [
  {
    id: 'night',
    weekday: 1, // Monday
    i18nName: 'ui.dailyEvent.night.name',
    i18nFlavor: 'ui.dailyEvent.night.flavor',
    i18nDescription: 'ui.dailyEvent.night.desc',
    i18nLines: [
      'ui.dailyEvent.night.line.vis',
      'ui.dailyEvent.night.line.gold',
    ],
    icon: '🌙',
    color: '#7d8eff',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1.4,
      abilities: [],
    },
    nightMode: true,
  },
  {
    id: 'boss',
    weekday: 2, // Tuesday
    i18nName: 'ui.dailyEvent.boss.name',
    i18nFlavor: 'ui.dailyEvent.boss.flavor',
    i18nDescription: 'ui.dailyEvent.boss.desc',
    i18nLines: [
      'ui.dailyEvent.boss.line.waves',
      'ui.dailyEvent.boss.line.stats',
      'ui.dailyEvent.boss.line.gold',
    ],
    icon: '💀',
    color: '#ef476f',
    modifier: {
      hpMult: 1.2,
      speedMult: 1.1,
      damageMult: 1.1,
      goldMult: 1.5,
      abilities: [],
    },
    useBossWaves: true,
  },
  {
    id: 'speedrun',
    weekday: 3, // Wednesday
    i18nName: 'ui.dailyEvent.speedrun.name',
    i18nFlavor: 'ui.dailyEvent.speedrun.flavor',
    i18nDescription: 'ui.dailyEvent.speedrun.desc',
    i18nLines: [
      'ui.dailyEvent.speedrun.line.speed',
      'ui.dailyEvent.speedrun.line.gold',
    ],
    icon: '💨',
    color: '#06d6a0',
    modifier: {
      hpMult: 1,
      speedMult: 1.5,
      damageMult: 1,
      goldMult: 1.3,
      abilities: [],
    },
  },
  {
    id: 'glass_cannon',
    weekday: 4, // Thursday
    i18nName: 'ui.dailyEvent.glass_cannon.name',
    i18nFlavor: 'ui.dailyEvent.glass_cannon.flavor',
    i18nDescription: 'ui.dailyEvent.glass_cannon.desc',
    i18nLines: [
      'ui.dailyEvent.glass_cannon.line.dmg',
      'ui.dailyEvent.glass_cannon.line.hp',
      'ui.dailyEvent.glass_cannon.line.gold',
    ],
    icon: '⚡',
    color: '#ffd166',
    modifier: {
      hpMult: 0.5,
      speedMult: 1,
      damageMult: 2,
      goldMult: 1.4,
      abilities: [],
    },
    playerHpMult: 0.5,
    playerDamageMult: 2,
  },
  {
    id: 'horde',
    weekday: 5, // Friday
    i18nName: 'ui.dailyEvent.horde.name',
    i18nFlavor: 'ui.dailyEvent.horde.flavor',
    i18nDescription: 'ui.dailyEvent.horde.desc',
    i18nLines: [
      'ui.dailyEvent.horde.line.count',
      'ui.dailyEvent.horde.line.hp',
      'ui.dailyEvent.horde.line.gold',
    ],
    icon: '🐀',
    color: '#c084fc',
    modifier: {
      hpMult: 0.8,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1.3,
      abilities: [],
    },
    spawnCountMult: 1.5,
  },
  {
    id: 'abundance',
    weekday: 6, // Saturday
    i18nName: 'ui.dailyEvent.abundance.name',
    i18nFlavor: 'ui.dailyEvent.abundance.flavor',
    i18nDescription: 'ui.dailyEvent.abundance.desc',
    i18nLines: [
      'ui.dailyEvent.abundance.line.hp',
      'ui.dailyEvent.abundance.line.dmg',
      'ui.dailyEvent.abundance.line.gold',
    ],
    icon: '✨',
    color: '#7df9ff',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1.5,
      abilities: [],
    },
    playerHpMult: 1.5,
    playerDamageMult: 1.25,
  },
  {
    id: 'chaos',
    weekday: 0, // Sunday
    i18nName: 'ui.dailyEvent.chaos.name',
    i18nFlavor: 'ui.dailyEvent.chaos.flavor',
    i18nDescription: 'ui.dailyEvent.chaos.desc',
    i18nLines: [
      'ui.dailyEvent.chaos.line.mod',
      'ui.dailyEvent.chaos.line.gold',
    ],
    icon: '🌀',
    color: '#f9c74f',
    modifier: {
      hpMult: 1.1,
      speedMult: 1.05,
      damageMult: 1.05,
      goldMult: 1.6,
      abilities: [],
    },
    chaosModifier: true,
  },
];

export const DAILY_EVENT_BY_ID: Record<DailyEventId, DailyEventDef> = DAILY_EVENTS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<DailyEventId, DailyEventDef>,
);

/** Pick today's event from a weekday (0=Sun … 6=Sat). The list is sorted at
 *  the call-site so a missing weekday falls back to the first event. */
export function getEventForWeekday(weekday: number): DailyEventDef {
  return DAILY_EVENTS.find((e) => e.weekday === weekday) ?? DAILY_EVENTS[0]!;
}
