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
  mannequinThrow: BakedSprite;
  slime: BakedSprite;
  slimeBoss: BakedSprite;
  rat: BakedSprite;
  spider: BakedSprite;
  crystalSpider: BakedSprite;
  golem: BakedSprite;
  towerNeedler: BakedSprite;
  towerNeedlerBarrel: BakedSprite;
  towerMortar: BakedSprite;
  towerMortarBarrel: BakedSprite;
  towerMercury: BakedSprite;
  towerMercuryBarrel: BakedSprite;
  towerAcid: BakedSprite;
  towerAcidBarrel: BakedSprite;
  potionBottle: BakedSprite;
  potionBottleFire: BakedSprite;
  potionBottleMercury: BakedSprite;
  potionBottleAcid: BakedSprite;
  needle: BakedSprite;
  acidDrop: BakedSprite;
  coin: BakedSprite;
  doorClosed: BakedSprite;
  doorOpen: BakedSprite;
  shelf: BakedSprite;
  cauldron: BakedSprite;
  candle: BakedSprite;
  // HUD icons (not drawn on the world canvas; used by hud.ts)
  iconCoin: BakedSprite;
  iconEssence: BakedSprite;
  iconMagnet: BakedSprite;
  iconLightning: BakedSprite;
  iconAbility: BakedSprite;
  iconWavePip: BakedSprite;
  iconHpHeart: BakedSprite;
  flyingFlask: BakedSprite;
  shaman: BakedSprite;
  ratKing: BakedSprite;
  // Crystal altar (sits atop dais)
  crystalAltar: BakedSprite;
}

export function getSprites(): Sprites {
  if (_baked) return _baked;
  _baked = bakeAll();
  return _baked;
}

function bakeAll(): Sprites {
  return {
    // Wooden alchemist mannequin: a clockwork training dummy with brass
    // coils, cyan core and chunky shoulders, matching the combat reference.
    mannequin: bakeSprite(
      {
        rows: [
          '........IIIII........',
          '.......IHHHHHI.......',
          '.......IHcCcHI.......',
          '......DIHHHHHID......',
          '.....DDBBBBBBBDD.....',
          '....DDBBMMMMMBBBDD...',
          '...DDBBMHMMMHMBBBDD..',
          '..DDBBBMCCCCCMMBBBDD.',
          '..DBbBMMCcCcCMMBbBBD.',
          '.DDBbBMMCCCCCMMBbBBDD',
          '.DDMMBBMMMMMMMBBMMDD.',
          '..DMWWBBDDDDDBBWWMD..',
          '.DMWHWWMMMMMMMWWHWMD.',
          'DMWWHHWMBBBBBMWWHHWMD',
          'DMMWWWMBBCCCBMMWWWMM.',
          '.DMMMMMBBCCCBMMMMMD..',
          '..DMMMBBBBBBBBMMMD...',
          '...DMMBBDDDDBBMMD....',
          '..DMMMD.....DMMMD....',
          '..DMMMD.....DMMMD....',
          '..DHHHD.....DHHHD....',
          '..DHHHD.....DHHHD....',
          '...DDD.......DDD.....',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
          B: 'brass',
          b: 'brassDark',
          C: 'mechCore',
          c: 'mechCoreHi',
          I: 'mechIron',
        },
      },
      { x: 10.5, y: 22 },
    ),

    // Throw frame: right arm extends forward like a mechanical launcher.
    mannequinThrow: bakeSprite(
      {
        rows: [
          '........IIIII........',
          '.......IHHHHHI.......',
          '.......IHcCcHI.......',
          '......DIHHHHHID......',
          '.....DDBBBBBBBDD.....',
          '....DDBBMMMMMBBBDD...',
          '...DDBBMHMMMHMBBBDD..',
          '..DDBBBMCCCCCMMBBBDD.',
          '..DBbBMMCcCcCMMBbBBDD',
          '.DDBbBMMCCCCCMMBbBBW.',
          '.DDMMBBMMMMMMMBBMMWW.',
          '..DMWWBBDDDDDBBWWMWH.',
          '.DMWHWWMMMMMMMWWDWHH.',
          'DMWWHHWMBBBBBMWDWHH..',
          'DMMWWWMBBCCCBMMWWW...',
          '.DMMMMMBBCCCBMMMMMD..',
          '..DMMMBBBBBBBBMMMD...',
          '...DMMBBDDDDBBMMD....',
          '..DMMMD.....DMMMD....',
          '..DMMMD.....DMMMD....',
          '..DHHHD.....DHHHD....',
          '..DHHHD.....DHHHD....',
          '...DDD.......DDD.....',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
          B: 'brass',
          b: 'brassDark',
          C: 'mechCore',
          c: 'mechCoreHi',
          I: 'mechIron',
        },
      },
      { x: 10.5, y: 22 },
    ),

    slime: bakeSprite(
      {
        rows: [
          '....gggggg.....',
          '...gAAAAAAAAg..',
          '..gAAhaaahAAg..',
          '.gAAaahaahaAAg.',
          'gAAaaaaaaaaaaAg',
          'gAaaWwWwaaaaaAg',
          'gAaaWwwWaaaaaAg',
          'gAaaaaaahaaaAAg',
          '.gAAAAAhAAAAg..',
          '..gggggggggg...',
          '...ssssssss....',
        ],
        legend: {
          g: 'slimeC',
          A: 'slimeB',
          a: 'slimeA',
          h: 'slimeHighlight',
          W: 'whiteSoft',
          w: 'slimeShadow',
          s: 'slimeShadow',
        },
      },
      { x: 7.5, y: 10 },
    ),

    // Renamed visual: stone golem (mini-boss). Bigger silhouette than slime,
    // shouldered, glowing crack down chest, yellow eyes.
    slimeBoss: bakeSprite(
      {
        rows: [
          '.......CCCCCC.......',
          '......CcCCCcCC......',
          '.....DDCCCCCCDD.....',
          '....DAhAAAAAAAAhD...',
          '...DAAAabbbabAAAD...',
          '..DAAabbbbbbbbAAD...',
          '.DAAabAAAAAAAAbAAD..',
          'DAAabAhEEAAEEhAbAAD.',
          'DAAabAAAAAAAAAbAAD..',
          'DAAabAAAKAAAAAbAAD..',
          'DAAabAAKkKAAAAbAAD..',
          'DAAabAAAKAAAAAbAAD..',
          'DAAabAAAAAAAAAbAAD..',
          'DAAabbbbbbbbbbbAAD..',
          '.DAAaaaaaaaaaAAD....',
          '..DDhAAAAAAAAAhDD...',
          '....bbbbbbbbbbb.....',
          '.....sssssssss......',
        ],
        legend: {
          C: 'crystalA',
          c: 'crystalB',
          D: 'golemD',
          A: 'golemA',
          a: 'golemB',
          b: 'golemC',
          h: 'golemHighlight',
          E: 'golemEye',
          K: 'golemCrack',
          k: 'fireA',
          s: 'golemShadow',
        },
      },
      { x: 9.5, y: 17 },
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

    spider: bakeSprite(
      {
        rows: [
          'L.L.......L.L',
          '.LL.......LL.',
          '..LL.....LL..',
          '...BBBBBBB...',
          '..BbbhhhbbB..',
          '.BbheBBBehbB.',
          '.BbbhbbhbbB..',
          '..BbbhhhbbB..',
          '...BBBBBBB...',
          '..L..L.L..L..',
          '.L..L...L..L.',
        ],
        legend: {
          L: 'spiderC',
          B: 'spiderB',
          b: 'spiderA',
          h: 'spiderHighlight',
          e: 'spiderEye',
        },
      },
      { x: 6.5, y: 7 },
    ),

    // Crystal spider — bigger, with cyan crystals embedded in back.
    crystalSpider: bakeSprite(
      {
        rows: [
          'L..L.....L..L',
          '.LL.......LL.',
          '..LL.....LL..',
          '...BBBBBBB...',
          '..BbbCCCbbB..',
          '.BbbCcKCcbbB.',
          '.BbecCKCcebB.',
          '.BbbCcKCcbbB.',
          '..BbbCCCbbB..',
          '...BBBBBBB...',
          '..L..L.L..L..',
          '.L..L...L..L.',
        ],
        legend: {
          L: 'spiderC',
          B: 'spiderB',
          b: 'spiderA',
          C: 'crystalC',
          c: 'crystalB',
          K: 'crystalA',
          e: 'crystalA',
        },
      },
      { x: 6.5, y: 8 },
    ),

    // Standalone stone golem visual (used by slimeBoss alias too — keep both
    // for naming; the renderer picks slimeBoss).
    golem: bakeSprite(
      {
        rows: [
          '....DDDDDD....',
          '...DAAAAAAD...',
          '..DAAaaaaAAD..',
          '.DAAabbbbAAAD.',
          'DAAabAEEAbAAD.',
          'DAAabAAAAbAAD.',
          'DAAabAKKAbAAD.',
          'DAAabAkkAbAAD.',
          'DAAabbbbbbAAD.',
          'DAAaaaaaaaAAD.',
          '.DAAAAAAAAAD..',
          '..DDDDDDDDDD..',
          '...bbbbbbbb...',
        ],
        legend: {
          D: 'golemD',
          A: 'golemA',
          a: 'golemB',
          b: 'golemC',
          E: 'golemEye',
          K: 'golemCrack',
          k: 'fireA',
        },
      },
      { x: 6.5, y: 12 },
    ),

    towerNeedler: bakeSprite(
      {
        rows: [
          '...nnnn...',
          '..nNNNNn..',
          '.nNNNNNNn.',
          '.nNNhNNNn.',
          '.nNNNNNNn.',
          '..nNNNNn..',
          '..nWWWWn..',
          '.WhWWWWWh.',
          'WdWWWWWWdW',
          'WddddddddW',
          '.dddddddd.',
        ],
        legend: {
          n: 'mortar',
          N: 'mercA',
          h: 'woodHighlight',
          W: 'woodLight',
          d: 'woodDark',
        },
      },
      { x: 5, y: 6 },
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

    towerMercury: bakeSprite(
      {
        rows: [
          '..MMMMMM..',
          '.MMmmmmMM.',
          'MMmBBBBmMM',
          'MmBbbbbBmM',
          'MmBbbbbBmM',
          'MmBBBBBBmM',
          'MMmmmmmmMM',
          'WWWWWWWWWW',
          'WdWWWWWWdW',
          'Wdddddddd.',
          '.dddddddd.',
        ],
        legend: {
          M: 'mercC',
          m: 'mercB',
          B: 'mercA',
          b: 'aetherB',
          W: 'woodLight',
          d: 'woodDark',
        },
      },
      { x: 4.5, y: 6 },
    ),

    towerMercuryBarrel: bakeSprite(
      {
        rows: [
          'MMmm',
          'MMmm',
          'MMmm',
          'MMmm',
          'MMmm',
        ],
        legend: {
          M: 'mercC',
          m: 'mercB',
        },
      },
      { x: 0, y: 2.5 },
    ),

    towerAcid: bakeSprite(
      {
        rows: [
          '..AAAAAA..',
          '.AAaaaaAA.',
          'AAaGGGGaAA',
          'AaGggggGaA',
          'AaGggggGaA',
          'AaGGGGGGaA',
          'AAaaaaaAAA',
          'WWWWWWWWWW',
          'WdWWWWWWdW',
          'Wdddddddd.',
          '.dddddddd.',
        ],
        legend: {
          A: 'acidC',
          a: 'acidB',
          G: 'acidA',
          g: 'fireA',
          W: 'woodLight',
          d: 'woodDark',
        },
      },
      { x: 4.5, y: 6 },
    ),

    towerAcidBarrel: bakeSprite(
      {
        rows: [
          'AAaa',
          'AAaa',
          'AAaa',
        ],
        legend: {
          A: 'acidC',
          a: 'acidB',
        },
      },
      { x: 0, y: 1.5 },
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

    potionBottleMercury: bakeSprite(
      {
        rows: [
          '.kk.',
          '.kk.',
          '.dd.',
          'dMMd',
          'dMmd',
          'dmmd',
          '.dd.',
        ],
        legend: {
          k: 'mortar',
          d: 'woodDark',
          M: 'mercC',
          m: 'mercB',
        },
      },
    ),

    potionBottleAcid: bakeSprite(
      {
        rows: [
          '.kk.',
          '.kk.',
          '.dd.',
          'dAAd',
          'dAad',
          'daad',
          '.dd.',
        ],
        legend: {
          k: 'mortar',
          d: 'woodDark',
          A: 'acidA',
          a: 'acidB',
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

    acidDrop: bakeSprite(
      {
        rows: [
          '.A.',
          'AaA',
          'AaA',
          '.A.',
        ],
        legend: {
          A: 'acidA',
          a: 'acidB',
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

    // 2.5D shelf: visible top plank + front face with potion bottles, so it
    // reads like a wooden shelf pressed against the wall rather than a flat
    // colour block.
    shelf: bakeSprite(
      {
        rows: [
          'wwwwwwwwwwwwww',
          'WWWWWWWWWWWWWW',
          'W.aB.cC.fF.gG.',
          'W.aB.cC.fF.gG.',
          'WWWWWWWWWWWWWW',
          '..............',
          'wwwwwwwwwwwwww',
          'WWWWWWWWWWWWWW',
          'W.hH.iI.cC.aB.',
          'W.hH.iI.cC.aB.',
          'WWWWWWWWWWWWWW',
          'ssssssssssssss',
        ],
        legend: {
          w: 'woodHi',       // top plank (lit)
          W: 'woodDark',     // plank front face
          s: 'shadowSoft',   // drop shadow under shelf
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

    // 2.5D cauldron: round iron pot seen at a 3/4 angle with visible top
    // opening (ellipse) and a short log pedestal.
    cauldron: bakeSprite(
      {
        rows: [
          '...KKKKKKKK...',
          '..KaaaaaaaaK..',
          '.KaWaaaaWaaaK.',
          'KBBBBBBBBBBBBK',
          'KMMMMMMMMMMMMK',
          'KMMMMMMMMMMMMK',
          '.KMMMMMMMMMMK.',
          '..KMMMMMMMMK..',
          '...KKKKKKKK...',
          '..d..ff..d....',
          '..dddffffdd...',
          '..ssssssssss..',
        ],
        legend: {
          K: 'mortar',       // outer iron rim
          B: 'stoneHi',      // highlight ring below opening
          M: 'stoneDark',    // body (dark iron)
          a: 'aetherB',      // glowing liquid
          W: 'whiteSoft',    // bubble highlight
          d: 'woodDark',     // log pedestal
          f: 'fireB',        // fire flicker under cauldron
          s: 'shadowSoft',   // drop shadow
        },
      },
      { x: 7, y: 8 },
    ),

    // 2.5D candle: tall wax pillar on a short iron plate with visible top
    // and side so it reads as a 3D object.
    candle: bakeSprite(
      {
        rows: [
          '..f..',
          '..F..',
          '.WWW.',
          'WCWWW',
          'WCWWW',
          'WCWWW',
          '.WWW.',
          'KKKKK',
          'sssss',
        ],
        legend: {
          f: 'fireA',
          F: 'fireB',
          W: 'parchment',    // wax body
          C: 'whiteSoft',    // lit side highlight
          K: 'stoneDark',    // iron plate
          s: 'shadowSoft',
        },
      },
      { x: 2, y: 8 },
    ),

    flyingFlask: bakeSprite(
      {
        rows: [
          '...PP...',
          '...PP...',
          '..dPPd..',
          '.dPppPd.',
          'dPppppPd',
          'dPpPPpPd',
          '.dPppPd.',
          '..dddd..',
        ],
        legend: {
          P: 'essenceA',
          p: 'essenceB',
          d: 'essenceC',
        },
      },
      { x: 4, y: 5 },
    ),

    shaman: bakeSprite(
      {
        rows: [
          '...GGGG...',
          '..GGggGG..',
          '.GGgaagGG.',
          '.GgaEEagG.',
          '.GgaEEagG.',
          '.GGgaagGG.',
          '..GGggGG..',
          '...GggG...',
          '..GGggGG..',
          '..GggggG..',
          '...GGGG...',
        ],
        legend: {
          G: 'acidC',
          g: 'acidB',
          a: 'acidA',
          E: 'golemEye',
        },
      },
      { x: 5.5, y: 6 },
    ),

    ratKing: bakeSprite(
      {
        rows: [
          '..GGGG.GGGG..',
          '.GggRRRRggG..',
          'GggRRrrRRggG.',
          'GgRRrrrrrRgG.',
          'GgRRrRRRrRgG.',
          'GgRRrEEERrRgG',
          'GgRRrRRRrRgG.',
          'GgRRrrrrrRgG.',
          'GggRRrrRRggG.',
          '.GggRRRRggG..',
          '..GggggggG...',
          '.GG..G..GG...',
          'GG..GG..GG...',
        ],
        legend: {
          G: 'goldC',
          g: 'goldB',
          R: 'ratFur',
          r: 'ratFurLight',
          E: 'golemEye',
        },
      },
      { x: 6.5, y: 9 },
    ),

    // Crystal altar atop the dais. Hex-cut cyan crystal on a stone base.
    crystalAltar: bakeSprite(
      {
        rows: [
          '....CC....',
          '...CcCc...',
          '..CcKKcC..',
          '.CcKkkKcC.',
          'CcKkkkkKcC',
          'CcKkkkkKcC',
          '.CcKkkKcC.',
          '..CcCCcC..',
          '...CcCc...',
          '..DDDDDD..',
          '.DAAAAAAd.',
          '.DABbbAAd.',
          '.DAbbbbAd.',
          '..dddddd..',
        ],
        legend: {
          C: 'crystalA',
          c: 'crystalB',
          K: 'crystalC',
          k: 'crystalD',
          D: 'daisDark',
          A: 'daisLight',
          B: 'daisMid',
          b: 'daisDark',
          d: 'daisDark',
        },
      },
      { x: 5, y: 13 },
    ),

    // ---------------- HUD ICONS ----------------
    // Gold coin (large, with face/star detail)
    iconCoin: bakeSprite(
      {
        rows: [
          '..ddDDDDdd..',
          '.dDGGGGGGDd.',
          'dDGgGGGGgGDd',
          'DGgGGggGGgGD',
          'DGGggGGggGGD',
          'DGGGGGGGGGGD',
          'DGGggGGggGGD',
          'DGgGGggGGgGD',
          'dDGgGGGGgGDd',
          '.dDGGGGGGDd.',
          '..ddDDDDdd..',
        ],
        legend: {
          d: 'goldC',
          D: 'goldB',
          G: 'goldA',
          g: 'brassHi',
        },
      },
      { x: 6, y: 5.5 },
    ),

    // Essence potion (purple, with cork)
    iconEssence: bakeSprite(
      {
        rows: [
          '..kkkk....',
          '..ddDD....',
          '...DD.....',
          '..ddDDdd..',
          '.dDPpppDD.',
          'dDPppPpppD',
          'dDpPpppppD',
          'dDppppPpPD',
          'dDPpppPpPD',
          'dDpppppppD',
          '.dDppPppDd',
          '..ddpppdd.',
          '...dddd...',
        ],
        legend: {
          k: 'woodDark',
          d: 'essenceD',
          D: 'essenceC',
          p: 'essenceB',
          P: 'essenceA',
        },
      },
      { x: 5, y: 6.5 },
    ),

    // Magnet U-shape (purple gem)
    iconMagnet: bakeSprite(
      {
        rows: [
          'PPP....PPP',
          'PpP....PpP',
          'PpP....PpP',
          'PpP....PpP',
          'PpP....PpP',
          'PpP....PpP',
          'PpPppppPpP',
          'PppPPPPppP',
          'PppppppppP',
          '.PPPPPPPP.',
        ],
        legend: {
          P: 'essenceC',
          p: 'essenceB',
        },
      },
      { x: 5, y: 5 },
    ),

    // Lightning bolt (yellow, for Overload)
    iconLightning: bakeSprite(
      {
        rows: [
          '....fFFf..',
          '...fFfff..',
          '..fFFff...',
          '..fFff....',
          '.fFFFFff..',
          '.ffffFf...',
          '....Fff...',
          '...Fff....',
          '..Fff.....',
          '..ff......',
        ],
        legend: {
          f: 'fireA',
          F: 'fireB',
        },
      },
      { x: 5, y: 5 },
    ),

    // Ability star (orange, used as "ability" button)
    iconAbility: bakeSprite(
      {
        rows: [
          '....FF....',
          '....fF....',
          '...fFF....',
          'F..fFFf..F',
          'FfffFFFffF',
          'FFFFFFFFFF',
          'FfffFFFffF',
          'F..fFFf..F',
          '...fFF....',
          '....fF....',
        ],
        legend: {
          F: 'fireB',
          f: 'fireA',
        },
      },
      { x: 5, y: 5 },
    ),

    // Wave pip — small indicator chevron used in WAVE widget
    iconWavePip: bakeSprite(
      {
        rows: [
          '..C..',
          '.CcC.',
          'CcccC',
          'CcccC',
          '.CCC.',
        ],
        legend: {
          C: 'crystalA',
          c: 'crystalB',
        },
      },
      { x: 2.5, y: 2.5 },
    ),

    // HP heart (small, for HP widget label)
    iconHpHeart: bakeSprite(
      {
        rows: [
          '.HH.HH.',
          'HhHhHhH',
          'HhhhhhH',
          'HhhhhhH',
          '.HhhhH.',
          '..HhH..',
          '...H...',
        ],
        legend: {
          H: 'hudHpRed',
          h: 'hudHpRedHi',
        },
      },
      { x: 3.5, y: 3.5 },
    ),
  };
}
