// Biome definitions (GDD §13.1).
//
// Each biome defines a visual palette for floor/walls/particles. Biomes used
// to also tweak gameplay stats (Crypt cut tower range, Foundry boosted fire
// damage), but those passive modifiers were intentionally retired — they
// stacked invisibly with difficulty / event / mutator multipliers and made
// the run feel “randomly harder” depending on which biome rolled. The
// `BiomeModifier` shape is kept for forward compatibility; every entry now
// uses the neutral preset, so `applyBiomeModifiers` is effectively a no-op.

export type BiomeId = 'workshop' | 'crypt' | 'foundry';

export interface BiomePalette {
  /** Background fill behind the floor tiles. */
  bg: string;
  tileA: string;
  tileB: string;
  tileC: string;
  tileCrack: string;
  wallDark: string;
  wallMid: string;
  /** Ambient particle tint colors (3 entries). */
  ambientColors: [string, string, string];
  /** Spotlight centre color (radial gradient inner stop). */
  spotlight: string;
  /** Vignette darkness at the outer ring. */
  vignetteAlpha: number;
}

export interface BiomeModifier {
  /** Multiplier on fire damage dealt by enemies AND player. Currently
   *  always 1 — retired so biomes don't tilt run difficulty invisibly. */
  fireDamageMult: number;
  /** Retained biome-data field; current gameplay does not apply it. */
  etherResistMult: number;
  /** Multiplier on tower range. Currently always 1 — retired so biomes
   *  don't tilt run difficulty invisibly. */
  visionRangeMult: number;
  /** Retained biome-data field; current gameplay does not apply it. */
  bonusGoldPerWave: number;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  palette: BiomePalette;
  modifier: BiomeModifier;
}

const neutralModifier: BiomeModifier = {
  fireDamageMult: 1,
  etherResistMult: 1,
  visionRangeMult: 1,
  bonusGoldPerWave: 0,
};

export const BIOMES: Record<BiomeId, BiomeDef> = {
  workshop: {
    id: 'workshop',
    name: 'Мастерская',
    // Warm cosy alchemist's lab palette — amber-toned stone tile floor,
    // candle-glow ambient, amber spotlight. Crypt + foundry stay on
    // cold/red palettes so the three biomes still read as visually
    // distinct. (The workshop used to draw a wooden plank floor here;
    // it was retired in favour of the shared iso-tile floor.)
    palette: {
      bg: '#1a0f0a',
      tileA: '#5d3a22',
      tileB: '#4a2d18',
      tileC: '#7a4f30',
      tileCrack: '#1f120a',
      wallDark: '#2a180e',
      wallMid: '#6a4530',
      ambientColors: [
        'rgba(255, 178, 88, 0.30)',
        'rgba(255, 138, 64, 0.22)',
        'rgba(255, 220, 140, 0.20)',
      ],
      spotlight: 'rgba(255, 168, 80, 0.06)',
      vignetteAlpha: 0.50,
    },
    modifier: { ...neutralModifier },
  },

  crypt: {
    id: 'crypt',
    name: 'Крипта',
    palette: {
      bg: '#06060e',
      tileA: '#151828',
      tileB: '#1a1e34',
      tileC: '#28304a',
      tileCrack: '#0a0d18',
      wallDark: '#050810',
      wallMid: '#3a3455',
      ambientColors: [
        'rgba(160, 130, 255, 0.25)',
        'rgba(100, 80, 200, 0.20)',
        'rgba(200, 180, 255, 0.15)',
      ],
      spotlight: 'rgba(140, 100, 255, 0.03)',
      vignetteAlpha: 0.72,
    },
    // Crypt used to apply visionRangeMult: 0.85 + etherResistMult: 0.80,
    // which silently capped tower range at 85% and tweaked ether dmg.
    // Now neutral — visual mood only.
    modifier: { ...neutralModifier },
  },

  foundry: {
    id: 'foundry',
    name: 'Литейная',
    palette: {
      bg: '#10080a',
      tileA: '#2a1c1e',
      tileB: '#322224',
      tileC: '#4a3234',
      tileCrack: '#180e10',
      wallDark: '#0e0608',
      wallMid: '#5a3a38',
      ambientColors: [
        'rgba(255, 140, 58, 0.3)',
        'rgba(255, 90, 30, 0.25)',
        'rgba(255, 200, 80, 0.2)',
      ],
      spotlight: 'rgba(255, 140, 58, 0.04)',
      vignetteAlpha: 0.50,
    },
    // Foundry used to apply fireDamageMult: 1.05 (boosting BOTH enemy and
    // player fire damage). Retired — visual mood only.
    modifier: { ...neutralModifier },
  },
};

export const BIOME_IDS: BiomeId[] = ['workshop', 'crypt', 'foundry'];

/** Pick a biome deterministically from a numeric seed. */
export function biomeFromSeed(seed: number): BiomeId {
  return BIOME_IDS[((seed >>> 0) % BIOME_IDS.length)]!;
}
