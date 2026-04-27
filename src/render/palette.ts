// Single shared palette for all procedural pixel-art so sprites stay coherent.
// Inspired by GDD §4.3 (alchemy shop, warm stone, glowing reagents) and a
// muted TBOI-style room.
export const COLORS = {
  none: 'transparent',

  // Stone / wood / room (warm walls)
  stoneDark: '#3a2f3f',
  stoneMid: '#5a4a55',
  stoneLight: '#7a6671',
  stoneHi: '#9c8a90',
  mortar: '#2a2030',
  woodDark: '#3a2418',
  woodMid: '#5a3622',
  woodLight: '#8a5a30',
  woodHi: '#b78250',

  // Cool dais stone (per reference, the central platform is bluer/cooler)
  daisDark: '#2a2c3a',
  daisMid: '#454a60',
  daisLight: '#6a7088',
  daisHi: '#8b94ad',
  daisCrack: '#161721',

  // Floor
  tileA: '#3d2f3a',
  tileB: '#34272f',
  tileC: '#48394a',
  tileCrack: '#231a22',

  // Manequin / decorations (warm cloth + brass)
  cloth: '#7a3a3a',
  clothHi: '#a85050',
  clothShadow: '#4d2222',
  brass: '#c9a96b',
  brassHi: '#e8c98c',
  brassDark: '#7a5b14',
  parchment: '#d8c198',

  // Wooden mech (mannequin v2)
  mechDark: '#3a2418',
  mechMid: '#6a3a1a',
  mechLight: '#9a5a2a',
  mechHi: '#c08a4a',
  mechIron: '#3a3a55',
  mechIronHi: '#7a7a95',
  mechCore: '#7df9ff',
  mechCoreHi: '#f5e8ff',

  // Fire / hot
  fireA: '#ffd166',
  fireB: '#ff8c3a',
  fireC: '#d24f1c',
  fireD: '#7a2410',

  // Aether / cyan
  aetherA: '#bdf6ff',
  aetherB: '#7df9ff',
  aetherC: '#3ab3c9',
  aetherD: '#1c5a72',

  // Crystal (cyan altar / crystal spider gems)
  crystalA: '#e0f8ff',
  crystalB: '#7df9ff',
  crystalC: '#3a86b5',
  crystalD: '#1c3a55',

  // Acid / poison
  acidA: '#d2f55a',
  acidB: '#9ccc2e',
  acidC: '#5a8c14',

  // Mercury
  mercA: '#c9c9d8',
  mercB: '#8a8aa0',
  mercC: '#3a3a55',

  // Slime (green)
  slimeA: '#a3e36a',
  slimeB: '#6dbb3a',
  slimeC: '#3a7a1a',
  slimeShadow: '#1f3a14',

  // Spider (brown)
  spiderA: '#5a3a2a',
  spiderB: '#3a2218',
  spiderC: '#1a0e0a',
  spiderEye: '#ffd166',

  // Stone golem
  golemA: '#9c8a85',
  golemB: '#6f5e58',
  golemC: '#4a3d3a',
  golemD: '#2a201d',
  golemCrack: '#ff8c3a',
  golemEye: '#ffd166',

  // Rat (kept for legacy)
  ratA: '#7a5230',
  ratB: '#5a3a1f',
  ratC: '#3a1f10',
  ratEye: '#ff5a5a',

  // Mini-boss (kept for legacy)
  bossCrown: '#e8c98c',
  bossSpot: '#3a7a1a',

  // Gold pickup
  goldA: '#ffd166',
  goldB: '#c9941a',
  goldC: '#7a5b14',

  // Essence (purple potion)
  essenceA: '#e6c2ff',
  essenceB: '#c084fc',
  essenceC: '#7a3acb',
  essenceD: '#3a1c5e',

  // Ability rings (around dais)
  ringDark: '#1f2a3a',
  ringMid: '#3a4d68',
  ringHi: '#7df9ff',
  ringGlow: '#bdf6ff',

  // VFX
  whiteSoft: '#f5e8ff',
  shadow: 'rgba(0, 0, 0, 0.45)',
  shadowSoft: 'rgba(0, 0, 0, 0.25)',

  // UI
  hudFrameDark: '#1a1c28',
  hudFrameMid: '#2a2c3a',
  hudFrameLight: '#454a60',
  hudFrameGold: '#c9a96b',
  hudHpRed: '#d24f1c',
  hudHpRedHi: '#ff6a3d',
  hudHpRedDark: '#7a2410',
} as const;

export type ColorKey = keyof typeof COLORS;
