// Single shared palette for all procedural pixel-art so sprites stay coherent.
// Inspired by GDD §4.3 (alchemy shop, warm stone, glowing reagents) and a
// muted TBOI-style room.
export const COLORS = {
  none: 'transparent',

  // Stone / wood / room
  stoneDark: '#3a2f3f',
  stoneMid: '#5a4a55',
  stoneLight: '#7a6671',
  stoneHi: '#9c8a90',
  mortar: '#2a2030',
  woodDark: '#3a2418',
  woodMid: '#5a3622',
  woodLight: '#8a5a30',
  woodHi: '#b78250',

  // Floor
  tileA: '#3d2f3a',
  tileB: '#34272f',
  tileC: '#48394a',
  tileCrack: '#231a22',

  // Manequin / decorations
  cloth: '#7a3a3a',
  clothHi: '#a85050',
  clothShadow: '#4d2222',
  brass: '#c9a96b',
  brassHi: '#e8c98c',
  parchment: '#d8c198',

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

  // Acid / poison
  acidA: '#d2f55a',
  acidB: '#9ccc2e',
  acidC: '#5a8c14',

  // Mercury
  mercA: '#c9c9d8',
  mercB: '#8a8aa0',
  mercC: '#3a3a55',

  // Slime
  slimeA: '#a3e36a',
  slimeB: '#6dbb3a',
  slimeC: '#3a7a1a',
  slimeShadow: '#1f3a14',

  // Rat
  ratA: '#7a5230',
  ratB: '#5a3a1f',
  ratC: '#3a1f10',
  ratEye: '#ff5a5a',

  // Mini-boss
  bossCrown: '#e8c98c',
  bossSpot: '#3a7a1a',

  // Gold pickup
  goldA: '#ffd166',
  goldB: '#c9941a',
  goldC: '#7a5b14',

  // VFX
  whiteSoft: '#f5e8ff',
  shadow: 'rgba(0, 0, 0, 0.45)',
  shadowSoft: 'rgba(0, 0, 0, 0.25)',

  // UI
  hudFrameDark: '#2a1a14',
  hudFrameMid: '#5a3622',
  hudFrameLight: '#8a5a30',
  hudFrameGold: '#c9a96b',
} as const;

export type ColorKey = keyof typeof COLORS;
