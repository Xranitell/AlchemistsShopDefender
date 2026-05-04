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
  mannequinIdleAlt: BakedSprite;
  mannequinThrowWindup: BakedSprite;
  mannequinThrowRelease: BakedSprite;
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
  iconSkull: BakedSprite;
  iconMagnet: BakedSprite;
  iconLightning: BakedSprite;
  iconAbility: BakedSprite;
  iconWavePip: BakedSprite;
  iconHpHeart: BakedSprite;
  // Meta-progression resource icons. Same flat pixel-art language as the
  // HUD icons so the main menu / overlays read as part of the game instead
  // of looking like CSS chrome.
  iconBlueEssence: BakedSprite;
  iconAncientEssence: BakedSprite;
  iconEpicKey: BakedSprite;
  iconAncientKey: BakedSprite;
  iconKey: BakedSprite;
  iconRerolls: BakedSprite;
  iconCrystal: BakedSprite;
  iconOrb: BakedSprite;
  // Treasure chest used by the victory ("Сундук Алхимика") screen. Two
  // frames: closed (player taps to open) → opened (lid lifted, glow + gold
  // contents visible). Same canvas size so the swap is in-place.
  iconChestClosed: BakedSprite;
  iconChestOpen: BakedSprite;
  flyingFlask: BakedSprite;
  shaman: BakedSprite;
  ratKing: BakedSprite;
  sapper: BakedSprite;
  homunculus: BakedSprite;
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
    // Wooden articulated training mannequin matching the menu illustration:
    // hexagonal head, octagonal shoulder/elbow/hip/knee joints, warm brown
    // wood tones (no facial features, no glowing core). Idle frame 1 — the
    // default standing pose with highlights on the upper-left interior.
    mannequin: bakeSprite(
      {
        rows: [
          '.........DDD.........',
          '........DMMMD........',
          '.......DHMMMMD.......',
          '.......DMMMMMD.......',
          '........DMMMD........',
          '.........DDD.........',
          '........DMMMD........',
          '....D.DDDDDDDDD.D....',
          '...DMDDHMMMMMMDDMD...',
          '...DMDDMMMMMMMDDMD...',
          '...DMDDMMMDMMMDDMD...',
          '..DMMMDMMMMMMMDMMMD..',
          '...DMDDDDDDDDDDDMD...',
          '...DMD..DMMMD..DMD...',
          '...DMDDMMMMMMMDDMD...',
          '...DMDDHMMMMMMDDMD...',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DDDD.DDDD......',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
        },
      },
      { x: 10.5, y: 22 },
    ),

    // Idle frame 2 — subtle "breathing" variant. Highlights drift one row
    // down (head + chest) so swapping with the base frame at ~2 Hz reads as
    // a soft inhale-exhale without changing the silhouette.
    mannequinIdleAlt: bakeSprite(
      {
        rows: [
          '.........DDD.........',
          '........DMMMD........',
          '.......DMMMMMD.......',
          '.......DHMMMMD.......',
          '........DMMMD........',
          '.........DDD.........',
          '........DMMMD........',
          '....D.DDDDDDDDD.D....',
          '...DMDDMMMMMMMDDMD...',
          '...DMDDHMMMMMMDDMD...',
          '...DMDDMMMDMMMDDMD...',
          '..DMMMDMMMMMMMDMMMD..',
          '...DMDDDDDDDDDDDMD...',
          '...DMD..DMMMD..DMD...',
          '...DMDDMMMMMMMDDMD...',
          '...DMDDHMMMMMMDDMD...',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DDDD.DDDD......',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
        },
      },
      { x: 10.5, y: 22 },
    ),

    // Throw windup — right arm raised straight up above the shoulder, hand
    // at head height. Body unchanged below the chest. Held briefly at the
    // start of the throw window before swapping to the release frame.
    mannequinThrowWindup: bakeSprite(
      {
        rows: [
          '.........DDD.........',
          '........DMMMD........',
          '.......DHMMMMD.......',
          '.......DMMMMMD.......',
          '........DMMMD..DDD...',
          '.........DDD...DMD...',
          '........DMMMD..DMD...',
          '....D.DDDDDDDDDDMD...',
          '...DMDDHMMMMMMDDMD...',
          '...DMDDMMMMMMMDDMD...',
          '...DMDDMMMDMMMD......',
          '..DMMMDMMMMMMMD......',
          '...DMDDDDDDDDDD......',
          '...DMD..DMMMD........',
          '...DMDDMMMMMMMD......',
          '...DMDDHMMMMMMD......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DDDD.DDDD......',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
        },
      },
      { x: 10.5, y: 22 },
    ),

    // Throw release — right arm extends out to the side at chest height
    // with hand at the tip. Combined with the world-space lunge offset in
    // render.ts (translation toward the throw direction), this sells the
    // throw motion regardless of which way the player is aiming.
    mannequinThrowRelease: bakeSprite(
      {
        rows: [
          '.........DDD.........',
          '........DMMMD........',
          '.......DHMMMMD.......',
          '.......DMMMMMD.......',
          '........DMMMD........',
          '.........DDD.........',
          '........DMMMD........',
          '....D.DDDDDDDDD.D....',
          '...DMDDHMMMMMMDDMDDDD',
          '...DMDDMMMMMMMDDMDMMD',
          '...DMDDMMMDMMMDDMDDDD',
          '..DMMMDMMMMMMMD......',
          '...DMDDDDDDDDDD......',
          '...DMD..DMMMD........',
          '...DMDDMMMMMMMD......',
          '...DMDDHMMMMMMD......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DMMMD.DMMMD....',
          '.......DMD.DMD.......',
          '.......DMD.DMD.......',
          '......DDDD.DDDD......',
        ],
        legend: {
          D: 'mechShadow',
          M: 'mechMid',
          W: 'mechLight',
          H: 'mechHi',
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

    // Sapper — short round bomb-bot with a lit fuse on top. Orange shell with
    // a red "danger" band, yellow fuse spark.
    sapper: bakeSprite(
      {
        rows: [
          '.....Ff.....',
          '....FFFf....',
          '....FFF.....',
          '....OOO.....',
          '...OOOOO....',
          '..OOoOOoOO..',
          '.OOoooOooOO.',
          'OOoOOOOOOOOO',
          'OOOoRRRRoOOO',
          'OoOOOOOOOOOo',
          'OoOoOOOOOoOo',
          '.OOoOOOOoOO.',
          '..OOOoooOO..',
          '...SSSSSS...',
        ],
        legend: {
          F: 'fireA',
          f: 'fireB',
          O: 'fireC',
          o: 'fireD',
          R: 'hudHpRed',
          S: 'shadow',
        },
      },
      { x: 6, y: 13 },
    ),

    // Homunculus — tall gaunt figure with a glass dome head, purple essence
    // inside, and flayed-looking muscle body. 3 phases retint via hitFlash.
    homunculus: bakeSprite(
      {
        rows: [
          '......EEEE......',
          '.....EeeeeE.....',
          '....EeppppeE....',
          '...EeppPPppeE...',
          '...EpPPPPPPpE...',
          '...EeppPPppeE...',
          '....EeppppeE....',
          '.....EEEEEE.....',
          '......nnnn......',
          '.....RRRRRR.....',
          '....RPPPPPPR....',
          '...RPRRRRRRPR...',
          '...RPRrrrrRPR...',
          '...RPRrppreRPR..',
          '...RPPPPPPPPR...',
          '....RPRRRRRPR...',
          '.....RrrrrrR....',
          '.....RrrrrrR....',
          '.....RRRRRRR....',
          '.....LLL.LLL....',
        ],
        legend: {
          E: 'crystalB',
          e: 'crystalA',
          p: 'essenceA',
          P: 'essenceB',
          n: 'alchSkinShadow',
          R: 'essenceD',
          r: 'essenceC',
          L: 'alchBoot',
        },
      },
      { x: 8, y: 19 },
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

    // Skull — bone-cream silhouette with two empty sockets and a small
    // tooth row. Used as the "kills counter" glyph on the chest / defeat
    // panels (replaces the old gold coin so kills aren't visually
    // confused with the in-run gold currency).
    iconSkull: bakeSprite(
      {
        rows: [
          '..bBBBBBBb..',
          '.bBBBBBBBBb.',
          'bBBBBBBBBBBb',
          'bBkkBBBBkkBb',
          'bBkkBBBBkkBb',
          'bBBBBkkBBBBb',
          '.bBBBBBBBBb.',
          '..bBkBkBkBb.',
          '...bbbbbbb..',
        ],
        legend: {
          B: 'parchment',
          b: 'brassDark',
          k: 'mortar',
        },
      },
      { x: 6, y: 4.5 },
    ),

    // (The old purple `iconEssence` was removed — both the HUD and every
    // menu now use `iconBlueEssence` so the player sees one canonical
    // essence vial across the entire game.)

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

    // ──────────── Meta currencies ────────────
    // Blue Essence — cyan crystal vial. Same silhouette as the in-run
    // essence icon so the player intuitively reads them as the same family,
    // just retinted to the cool blue palette used everywhere else for the
    // "blue" currency.
    iconBlueEssence: bakeSprite(
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
          d: 'crystalD',
          D: 'crystalC',
          p: 'crystalB',
          P: 'crystalA',
        },
      },
      { x: 5, y: 6.5 },
    ),

    // Ancient Essence — molten-gold crystal vial. Same silhouette as the
    // blue-essence and in-run essence vials so the player parses it as
    // "essence", but with a far richer 5-tone palette (deep gold edge →
    // saturated gold body → bright core → near-white shimmer) plus a
    // sparkle cluster on the liquid surface. Combined with the
    // `glow-gold` CSS class on the rendered canvas, this reads as the
    // game's most legendary currency.
    iconAncientEssence: bakeSprite(
      {
        rows: [
          '..kkkk....',
          '..ddDD....',
          '...DD.....',
          '..ddDDdd..',
          '.dDpSSpDD.',
          'dDpBpPpppD',
          'dDpBPpPpPD',
          'dDPBpPppPD',
          'dDpBPpPppD',
          'dDpPpBpPpD',
          '.dDpPpPpDd',
          '..ddpPpdd.',
          '...dddd...',
        ],
        legend: {
          k: 'woodDark',
          d: 'brassDark',
          D: 'goldB',
          p: 'goldA',
          P: 'brassGlow',
          B: 'ancientCore',
          S: 'ancientShimmer',
        },
      },
      { x: 5, y: 6.5 },
    ),

    // Epic key — purple skeleton key. Bow on the left with a hole, three
    // teeth carved into the shaft. Used in the main-menu top bar and the
    // difficulty-select overlay (replaces the 🗝️ emoji that broke the
    // pixel-art look).
    iconEpicKey: bakeSprite(
      {
        rows: [
          '.LLLL.........',
          'LLDDLLLLLLLLL.',
          'LD..DL.L.L.L..',
          'LLDDLLLLLLLLL.',
          '.LLLL.........',
        ],
        legend: {
          L: 'essenceA',
          D: 'essenceC',
        },
      },
      { x: 7, y: 2.5 },
    ),

    // Ancient key — legendary gold skeleton key. Shares the epic key's
    // overall silhouette so the pair still reads as a set, but adds:
    //  * a red ruby gem inlaid in the bow's hole (R),
    //  * bright `brassGlow` highlights on the bow rim (B),
    //  * `ancientShimmer` sparkle pixels on the corners + first tooth (S).
    // The CSS `.glow-gold` class on the rendered canvas adds an outer
    // gold drop-shadow halo so the icon visibly "glints" against any
    // background.
    iconAncientKey: bakeSprite(
      {
        rows: [
          '.LSLL.........',
          'LBDDBLLLLLLLL.',
          'LDRRDLSL.L.L..',
          'LBDDBLLLLLLLL.',
          '.LLLS.........',
        ],
        legend: {
          L: 'goldA',
          B: 'brassGlow',
          D: 'brassDark',
          R: 'ancientGem',
          S: 'ancientShimmer',
        },
      },
      { x: 7, y: 2.5 },
    ),

    // Generic key — used for "+N keys" rewards (battle pass, daily) where
    // the tier doesn't matter. Slightly muted gold so it doesn't look
    // identical to the ancient key.
    iconKey: bakeSprite(
      {
        rows: [
          '.LLLL.........',
          'LLDDLLLLLLLLL.',
          'LD..DL.L.L.L..',
          'LLDDLLLLLLLLL.',
          '.LLLL.........',
        ],
        legend: {
          L: 'brassHi',
          D: 'brassDark',
        },
      },
      { x: 7, y: 2.5 },
    ),

    // Rerolls — two stacked arrows / dice face. Replaces the 🔄 emoji used
    // for the "free reroll" daily reward.
    iconRerolls: bakeSprite(
      {
        rows: [
          '..LLLLLL..',
          '.LDDDDDDL.',
          'LDD.LL.DDL',
          'LDLLDDLLDL',
          'LDLLDDLLDL',
          'LDD.LL.DDL',
          '.LDDDDDDL.',
          '..LLLLLL..',
        ],
        legend: {
          L: 'brassHi',
          D: 'brass',
        },
      },
      { x: 5, y: 4 },
    ),

    // Crystal gem — diamond shape used as a generic "essence shard" reward
    // glyph (replaces 💎 emoji in the daily-rewards calendar).
    iconCrystal: bakeSprite(
      {
        rows: [
          '..LL..',
          '.LDDL.',
          'LDOODL',
          'LDOODL',
          '.LDDL.',
          '..LL..',
        ],
        legend: {
          L: 'crystalA',
          D: 'crystalB',
          O: 'crystalC',
        },
      },
      { x: 3, y: 3 },
    ),

    // Mystic orb — spherical purple/cyan orb (replaces 🔮). Used as the
    // ancient-essence reward glyph in the daily calendar.
    iconOrb: bakeSprite(
      {
        rows: [
          '..LLLL..',
          '.LppppL.',
          'LpPPpPpL',
          'LpPpppdL',
          'LppppddL',
          'LpdpdddL',
          '.LdddddL',
          '..LLLL..',
        ],
        legend: {
          L: 'essenceD',
          P: 'essenceA',
          p: 'essenceB',
          d: 'essenceC',
        },
      },
      { x: 4, y: 4 },
    ),

    // ──────────── Victory chest ────────────
    // Wooden treasure chest with brass band + keyhole. Closed frame: lid
    // sealed. Both sprites are 18×16 so the canvas position is identical
    // and the open frame can replace the closed one in place. Legend:
    //   K = woodDark        (outer outline)
    //   M = woodMid         (dark wood side)
    //   L = woodLight       (mid wood)
    //   H = woodHi          (highlight wood, lid top)
    //   w = woodMid         (body interior)
    //   G = goldA           (gold band)
    //   B = brassGlow       (gold band highlight / inside-glow)
    //   g = brassDark       (gold band shadow ring around keyhole)
    //   S = ancientShimmer  (white sparkle pixel)
    iconChestClosed: bakeSprite(
      {
        rows: [
          '..................',
          '....KKKKKKKKKK....',
          '..KKMHHHHHHHHMKK..',
          '.KMHLLLLLLLLLLHMK.',
          'KMHLLLLLLLLLLLLHMK',
          'KGGGGGGGGGGGGGGGGK',
          'KGBGGgggKKgggGGBGK',
          'KGGGGGggKKggGGGGGK',
          'KKKKKKKKKKKKKKKKKK',
          'KMLLLLLLLLLLLLLLMK',
          'KMLwHHHHHHHHHHwLMK',
          'KMLwwwwwwwwwwwwLMK',
          'KMLLLLLLLLLLLLLLMK',
          'KKKKKKKKKKKKKKKKKK',
          '..................',
          '..................',
        ],
        legend: {
          K: 'woodDark',
          M: 'woodMid',
          L: 'woodLight',
          H: 'woodHi',
          w: 'woodMid',
          G: 'goldA',
          B: 'brassGlow',
          g: 'brassDark',
        },
      },
      { x: 9, y: 8 },
    ),

    // Open chest: lid hinged back (small trapezoid above body), bright
    // golden contents inside the body, sparkle pixels for the "treasure"
    // shine. Drawn at the same 18×16 footprint as `iconChestClosed`.
    iconChestOpen: bakeSprite(
      {
        rows: [
          '.....KKKKKKKK.....',
          '...KKMLLLLLLLLMKK.',
          '..KMLLLLLLLLLLLMK.',
          '.KKKKKKKKKKKKKKKK.',
          '.SSS............S.',
          '....BBBBBBBBBB....',
          '.KKLLLLLLLLLLLLKK.',
          'KGGGGGGGGGGGGGGGGK',
          'KGSBBSwBSBwBSBwBGK',
          'KGwBSwBwBSwBSwSBGK',
          'KKKKKKKKKKKKKKKKKK',
          'KMLLLLLLLLLLLLLLMK',
          'KMLwHHHHHHHHHHwLMK',
          'KMLwwwwwwwwwwwwLMK',
          'KKKKKKKKKKKKKKKKKK',
          '..................',
        ],
        legend: {
          K: 'woodDark',
          M: 'woodMid',
          L: 'woodLight',
          H: 'woodHi',
          w: 'woodMid',
          G: 'goldA',
          B: 'brassGlow',
          S: 'ancientShimmer',
        },
      },
      { x: 9, y: 8 },
    ),
  };
}
