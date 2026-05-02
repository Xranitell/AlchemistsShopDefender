import type { Vec2 } from '../engine/math';
import { Rng } from '../engine/rng';
import type { CardDef, Element, Entrance, EnemyKind, StatusEffects, TowerKind, WaveDef } from './types';
import { newStatus } from './types';
import type { ReactionPool } from './reactions';
import type { DifficultyMode, DifficultyModifier, EnemyAbility } from '../data/difficulty';
import type { BiomeId } from '../data/biomes';
import type { EliteModId } from '../data/eliteMods';
import type { DailyEventId } from '../data/dailyEvents';
import type { MutatorId } from '../data/mutators';
import type { ContractId } from '../data/contracts';
import type { BlessingId, CurseId } from '../data/blessings';

export type Phase =
  | 'menu'
  | 'preparing'
  | 'wave'
  | 'card_select'
  | 'endless_modifier_select'
  | 'victory'
  | 'gameover';

export interface Mannequin {
  pos: Vec2;
  hp: number;
  maxHp: number;
  basePotionDamage: number;
  basePotionRadius: number;
  basePotionCooldown: number;
  potionTimer: number;
  baseLootRadius: number;
  damageFlash: number;
  /** Seconds remaining on the throw-pose animation. Counts down to 0. */
  throwAnim: number;
  /** Screen-space offset direction of the last throw (for arm-aim + lean). */
  throwDir: Vec2;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: Vec2;
  hp: number;
  maxHp: number;
  status: StatusEffects;
  hitFlash: number;
  goldPending: number;
  /** Extra per-enemy behaviour attached by the current dungeon difficulty. */
  abilities: EnemyAbility[];
  /** Remaining "one-hit shield" charges. Attached by ancient/epic modes. */
  shieldCharges: number;
  /** Cursed-extra: extra HP-soak shield seeded at spawn from
   *  `state.modifiers.enemyExtraShieldFraction * maxHp`. Damage hits this
   *  pool first and only spills over to `hp` once it's depleted. */
  extraShield: number;
  /** Cached spawn-time copy of `extraShield` used by the renderer to
   *  draw a proportional shield bar above the enemy. */
  extraShieldMax: number;
  /** Seconds left of the backstep impulse; while >0 movement is pushed
   *  away from the hero instead of toward them. */
  dashBackTimer: number;
  /** Generation counter — used so split-on-death only chains twice. */
  splitGeneration: number;
  /** Multiplier applied to the damage dealt to this enemy. Goes to <1 only
   *  while the one-hit shield is absorbing, currently always 0 or 1. */
  damageTaken: number;
  /** Sapper-only: seconds left on the "about to blow" fuse. 0 = not armed. */
  sapperFuse: number;
  /** Boss-only phase counter (1..3). Used by the homunculus for mechanics. */
  bossPhase: number;
  /** Boss-only: seconds left on the current phase's minion-summon timer. */
  minionSummonTimer: number;
  /** Elite modifier assigned to this enemy, if any (GDD §12.2). */
  elite: EliteModId | null;
  /** Ethereal elite: seconds remaining in the current immune phase. */
  etherealTimer: number;
  /** Ethereal elite: whether currently in the immune (phased-out) window. */
  etherealActive: boolean;
  /** Boss-only: cooldown until next active special ability. */
  bossSpecialCooldown: number;
  /** Boss-only: seconds left on a perpendicular dodge dash. While > 0 the
   *  enemy moves along `bossDodgeDir` instead of toward the mannequin. */
  bossDodgeTimer: number;
  /** Boss-only: unit vector for the active dodge dash. */
  bossDodgeDir: Vec2;
  /** Boss-only: dash speed used while dodgeTimer > 0 (px/sec). */
  bossDodgeSpeed: number;
  /** Miniboss slime: seconds left on the slam wind-up animation. */
  bossSlamWindup: number;
  /** Element of the last hit applied to this enemy. Recorded by all damage
   *  paths (projectile, DoT tick, sapper explosion, reaction) so the run
   *  contract counters can attribute the killing blow's element. */
  lastHitElement: Element;
}

export type TargetingMode = 'nearest' | 'strongest' | 'fastest' | 'debuffed' | 'first';

/** Aggregate counters consumed by `data/contracts.ts` to score the run's
 *  active contracts. Every field starts at 0/false in `newContractStats()`
 *  and is mutated only by the existing damage / death / shop hooks (see
 *  `enemy.ts`, `projectile.ts`, `tower.ts`, `cards.ts`). Contracts are
 *  evaluated lazily — combat code never reads from this struct. */
export interface ContractStats {
  /** Number of enemies killed whose `lastHitElement` was each element. */
  killsByElement: Record<Element, number>;
  /** Number of enemies killed broken down by `EnemyKind.id`. */
  killsByKind: Record<string, number>;
  /** Bosses killed (any `kind.isBoss` enemy). */
  bossKills: number;
  /** Cumulative number of towers bought via `buyTower` this run. */
  towersBuilt: number;
  /** Highest `state.gold` value observed during the run. */
  goldPeak: number;
  /** Set the first time the player rerolls a card draft (paid or ad). */
  rerollUsed: boolean;
  /** Set the first time the player skips a card draft. */
  cardSkipUsed: boolean;
  /** `damageInWave[w] === true` iff the mannequin took damage during wave
   *  index `w` (0-based). Used by flawless-wave contracts. */
  damageInWave: boolean[];
}

export function newContractStats(): ContractStats {
  return {
    killsByElement: {
      neutral: 0,
      fire: 0,
      mercury: 0,
      acid: 0,
      aether: 0,
      frost: 0,
      poison: 0,
    },
    killsByKind: {},
    bossKills: 0,
    towersBuilt: 0,
    goldPeak: 0,
    rerollUsed: false,
    cardSkipUsed: false,
    damageInWave: [],
  };
}

export interface Tower {
  id: number;
  kind: TowerKind;
  pos: Vec2;
  runePointId: number;
  level: number; // 1..3
  fireTimer: number;
  aimAngle: number;
  shotCount: number;
  /** Which enemy this tower picks out of candidates in range. Default 'nearest'
   * = closest to mannequin, matching the historical behaviour. */
  targetingMode: TargetingMode;
}

/** Type of a rune point (GDD §7.4). Each kind grants a distinct in-run
 *  bonus to whatever tower is placed on it. `unstable` rotates between
 *  three short buffs every few seconds so its tower always feels alive
 *  but never gives a permanent advantage. */
export type RunePointKind =
  | 'normal'
  | 'reinforced'
  | 'unstable'
  | 'resonant'
  | 'defensive';

export interface RunePoint {
  id: number;
  pos: Vec2;
  active: boolean; // unlocked by meta-progression (always true in MVP)
  towerId: number | null;
  kind: RunePointKind;
  /** Phase used by `unstable` rune points to time their rotating buff. */
  unstablePhase: number;
}

export type ProjectileKind = 'potion' | 'tower';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  splashRadius: number;
  /** Optional homing target id. */
  targetId: number | null;
  /** Element tag applied on hit. */
  element: Element;
  life: number;
  /** Whether this potion should leave a fire pool on impact (Flammable Mix). */
  leaveFire: boolean;
  /** Whether potion should fire a secondary mini-explosion shortly after. */
  echoExplosion: boolean;
  bonusFromManualAim: boolean;
  /** Parabolic-arc fields (only populated for thrown potions). */
  arc?: {
    start: Vec2;
    target: Vec2;
    t: number;          // 0..1 progress along the ground-plane path
    duration: number;   // total flight time in seconds
    peakHeight: number; // visual apex above the ground plane (pixels)
    height: number;     // current visual height (z), updated each frame
  };
}

export interface FirePool {
  id: number;
  pos: Vec2;
  radius: number;
  dps: number;
  time: number; // remaining seconds
}

export interface GoldPickup {
  id: number;
  pos: Vec2;
  value: number;
  life: number;
}

export interface FloatingText {
  id: number;
  text: string;
  pos: Vec2;
  color: string;
  life: number;
  vy: number;
}

/** Short-lived visual segment for chain-lightning beams (Эфирная катушка).
 *  Each segment is a single hop between two enemies (or tower→enemy). */
export interface ChainBolt {
  id: number;
  from: Vec2;
  to: Vec2;
  /** Total lifetime in seconds. Counts down to 0 and is removed. */
  time: number;
  maxTime: number;
  /** Hop index (0 = primary tower→enemy, 1+ = enemy→enemy). Higher hops draw
   *  thinner / dimmer to convey the falloff. */
  hop: number;
}

export interface Modifiers {
  potionDamageMult: number;
  potionRadiusMult: number;
  potionCooldownMult: number;
  potionEchoExplode: number;
  potionLeavesFire: boolean;
  /** Card-driven elemental conversion of the base potion. Highest-priority
   *  flag wins (frost > acid > mercury > fire > neutral). The default
   *  potion is `neutral`; `potionLeavesFire` and `fireRubyActive` still
   *  layer on top to leave a fire pool. */
  potionFrostActive: boolean;
  potionAcidActive: boolean;
  potionMercuryActive: boolean;
  potionAetherActive: boolean;
  potionPoisonActive: boolean;
  towerFireRateMult: number;
  towerRangeMult: number;
  towerDamageMult: number;
  towerBonusVsBurning: boolean;
  towerMercurySlow: boolean;
  towerAcidBreak: boolean;
  towerSyncVolley: boolean;
  lootRadiusMult: number;
  thornyShell: boolean;
  /** Set by the Vital Pulse aura: while true the mannequin regenerates
   *  HP every second during waves. */
  vitalPulseRegen: boolean;
  goldDropMult: number;
  fireRubyCounter: number;
  fireRubyActive: boolean;
  mercuryRingActive: boolean;
  reactionDamageMult: number;
  aetherEngineActive: boolean;
  /** Reactions also charge Overload (+10) when crown_of_elements is active. */
  reactionOverloadCharge: number;
  /** Triple Throw card: every `tripleThrowInterval` seconds the mannequin
   *  spawns a 3-potion fan toward the nearest enemy. 0 = inactive. */
  tripleThrowActive: boolean;
  tripleThrowTimer: number;
  tripleThrowInterval: number;
  /** Salamander legendary: forces every potion to be fire-element and leaves
   *  a fire pool. Cooldown is increased once at apply-time (mq.basePotionCooldown ×= 1.20). */
  salamanderActive: boolean;
  /** Archmaster legendary: new towers spawn at +1 level (min 2) and cost +25%. */
  archmasterActive: boolean;
  /** Multiplicative tower-cost penalty applied by Cursed Cards (e.g. an
   *  Acid Tips Pact that makes towers cost more in exchange for armor
   *  break). Stacks with archmaster. */
  towerCostMult: number;
  /** Cursed-card extra: per-hit chance for non-boss enemies to fully
   *  evade the incoming projectile. Stacks additively when the same
   *  extra is rolled on multiple drafts; capped at 0.6 in
   *  `applyDamageToEnemy` so the player can never softlock. */
  enemyDodgeChance: number;
  /** Cursed-card extra: every newly-spawned non-boss enemy gets an extra
   *  damage-soak shield equal to `maxHp * enemyExtraShieldFraction`. The
   *  fraction stacks additively across rolled extras. */
  enemyExtraShieldFraction: number;
  /** Cursed-card extra: HP-per-second regenerated by every non-boss
   *  enemy while alive. Stacks additively. */
  enemyRegenPerSec: number;
  /** Cursed-card extra: extra armour on top of each enemy's base armour
   *  (additive — `0.10` adds another 10 % damage reduction). */
  enemyArmorAdd: number;
}

export const newModifiers = (): Modifiers => ({
  potionDamageMult: 1,
  potionRadiusMult: 1,
  potionCooldownMult: 1,
  potionEchoExplode: 0,
  potionLeavesFire: false,
  potionFrostActive: false,
  potionAcidActive: false,
  potionMercuryActive: false,
  potionAetherActive: false,
  potionPoisonActive: false,
  towerFireRateMult: 1,
  towerRangeMult: 1,
  towerDamageMult: 1,
  towerBonusVsBurning: false,
  towerMercurySlow: false,
  towerAcidBreak: false,
  towerSyncVolley: false,
  lootRadiusMult: 1,
  thornyShell: false,
  vitalPulseRegen: false,
  goldDropMult: 1,
  fireRubyCounter: 0,
  fireRubyActive: false,
  mercuryRingActive: false,
  reactionDamageMult: 1,
  aetherEngineActive: false,
  reactionOverloadCharge: 0,
  tripleThrowActive: false,
  tripleThrowTimer: 0,
  tripleThrowInterval: 8,
  salamanderActive: false,
  archmasterActive: false,
  towerCostMult: 1,
  enemyDodgeChance: 0,
  enemyExtraShieldFraction: 0,
  enemyRegenPerSec: 0,
  enemyArmorAdd: 0,
});

export interface WaveState {
  currentIndex: number; // -1 before first wave
  timeInWave: number;
  pauseTime: number;
  spawnedCount: number;
  pendingSpawns: WaveDef['spawns'];
  pauseDurationLeft: number;
}

export interface CardChoice {
  options: CardDef[];
  pickedIds: string[]; // ids picked across the run (so we don't show same card twice)
  /** Gold cost of the next reroll. Grows by +25 every time a reroll is
   * spent (starts at 50). Persists across waves within the same run. */
  rerollCost: number;
  /** Whether the free rewarded-ad reroll was already used this draft. */
  freeRerollUsed: boolean;
  /** GDD §8.3: number of drafts the player has been through during this run.
   *  Used together with `lastNonCommonDraft` to guarantee at least one
   *  non-Common offering every 3 drafts, and with `lastLegendaryWave` to cap
   *  Legendary offerings to no more than once every 5 waves. */
  draftCount: number;
  /** Last draft index where at least one non-Common card was OFFERED (not
   *  necessarily picked). -1 if no such draft has happened yet. */
  lastNonCommonDraft: number;
  /** 1-based wave number when a Legendary card was last offered. -10 means
   *  "never" so the first 5 waves are eligible. */
  lastLegendaryWave: number;
}

export interface OverloadState {
  charge: number;
  maxCharge: number;
}

/** Identifiers for the endless-loop modifier pool. */
export type EndlessModifierId =
  | 'hp_x125'
  | 'speed_x110'
  | 'gold_minus10'
  | 'extra_enemies'
  | 'elites_on_normal';

export interface EndlessModifier {
  id: EndlessModifierId;
  label: string;
  desc: string;
}

export const ENDLESS_MODIFIER_POOL: EndlessModifier[] = [
  { id: 'hp_x125',         label: 'Живучесть',       desc: '+25% ХП врагов' },
  { id: 'speed_x110',      label: 'Прыткость',       desc: '+10% скорость врагов' },
  { id: 'gold_minus10',    label: 'Скупость',         desc: '−10% золота' },
  { id: 'extra_enemies',   label: 'Подкрепление',     desc: '+2 врага в каждой волне' },
  { id: 'elites_on_normal', label: 'Элитный патруль', desc: 'Элиты на обычных волнах' },
];

export interface GameState {
  rng: Rng;
  phase: Phase;
  arena: { width: number; height: number; center: Vec2; arenaRadius: number };
  entrances: Entrance[];
  runePoints: RunePoint[];
  mannequin: Mannequin;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  firePools: FirePool[];
  goldPickups: GoldPickup[];
  floatingTexts: FloatingText[];
  /** Visual-only chain-lightning segments (Эфирная катушка). Updated in lockstep
   *  with the rest of the world; damage is applied at spawn-time. */
  chainBolts: ChainBolt[];
  reactionPools: ReactionPool[];
  gold: number;
  essence: number;
  totalKills: number;
  modifiers: Modifiers;
  waveState: WaveState;
  cardChoice: CardChoice;
  overload: OverloadState;
  /** Position the player is aiming at via mouse/touch. */
  aim: Vec2;
  /** Manual fire was requested this frame. */
  manualFireRequested: boolean;
  /** Overload activation requested this frame. */
  overloadRequested: boolean;
  /** Active rune point being targeted in tower-shop UI. */
  activeRunePoint: number | null;
  /** Seconds remaining on the magnet pulse — while >0 all gold pickups are
   * yanked hard toward the hero regardless of loot radius. */
  magnetTimer: number;
  /** Time accumulator (debug + status effects). */
  worldTime: number;
  nextEntityId: number;
  // Meta-progression fields (applied at run start)
  metaTowerDiscount: number;
  metaTowerStartLevel: number;
  metaOverloadRateMult: number;
  metaMannequinArmor: number;
  metaAutoRepairRate: number;
  metaBossShield: number;
  metaAutoRepairCooldown: number;
  metaPotionAimBonus: number;
  metaAuraRadiusMult: number;
  /** Multiplier applied to enemy armour: 0 = no penetration, 1 = full ignore. */
  metaArmorPen: number;
  /** Per-shot crit chance (0..1) for both potions and tower projectiles. */
  metaCritChance: number;
  // --- Difficulty / dungeon mode ---
  /** Which dungeon difficulty was picked for this run. */
  difficulty: DifficultyMode;
  /** The modifier bundle for the active difficulty, already scaled up for
   *  the current endless loop count. */
  difficultyModifier: DifficultyModifier;
  /** When `difficulty === 'daily'`, the rotating event id selected for
   *  today's MSK weekday. Drives event-specific gameplay & visual flags. */
  dailyEventId: DailyEventId | null;
  /** Run-wide "dungeon law" mutators rolled at run start — 1 in Epic, 2 in
   *  Ancient. Empty in Normal / Endless / Daily. The order in this array is
   *  also the apply-order; later entries stack on top of earlier ones. */
  activeMutatorIds: MutatorId[];
  /** Run contracts ("заказы") rolled at run start — 2 in Epic, 3 in Ancient.
   *  Empty in Normal / Endless / Daily. Each contract pays a bonus reward
   *  (extra blue / ancient essence, or a multiplier bump) on run-end if the
   *  goal in `data/contracts.ts` resolves to `done` for this state. */
  activeContractIds: ContractId[];
  /** Bag of incremental counters used by every contract goal. Mutated from
   *  the existing on-damage / on-death / on-tower-buy hooks; never read by
   *  combat code itself. Resets per run with a fresh `GameState`. */
  contractStats: ContractStats;
  /** "Дар алхимика" — blessings the player picked at run start. Always
   *  one entry in Epic/Ancient (the chosen blessing); empty otherwise. */
  activeBlessingIds: BlessingId[];
  /** Mandatory curse picked alongside the blessing in Ancient. `null` for
   *  Epic and the easier modes. */
  activeCurseId: CurseId | null;
  /** Multiplier applied to per-wave spawn count (Horde event). 1 = default. */
  spawnCountMult: number;
  /** Render-side darkness flag — drawn on top of the world (Night event). */
  nightModeActive: boolean;
  /** In endless mode, how many full wave-lists we have already completed. */
  endlessLoop: number;
  /** Biome selected for this run. Affects palette and passive modifiers. */
  biomeId: BiomeId;
  /** Cumulative endless-mode modifiers applied after each W15 loop. */
  endlessModifiers: EndlessModifier[];
  /** The modifier just rolled for the upcoming endless cycle (shown in the
   *  selector overlay). Null when no selection is pending. */
  pendingEndlessModifier: EndlessModifierId | null;
  /** Seconds left on the active "Temporary Shield" buy. While >0 incoming
   * damage to the mannequin is reduced by `tempShieldReduction`. */
  tempShieldTime: number;
  /** Damage reduction applied while `tempShieldTime > 0` (e.g. 0.5 = -50% dmg). */
  tempShieldReduction: number;
  /** Golem Heart legendary card: number of charges remaining. While >0, a
   *  lethal hit to the mannequin is converted into a 1-HP survival + a strong
   *  6-second shield. Set to 1 when the card is picked, decremented to 0 on use. */
  golemHeartCharges: number;
  /** Mannequin module loadout for THIS run. Mirrored from the meta save at
   *  run start; cards (e.g. `chronos`) may temporarily override the active
   *  slot for the duration of the run. */
  activeModuleId: string;
  auraModuleId: string;
  /** Трансмутация active-module timer (seconds). While >0 enemy gold drops
   *  are multiplied by `transmuteGoldMult`. */
  transmuteTimer: number;
  transmuteGoldMult: number;
  /** Whether the player has already used the revive-via-ad option this run. */
  reviveUsed: boolean;
  /** While true, the world is frozen (e.g. waiting for a rewarded ad). */
  revivePaused: boolean;

  // ─── Crafted potions (PR-«крафт») ──────────────────────────────────────
  /** Mirror of `MetaSave.inventory` for THIS run. Slots are nulled out as the
   *  player consumes them; nothing is written back until the run ends. */
  inventory: (string | null)[];
  /** Active timed potion effects. Tick down each frame; effects with timeLeft
   *  ≤ 0 are removed. Recipes that grant charges (Алхимическая буря) live in
   *  their own counter, not in this list. */
  activePotions: ActivePotion[];
  /** Charges for the «Алхимическая буря» recipe — each thrown potion consumes
   *  one charge and gets `stormChargeMult`× damage. */
  stormCharges: number;
  stormChargeMult: number;
  /** Mannequin "stone shield" added by the recipe — flat HP that absorbs
   *  damage before mannequin.hp does. */
  potionShieldHp: number;
  /** Hook fired when an enemy drops a crafting ingredient. Wired to the
   *  meta save in `main.ts`; left null in the default state so headless
   *  unit tests can ignore it. */
  onIngredientDrop: ((ingredientId: string, amount: number) => void) | null;
}

export interface ActivePotion {
  /** Recipe id (`PotionRecipe.id`). */
  id: string;
  /** Seconds remaining. Decremented in the main loop. */
  timeLeft: number;
  /** Initial duration so the HUD can render a fill ring. */
  duration: number;
}

export function newId(state: GameState): number {
  return state.nextEntityId++;
}

export function spawnFloatingText(
  state: GameState,
  text: string,
  pos: Vec2,
  color: string,
): void {
  state.floatingTexts.push({
    id: newId(state),
    text,
    pos: { ...pos },
    color,
    life: 0.8,
    vy: -32,
  });
}

export function newStatusEffects(): StatusEffects {
  return newStatus();
}
