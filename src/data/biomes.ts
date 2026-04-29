// Biome definitions (GDD §13.1).
//
// Each biome defines a visual palette for floor/walls/particles and a set of
// passive gameplay modifiers that apply for the entire run. The workshop is
// neutral (default), the crypt reduces vision range at night but grants ether
// resistance, and the foundry boosts fire damage for both enemies and player.

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
  /** Multiplier on fire damage dealt by enemies AND player (foundry). */
  fireDamageMult: number;
  /** Multiplier on aether/ether resistance for enemies (crypt). */
  etherResistMult: number;
  /** Multiplier on mannequin/tower vision/range (crypt night penalty). */
  visionRangeMult: number;
  /** Flat bonus gold per wave clear (workshop neutral). */
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
    palette: {
      bg: '#0a0810',
      tileA: '#1f2838',
      tileB: '#252f42',
      tileC: '#344057',
      tileCrack: '#111722',
      wallDark: '#090d14',
      wallMid: '#5a4a55',
      ambientColors: [
        'rgba(125, 249, 255, 0.3)',
        'rgba(255, 209, 102, 0.25)',
        'rgba(189, 246, 255, 0.2)',
      ],
      spotlight: 'rgba(125, 249, 255, 0.04)',
      vignetteAlpha: 0.55,
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
    modifier: {
      fireDamageMult: 1,
      etherResistMult: 0.80,   // enemies take 20% less aether damage
      visionRangeMult: 0.85,   // reduced tower range (night)
      bonusGoldPerWave: 0,
    },
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
    modifier: {
      fireDamageMult: 1.05,    // +5% fire damage for enemies AND player
      etherResistMult: 1,
      visionRangeMult: 1,
      bonusGoldPerWave: 0,
    },
  },
};

export const BIOME_IDS: BiomeId[] = ['workshop', 'crypt', 'foundry'];

/** Pick a biome deterministically from a numeric seed. */
export function biomeFromSeed(seed: number): BiomeId {
  return BIOME_IDS[((seed >>> 0) % BIOME_IDS.length)]!;
}
