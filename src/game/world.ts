import { Rng } from '../engine/rng';
import { v2 } from '../engine/math';
import type { Entrance } from './types';
import {
  newModifiers,
  newContractStats,
  type GameState,
  type Mannequin,
  type RunePoint,
  type WaveState,
} from './state';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';
import { biomeFromSeed, BIOMES, type BiomeId } from '../data/biomes';
import { getEventForWeekday, type DailyEventDef } from '../data/dailyEvents';
import { MUTATORS, MUTATOR_BY_ID, mutatorCountForDifficulty, type MutatorId } from '../data/mutators';
import { CONTRACTS, contractCountForDifficulty, type ContractId } from '../data/contracts';
import { ENDLESS_MODIFIER_POOL } from './state';

const ARENA_W = 1280;
const ARENA_H = 720;

export function buildEntrances(width: number = ARENA_W, height: number = ARENA_H): Entrance[] {
  // Enemies spawn just off-screen (beyond the canvas edges) and walk onto
  // the arena floor. Order: top, right, bottom, left.
  const OFFSCREEN = 30;
  return [
    { pos: v2(width / 2, -OFFSCREEN), active: false },
    { pos: v2(width + OFFSCREEN, height / 2), active: false },
    { pos: v2(width / 2, height + OFFSCREEN), active: false },
    { pos: v2(-OFFSCREEN, height / 2), active: false },
  ];
}

export function buildRunePoints(width: number = ARENA_W, height: number = ARENA_H): RunePoint[] {
  // 8 points on a ring around the centre, of which the first 4 (indices 0..3
  // in unlock order) are active by default. The remaining 4 slots unlock via
  // meta-progression — see `runePointUnlock` upgrades. The unlock order is
  // separate from the visual angle so each unlock opens a slot on a different
  // side of the arena rather than them all clustering together.
  const points: RunePoint[] = [];
  const cx = width / 2;
  const cy = height / 2;
  // Fixed pixel offsets for the rune ring. The dais sprite is drawn at a
  // hard-coded radius (DAIS_RADIUS_OUTER = 170) so the runes have to sit
  // at the same hard-coded distance to land just outside the dais — on PC,
  // mobile (CSS-forced 1280-wide viewport), and any aspect ratio in between.
  // Previously the ring was scaled by the smaller of width/height, which
  // pushed the runes inward on landscape phones (~576px tall) until they
  // overlapped the central character. Pinning the radii reproduces the
  // 1920×1080 layout exactly on every viewport.
  const rx = Math.min(378, Math.max(0, width / 2 - 24));
  const ry = Math.min(194, Math.max(0, height / 2 - 24));
  // Visual angles around the dais.
  const angles = [
    -Math.PI / 2,                  // 0  top         (active)
    -Math.PI / 2 + Math.PI / 4,    // 1  top-right   (locked)
    0,                              // 2  right       (active)
    Math.PI / 4,                    // 3  bottom-right(locked)
    Math.PI / 2,                    // 4  bottom      (active)
    Math.PI / 2 + Math.PI / 4,      // 5  bottom-left (locked)
    Math.PI,                        // 6  left        (active)
    -Math.PI / 2 - Math.PI / 4,     // 7  top-left    (locked)
  ];
  // GDD §7.4: each rune point has a kind that buffs whatever tower is placed
  // on it. The default arena layout mixes one of every kind across both the
  // four starting points and the four meta-unlocked points so the player
  // sees variety from wave 1 and gets new types as they progress.
  // Index → kind:
  //   0 (top, active)    : reinforced
  //   1 (top-r, locked)  : unstable
  //   2 (right, active)  : resonant
  //   3 (br, locked)     : defensive
  //   4 (bottom, active) : normal
  //   5 (bl, locked)     : reinforced
  //   6 (left, active)   : defensive
  //   7 (tl, locked)     : resonant
  const KIND_BY_INDEX: import('./state').RunePointKind[] = [
    'reinforced',
    'unstable',
    'resonant',
    'defensive',
    'normal',
    'reinforced',
    'defensive',
    'resonant',
  ];
  // Indices that start active. Other indices are revealed by meta upgrades —
  // `runePointUnlock` effects use 1-based slot numbers matching this list:
  // unlock 1 → index 1, unlock 2 → index 3, unlock 3 → index 5, unlock 4 → 7.
  const startActive = new Set([0, 2, 4, 6]);
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i]!;
    points.push({
      id: i,
      pos: { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry },
      active: startActive.has(i),
      towerId: null,
      kind: KIND_BY_INDEX[i] ?? 'normal',
      // Stagger phase so neighbouring unstable runes don't pulse in lockstep.
      unstablePhase: i * 0.7,
    });
  }
  return points;
}

/** Map a 1-based "rune unlock slot" (the value carried by a `runePointUnlock`
 *  meta effect) to the actual rune-point array index that should be opened.
 *  The mapping points only to the slots that start LOCKED, so an unlock can
 *  never be a no-op. */
export function runeUnlockSlotToIndex(slot: number): number {
  const LOCKED = [1, 3, 5, 7];
  const i = Math.max(0, Math.min(LOCKED.length - 1, slot - 1));
  return LOCKED[i]!;
}

export function buildMannequin(width: number = ARENA_W, height: number = ARENA_H): Mannequin {
  return {
    pos: v2(width / 2, height / 2),
    hp: 200,
    maxHp: 200,
    basePotionDamage: 12,
    basePotionRadius: 60,
    basePotionCooldown: 1.3,
    potionTimer: 0,
    baseLootRadius: 110,
    damageFlash: 0,
    throwAnim: 0,
    throwDir: v2(0, -1),
  };
}

export function buildWaveState(): WaveState {
  return {
    currentIndex: -1,
    timeInWave: 0,
    pauseTime: 0,
    spawnedCount: 0,
    pendingSpawns: [],
    pauseDurationLeft: 0,
  };
}

/** PC reference world height. The world is always this many world-units
 *  tall regardless of the viewport: rendering scales it down to fit short
 *  landscape phones (so the dais / runes / enemies look ~PC-proportioned),
 *  and on PC at native 1080-tall viewports the scale becomes 1 and we get
 *  pixel-for-pixel parity with the desktop layout. */
const WORLD_REF_H = 1080;
const WORLD_MIN_W = 1440;

/** Module-level dynamic arena size, set by `setArenaSize` from main.ts on
 *  window resize. Values default to the 1920x1080 reference world. The
 *  *world* width tracks the viewport aspect (so the floor fills the canvas
 *  exactly via the camera transform), while the *world* height is pinned
 *  to WORLD_REF_H. */
let CURRENT_W = 1920;
let CURRENT_H = WORLD_REF_H;
let VIEWPORT_W = 1920;
let VIEWPORT_H = WORLD_REF_H;

export function setArenaSize(viewportWidth: number, viewportHeight: number): void {
  // Track the actual canvas (viewport) size — `getViewportSize()` exposes it
  // so render code can derive the camera scale that maps world coords onto
  // canvas pixels.
  VIEWPORT_W = Math.max(640, Math.floor(viewportWidth));
  VIEWPORT_H = Math.max(360, Math.floor(viewportHeight));
  // World height is fixed at WORLD_REF_H; world width is proportional to the
  // viewport's aspect ratio so a `ctx.scale(viewport.h / world.h, ...)`
  // transform fills the canvas without letterboxing.
  CURRENT_H = WORLD_REF_H;
  const aspect = VIEWPORT_W / VIEWPORT_H;
  CURRENT_W = Math.max(WORLD_MIN_W, Math.floor(WORLD_REF_H * aspect));
}

export function getArenaSize(): { width: number; height: number } {
  return { width: CURRENT_W, height: CURRENT_H };
}

export function getViewportSize(): { width: number; height: number } {
  return { width: VIEWPORT_W, height: VIEWPORT_H };
}

/** Resize an existing run to fit a new viewport. Re-positions the
 *  mannequin to the new centre and rebuilds the rune ring + entrances so
 *  they hug the new bounds. Live entities (enemies, projectiles, gold
 *  pickups, fire pools) keep their world coordinates — they will simply
 *  appear in the same world spot, which is now in a different visual
 *  position relative to the new edges. The next wave / drop will already
 *  use the new dimensions. */
export function resizeArena(state: GameState, viewportWidth: number, viewportHeight: number): void {
  setArenaSize(viewportWidth, viewportHeight);
  const { width: w, height: h } = getArenaSize();
  state.arena.width = w;
  state.arena.height = h;
  state.arena.center = v2(w / 2, h / 2);
  state.arena.arenaRadius = Math.min(w, h) * 0.45;
  state.mannequin.pos = v2(w / 2, h / 2);
  state.entrances = buildEntrances(w, h);
  // Preserve which rune slots are active / occupied / which kind they are
  // by mutating positions in place rather than rebuilding from scratch.
  const fresh = buildRunePoints(w, h);
  for (let i = 0; i < state.runePoints.length && i < fresh.length; i++) {
    state.runePoints[i]!.pos = fresh[i]!.pos;
  }
  state.aim = v2(w / 2, h / 2 - 200);
}

export function buildInitialState(
  seed?: number,
  difficulty: DifficultyMode = 'normal',
  biome?: BiomeId,
): GameState {
  const mode = DIFFICULTY_MODES[difficulty];
  const actualSeed = seed ?? (Date.now() >>> 0);
  const biomeId: BiomeId = biome ?? biomeFromSeed(actualSeed);
  const W = CURRENT_W;
  const H = CURRENT_H;
  return {
    rng: new Rng(actualSeed),
    phase: 'menu',
    arena: {
      width: W,
      height: H,
      center: v2(W / 2, H / 2),
      arenaRadius: Math.min(W, H) * 0.45,
    },
    entrances: buildEntrances(W, H),
    runePoints: buildRunePoints(W, H),
    mannequin: buildMannequin(W, H),
    enemies: [],
    towers: [],
    projectiles: [],
    firePools: [],
    goldPickups: [],
    floatingTexts: [],
    chainBolts: [],
    reactionPools: [],
    gold: 90, // enough for one starter tower
    essence: 0,
    totalKills: 0,
    modifiers: newModifiers(),
    waveState: buildWaveState(),
    cardChoice: {
      options: [],
      pickedIds: [],
      rerollCost: 50,
      freeRerollUsed: false,
      draftCount: 0,
      lastNonCommonDraft: -1,
      lastLegendaryWave: -10,
    },
    overload: { charge: 0, maxCharge: 100 },
    aim: v2(W / 2, H / 2 - 200),
    manualFireRequested: false,
    overloadRequested: false,
    activeRunePoint: null,
    magnetTimer: 0,
    worldTime: 0,
    nextEntityId: 1,
    metaTowerDiscount: 0,
    metaTowerStartLevel: 1,
    metaOverloadRateMult: 1,
    metaMannequinArmor: 0,
    metaAutoRepairRate: 0,
    metaBossShield: 0,
    metaAutoRepairCooldown: 0,
    metaPotionAimBonus: 0,
    metaAuraRadiusMult: 1,
    metaArmorPen: 0,
    metaCritChance: 0,
    difficulty,
    difficultyModifier: { ...mode.modifier, abilities: [...mode.modifier.abilities] },
    dailyEventId: null,
    activeMutatorIds: [],
    activeContractIds: [],
    contractStats: newContractStats(),
    spawnCountMult: 1,
    nightModeActive: false,
    endlessLoop: 0,
    biomeId,
    endlessModifiers: [],
    pendingEndlessModifier: null,
    tempShieldTime: 0,
    tempShieldReduction: 0,
    golemHeartCharges: 0,
    // Default loadout — overwritten by `applyMetaUpgrades` at run start.
    activeModuleId: 'lightning',
    auraModuleId: 'ether_amp',
    transmuteTimer: 0,
    transmuteGoldMult: 1,
    reviveUsed: false,
    revivePaused: false,
    // Crafted potions (loaded from MetaSave.inventory at run start)
    inventory: [null, null, null, null],
    activePotions: [],
    stormCharges: 0,
    stormChargeMult: 1,
    potionShieldHp: 0,
    onIngredientDrop: null,
  };
}

/** Today's date in Europe/Moscow as `{ y, m, d, weekday }`. The daily
 *  leaderboard and the rotating event roll over at 00:00 MSK so we always
 *  evaluate "today" in Moscow time, regardless of the player's local zone. */
export function moscowToday(): { y: number; m: number; d: number; weekday: number } {
  // Intl with `Europe/Moscow` is the simplest reliable cross-runtime way to
  // get a Moscow-time date without bringing in tz-data libs. `weekday` is
  // 0=Sunday … 6=Saturday to match `Date.getUTCDay()` conventions.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wkMap[get('weekday')] ?? 0;
  return { y, m, d, weekday };
}

/** Deterministic seed from today's MSK date (YYYYMMDD) so every player on
 *  the same Moscow day gets the same Daily Experiment run. */
export function dailySeed(): number {
  const { y, m, d } = moscowToday();
  return ((y * 10000 + m * 100 + d) >>> 0);
}

/** Board id for the daily-event leaderboard. Static (`dailyWaves`) — the
 *  same Yandex board is reused every day instead of rolling over per-MSK
 *  midnight, so players see the same accumulated table no matter which
 *  weekday's event they ran. */
export function dailyBoardId(): string {
  return 'dailyWaves';
}

/** Apply passive biome modifiers to the state. Call once after
 *  `buildInitialState` + `applyMetaUpgrades` so they stack on top of
 *  meta progression. */
export function applyBiomeModifiers(state: GameState): void {
  const bm = BIOMES[state.biomeId].modifier;
  // Crypt: reduce tower range (simulates reduced visibility).
  state.modifiers.towerRangeMult *= bm.visionRangeMult;
  // Foundry: +5% fire damage for player (potionDamageMult used for fire
  // potions), and enemy fire damage is scaled by the difficulty modifier.
  if (bm.fireDamageMult !== 1) {
    state.modifiers.potionDamageMult *= bm.fireDamageMult;
    state.difficultyModifier.damageMult *= bm.fireDamageMult;
  }
}

/** Resolve the daily event scheduled for today's MSK weekday. Used by
 *  the menu preview AND `startRun('daily')` so both screens stay in sync. */
export function getTodayDailyEvent(): DailyEventDef {
  return getEventForWeekday(moscowToday().weekday);
}

/** Apply the rotating Daily Event modifiers + flags onto a fresh state.
 *  Mutates `state.difficultyModifier`, `state.mannequin`, `state.modifiers`,
 *  and the per-event flags consumed by render/wave systems.
 *
 *  Must run AFTER `applyMetaUpgrades` and `applyBiomeModifiers` so event
 *  buffs stack on top of progression. The caller in main.ts only invokes
 *  this when `state.difficulty === 'daily'`. */
export function applyDailyEventModifiers(state: GameState, ev: DailyEventDef): void {
  state.dailyEventId = ev.id;

  // Stack enemy stat multipliers on top of whatever the difficulty mode
  // already configured (Daily mode itself starts neutral, so this is a
  // straight overwrite-by-multiplication).
  const dm = state.difficultyModifier;
  dm.hpMult *= ev.modifier.hpMult;
  dm.speedMult *= ev.modifier.speedMult;
  dm.damageMult *= ev.modifier.damageMult;
  dm.goldMult *= ev.modifier.goldMult;
  for (const ab of ev.modifier.abilities) {
    if (!dm.abilities.includes(ab)) dm.abilities.push(ab);
  }

  // Per-event flags consumed by render / wave systems.
  state.spawnCountMult = ev.spawnCountMult ?? 1;
  state.nightModeActive = !!ev.nightMode;

  // Glass Cannon / Abundance: scale the player's HP pool. <1 weakens (Glass
  // Cannon), >1 buffs (Abundance). Potion damage mult is handled below.
  if (ev.playerHpMult && ev.playerHpMult !== 1) {
    state.mannequin.maxHp = Math.max(1, Math.round(state.mannequin.maxHp * ev.playerHpMult));
    state.mannequin.hp = state.mannequin.maxHp;
  }
  if (ev.playerDamageMult && ev.playerDamageMult !== 1) {
    state.modifiers.potionDamageMult *= ev.playerDamageMult;
  }

  // Chaos: roll a random endless modifier and apply it immediately so the
  // run starts under its effect. We don't surface the selector overlay —
  // the player already saw the day's preview on the menu.
  if (ev.chaosModifier) {
    const pool = ENDLESS_MODIFIER_POOL;
    const idx = state.rng.int(0, pool.length);
    const pick = pool[idx];
    if (pick) {
      state.endlessModifiers.push(pick);
      switch (pick.id) {
        case 'hp_x125':
          state.difficultyModifier.hpMult += 0.25;
          break;
        case 'speed_x110':
          state.difficultyModifier.speedMult += 0.10;
          break;
        case 'gold_minus10':
          state.difficultyModifier.goldMult *= 0.90;
          break;
        case 'extra_enemies':
          // Handled at spawn time via the endlessModifiers list.
          break;
        case 'elites_on_normal':
          if (!state.difficultyModifier.abilities.includes('one_hit_shield')) {
            state.difficultyModifier.abilities.push('one_hit_shield');
          }
          if (!state.difficultyModifier.abilities.includes('dash_back_on_hit')) {
            state.difficultyModifier.abilities.push('dash_back_on_hit');
          }
          break;
      }
    }
  }
}

/** Roll N distinct run mutators ("dungeon laws") for the given difficulty
 *  and apply them onto `state`. Picks 1 mutator for Epic, 2 for Ancient;
 *  no-op for other modes. Uses `state.rng` so the roll is reproducible
 *  alongside other run RNG (biome, seed, etc.).
 *
 *  Must run AFTER `applyMetaUpgrades`, `applyBiomeModifiers` and any
 *  daily-event modifiers so mutator multipliers stack on top of the
 *  baseline difficulty bundle. */
export function applyRunMutators(state: GameState): void {
  // Initial roll for wave 1. Subsequent waves call `rerollWaveMutators`
  // directly from the wave-end hook so the next law is visible during prep.
  rerollWaveMutators(state);
}

/** Re-roll the wave-rotating "dungeon laws". Called once at run start (for
 *  wave 1) and again from `startPause` after every wave end so the next
 *  prep window shows the next wave's laws.
 *
 *  Each mutator def carries an explicit `revert` function — the inverse of
 *  its `apply`. We undo the previously-active set first, then roll N new
 *  ids and apply them. This preserves any mid-run multiplicative changes
 *  the player picked up (cards, blessings, mannequin upgrades) since
 *  revert ONLY undoes the multipliers/additions the mutator itself made,
 *  and never touches anything else on `state`. */
export function rerollWaveMutators(state: GameState): void {
  const count = mutatorCountForDifficulty(state.difficulty);
  // Revert the previously-active mutators, regardless of whether we are
  // about to roll new ones. This way switching off Epic mid-run (not a
  // real flow today, but defensive) still cleans up state.
  for (const prevId of state.activeMutatorIds) {
    const def = MUTATOR_BY_ID[prevId];
    if (!def) continue;
    def.revert(state);
  }
  if (count <= 0) {
    state.activeMutatorIds = [];
    return;
  }
  const pool = state.rng.shuffle(MUTATORS.map((m) => m.id));
  const picked: MutatorId[] = pool.slice(0, count);
  state.activeMutatorIds = picked;
  for (const id of picked) {
    const def = MUTATOR_BY_ID[id];
    if (!def) continue;
    def.apply(state);
  }
}

/** Roll N distinct run contracts for the given difficulty (2 in Epic, 3 in
 *  Ancient; none in other modes) and stamp them on `state`. Contracts only
 *  read from `state.contractStats` so this never mutates anything besides
 *  `state.activeContractIds`. */
export function applyRunContracts(state: GameState): void {
  const count = contractCountForDifficulty(state.difficulty);
  if (count <= 0) return;
  const pool = state.rng.shuffle(CONTRACTS.map((c) => c.id));
  const picked: ContractId[] = pool.slice(0, count);
  state.activeContractIds = picked;
}
