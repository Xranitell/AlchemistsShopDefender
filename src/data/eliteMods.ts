/**
 * GDD §12.2 — Elite enemy modifiers.
 * Assigned to ~10–25 % of non-boss enemies starting from wave 6.
 */

export type EliteModId =
  | 'armored'
  | 'frenzied'
  | 'regenerating'
  | 'ethereal'
  | 'fire_resistant';

export interface EliteModDef {
  id: EliteModId;
  nameKey: string;
  color: string;
  /** Badge character drawn above the HP bar. */
  badge: string;
}

export const ELITE_MODS: Record<EliteModId, EliteModDef> = {
  armored: {
    id: 'armored',
    nameKey: 'elite.armored',
    color: '#8d99ae',
    badge: '🛡',
  },
  frenzied: {
    id: 'frenzied',
    nameKey: 'elite.frenzied',
    color: '#ff006e',
    badge: '⚡',
  },
  regenerating: {
    id: 'regenerating',
    nameKey: 'elite.regenerating',
    color: '#06d6a0',
    badge: '♻',
  },
  ethereal: {
    id: 'ethereal',
    nameKey: 'elite.ethereal',
    color: '#8338ec',
    badge: '✦',
  },
  fire_resistant: {
    id: 'fire_resistant',
    nameKey: 'elite.fireResistant',
    color: '#e85d04',
    badge: '🔥',
  },
};

export const ELITE_MOD_IDS: EliteModId[] = [
  'armored',
  'frenzied',
  'regenerating',
  'ethereal',
  'fire_resistant',
];
