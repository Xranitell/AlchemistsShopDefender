import { bakeSprite, type BakedSprite } from './sprite';

// All sprites are designed in low-resolution pixel grids. Letters reference
// keys from the shared palette in render/palette.ts.
//
// Convention:
// - "." or " " = transparent
// - Sprites are baked once at import via lazy initialisation (so unit tests
//   that import data files don't try to call canvas APIs).

let _baked: Sprites | null = null;

export interface Sprites {
  mannequin: BakedSprite;
  slime: BakedSprite;
  slimeBoss: BakedSprite;
  rat: BakedSprite;
  towerNeedler: BakedSprite;
  towerNeedlerBarrel: BakedSprite;
  towerMortar: BakedSprite;
  towerMortarBarrel: BakedSprite;
  potionBottle: BakedSprite;
  potionBottleFire: BakedSprite;
  needle: BakedSprite;
  coin: BakedSprite;
  doorClosed: BakedSprite;
  doorOpen: BakedSprite;
  shelf: BakedSprite;
  cauldron: BakedSprite;
  candle: BakedSprite;
}

export function getSprites(): Sprites {
  if (_baked) return _baked;
  _baked = bakeAll();
  return _baked;
}

function bakeAll(): Sprites {
  return {
    mannequin: bakeSprite(
      {
        rows: [
          '....DDDDD....',
          '...DhhhhhD...',
          '..DhhhhhhhD..',
          '..DhWwhwWhD..',
          '..DhhhhhhhD..',
          '..DDDDDDDDD..',
          '....SCCCS....',
          '...SCCCCCS...',
          '..SCCcCCcCS..',
          '..SCCCCCCCS..',
          '..SCccCcccCS.',
          '..SCCCcccCCS.',
          '..SCcccCCcCS.',
          '...SCCCCCCS..',
          '....MmmmM....',
          '....M...M....',
          '....M...M....',
          '....bb.bb....',
        ],
        legend: {
          D: 'woodDark',
          h: 'woodMid',
          W: 'whiteSoft',
          w: 'aetherA',
          S: 'clothShadow',
          C: 'cloth',
          c: 'clothHi',
          M: 'woodDark',
          m: 'woodMid',
          b: 'woodDark',
        },
      },
      { x: 6.5, y: 17 },
    ),

    slime: bakeSprite(
      {
        rows: [
          '...gggg....',
          '..gAAAAg...',
          '.gAAaaaAg..',
          'gAAaaaaaAg.',
          'gAaaWwWwAg.',
          'gAaaaaaaAg.',
          'gAaaaaaAAg.',
          '.gAAAAAAg..',
          '..gggggg...',
          '...sssss...',
        ],
        legend: {
          g: 'slimeC',
          A: 'slimeB',
          a: 'slimeA',
          W: 'whiteSoft',
          w: 'slimeShadow',
          s: 'slimeShadow',
        },
      },
      { x: 5.5, y: 9 },
    ),

    slimeBoss: bakeSprite(
      {
        rows: [
          '......CCCCCC......',
          '.....CcccCcC......',
          '.....CCCCCCC......',
          '...gggggggggg.....',
          '..gAAAAAAAAAAg....',
          '.gAAaaaaaaaaAAg...',
          'gAAaaaaaaaaaaAAg..',
          'gAAaaaaaaaaaaaAg..',
          'gAaaaWwWwwWwAaAg..',
          'gAaaaaaaaaaaaaAg..',
          'gAaaaaaaaaaaaaAg..',
          'gAaapppaaaapppAg..',
          'gAaaaaaaaaaaaaAg..',
          'gAAAaaaaaaaaaAAg..',
          '.gAAAAAAAAAAAAg...',
          '..ggggggggggg.....',
          '...sssssssss......',
        ],
        legend: {
          C: 'bossCrown',
          c: 'fireA',
          g: 'slimeC',
          A: 'slimeB',
          a: 'slimeA',
          W: 'whiteSoft',
          w: 'slimeShadow',
          p: 'bossSpot',
          s: 'slimeShadow',
        },
      },
      { x: 8.5, y: 16 },
    ),

    rat: bakeSprite(
      {
        rows: [
          '.........RR..',
          '....RRRRRRR..',
          '...RrrrrrRRR.',
          '..RrrrrrrrrR.',
          '..RrrrrEErrR.',
          '.RrrrrrrrrrR.',
          'RrTTrTTrTrrR.',
          '.R..R..R.....',
        ],
        legend: {
          R: 'ratC',
          r: 'ratB',
          E: 'ratEye',
          T: 'ratA',
        },
      },
      { x: 6.5, y: 7 },
    ),

    towerNeedler: bakeSprite(
      {
        rows: [
          '...nnnn...',
          '..nNNNNn..',
          '.nNNNNNNn.',
          '.nNNNNNNn.',
          '.nNNNNNNn.',
          '..nNNNNn..',
          '..nWWWWn..',
          '.WWWWWWWW.',
          'WdWWWWWWdW',
          'Wdddddddd.',
          '.dddddddd.',
        ],
        legend: {
          n: 'mortar',
          N: 'mercA',
          W: 'woodLight',
          d: 'woodDark',
        },
      },
      { x: 4.5, y: 6 },
    ),

    towerNeedlerBarrel: bakeSprite(
      {
        rows: [
          'KKKkkkk',
          'KKKkkkk',
          'KKKkkkk',
        ],
        legend: {
          K: 'mercC',
          k: 'mercB',
        },
      },
      { x: 0, y: 1.5 },
    ),

    towerMortar: bakeSprite(
      {
        rows: [
          '.MMMMMMM..',
          'MMmmmmmmMM',
          'MmFFFFFFmM',
          'MmFffFffmM',
          'MmFffFffmM',
          'MmFFFFFFmM',
          'MmmmmmmmmM',
          'WWWWWWWWWW',
          'WdWWWWWWdW',
          'Wddddddddd',
          '.ddddddddd',
        ],
        legend: {
          M: 'mortar',
          m: 'stoneDark',
          F: 'fireC',
          f: 'fireA',
          W: 'woodLight',
          d: 'woodDark',
        },
      },
      { x: 4.5, y: 6 },
    ),

    towerMortarBarrel: bakeSprite(
      {
        rows: [
          'KKKKkk',
          'KKKKkk',
          'KKKKkk',
          'KKKKkk',
        ],
        legend: {
          K: 'stoneDark',
          k: 'mortar',
        },
      },
      { x: 0, y: 2 },
    ),

    potionBottle: bakeSprite(
      {
        rows: [
          '.kk.',
          '.kk.',
          '.dd.',
          'dCCd',
          'dCCd',
          'dccd',
          '.dd.',
        ],
        legend: {
          k: 'mortar',
          d: 'woodDark',
          C: 'aetherA',
          c: 'aetherB',
        },
      },
    ),

    potionBottleFire: bakeSprite(
      {
        rows: [
          '.kk.',
          '.kk.',
          '.dd.',
          'dFFd',
          'dFfd',
          'dffd',
          '.dd.',
        ],
        legend: {
          k: 'mortar',
          d: 'woodDark',
          F: 'fireA',
          f: 'fireB',
        },
      },
    ),

    needle: bakeSprite(
      {
        rows: [
          'WkkkkkkkW',
        ],
        legend: {
          W: 'whiteSoft',
          k: 'mercA',
        },
      },
    ),

    coin: bakeSprite(
      {
        rows: [
          '.GGG.',
          'GgGgG',
          'GGgGG',
          'GgGgG',
          '.GGG.',
        ],
        legend: {
          G: 'goldB',
          g: 'goldA',
        },
      },
    ),

    doorClosed: bakeSprite(
      {
        rows: [
          'WWWWWWW',
          'WdwwwdW',
          'WdwwwdW',
          'WdwwwdW',
          'WdwwwdW',
          'WdwwwdW',
          'WdwwwdW',
          'WdwwwdW',
          'WWWWWWW',
        ],
        legend: {
          W: 'woodDark',
          d: 'woodMid',
          w: 'woodLight',
        },
      },
    ),

    doorOpen: bakeSprite(
      {
        rows: [
          'WRRRRRW',
          'WRkkkRW',
          'WRkkkRW',
          'WRkrkRW',
          'WRkkkRW',
          'WRkkkRW',
          'WRkrkRW',
          'WRkkkRW',
          'WRRRRRW',
        ],
        legend: {
          W: 'woodDark',
          R: 'fireC',
          r: 'fireA',
          k: 'mortar',
        },
      },
    ),

    shelf: bakeSprite(
      {
        rows: [
          'WWWWWWWWWWWW',
          'W..........W',
          'W.aB.cC.fF.W',
          'W.aB.cC.fF.W',
          'WWWWWWWWWWWW',
          'W..........W',
          'W.gG.hH.iI..',
          'W.gG.hH.iI..',
          'WWWWWWWWWWWW',
        ],
        legend: {
          W: 'woodDark',
          a: 'aetherC',
          B: 'aetherB',
          c: 'fireC',
          C: 'fireA',
          f: 'acidC',
          F: 'acidA',
          g: 'mercC',
          G: 'mercA',
          h: 'fireB',
          H: 'fireA',
          i: 'aetherD',
          I: 'aetherB',
        },
      },
    ),

    cauldron: bakeSprite(
      {
        rows: [
          '.kkkkkkkk.',
          'kBBBBBBBBk',
          'kBaaaaaaBk',
          'kBaWaWaaBk',
          'kBaaaaaaBk',
          'kBBBBBBBBk',
          'WMMMMMMMMW',
          'WdMMMMMMdW',
          '.dddddddd.',
        ],
        legend: {
          k: 'mortar',
          B: 'stoneDark',
          a: 'aetherB',
          W: 'whiteSoft',
          M: 'stoneMid',
          d: 'woodDark',
        },
      },
    ),

    candle: bakeSprite(
      {
        rows: [
          '.f.',
          '.F.',
          'WCW',
          'WCW',
          'WCW',
          'ddd',
        ],
        legend: {
          f: 'fireA',
          F: 'fireB',
          W: 'parchment',
          C: 'whiteSoft',
          d: 'woodDark',
        },
      },
    ),
  };
}
