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
  /** Strength tier for the enemy's signature ability. `base` keeps the
   *  default mechanics, `epic` amplifies them (more children on split,
   *  bigger explosion radius, etc.) and `ancient` adds an extra layer
   *  on top (split children also split, sappers disable towers longer
   *  and leave a fire pool, etc.). Set once at spawn time from the
   *  active difficulty (see `abilityTierFor`). */
  abilityTier: 'base' | 'epic' | 'ancient';
  /** Shaman-only: seconds until the next aura-heal pulse. The pulse
   *  itself is handled in `enemy.ts` once the timer hits zero. */
  auraHealTimer: number;
  /** Golem-only: seconds remaining until the one-hit shield regenerates
   *  another charge (epic / ancient only). 0 when no regen is queued. */
  shieldRegenTimer: number;
  /** Rat-only (when carrying `zigzag_dash`): seconds left in the active
   *  forward sprint. While `zigzagTimer > 0` the rat doubles its speed
   *  toward the mannequin. */
  zigzagTimer: number;
  /** Legacy direction multiplier from the old zig-zag dash. Kept on the
   *  type to avoid reshaping saved/spawned enemy objects. */
  zigzagDir: 1 | -1;
  /** Cooldown until the next forward sprint can start. */
  zigzagCooldown: number;
  /** Sapper-only (Эпический+ when carrying `disable_tower_on_contact`):
   *  the tower-id this sapper has latched onto. -1 when not latched.
   *  While latched the sapper freezes in place, drains the tower's
   *  `disabledTimer`, and detonates after the regular fuse expires. */
  attachedTowerId: number;
  /** Set to the spawning boss's `id` when this enemy was summoned by the
   *  homunculus (or any other boss that gains the same hook in the
   *  future). The boss heals a small amount when an enemy carrying its
   *  id dies, regardless of who landed the killing blow. -1 = not a
   *  boss-summoned minion. */
  summonedByBossId: number;
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
  /** Seconds the tower is offline. While `disabledTimer > 0` the tower
   *  cannot acquire targets or fire — currently driven by Эпический+
   *  sapper EMP attaches and golem death pulses. The renderer paints a
   *  glitch / sparks overlay while disabled so the silence is legible. */
  disabledTimer: number;
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
  /** Whether this vial should leave a fire pool on impact (Flammable Mix). */
  leaveFire: boolean;
  /** Whether a vial should fire a secondary mini-explosion shortly after. */
  echoExplosion: boolean;
  bonusFromManualAim: boolean;
  /** Parabolic-arc fields (only populated for thrown vials). */
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
  /** Original life at spawn — needed to compute the scale-pop envelope and
   *  the fade curve independently of `life`'s shrinking value. Set by
   *  `spawnFloatingText` based on `kind`. */
  maxLife: number;
  vy: number;
  /** Visual variant. 'crit' is rendered larger, with a gold-glow halo and
   *  four sparkles around the number. Defaults to 'normal'. */
  kind: 'normal' | 'crit';
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

/** Death Mark Overload fuse: tracks one marked enemy that will detonate
 *  when its `delay` elapses, dealing AoE damage based on the enemy's
 *  current HP (see `tickDeathMarks` in game/overload.ts). */
export interface DeathMarkFuse {
  id: number;
  enemyId: number;
  delay: number;
  /** Cached pos for the VFX ring even if the enemy dies early. */
  pos: Vec2;
  /** Pulse phase used by render.ts to animate the ring. */
  age: number;
}

/** Meteor Shower Overload impact: queued by `runMeteorShower`, ticked
 *  down by `tickMeteorImpacts` and detonated when `delay <= 0`. Each
 *  impact carries its own splash radius / damage for symmetry with the
 *  visual. */
export interface MeteorImpact {
  id: number;
  pos: Vec2;
  delay: number;
  damage: number;
  radius: number;
  /** Total time the meteor was scheduled for; used for the streak VFX. */
  total: number;
}

/** Short-lived shockwave / glow drawn at a vial's impact site so the
 *  player can see the actual splash radius the area-damage check used.
 *  Spawned by `resolveImpact` on every vial landing (including echo
 *  secondaries). Visual only — `applyAreaDamage` already resolved the
 *  hit before the blast was queued. */
export interface PotionBlast {
  id: number;
  pos: Vec2;
  /** World-space splash radius — the same value passed to
   *  `applyAreaDamage`, so the on-screen ring traces the exact zone
   *  enemies were checked against. */
  radius: number;
  /** Remaining lifetime in seconds. Counts down to 0 and is removed. */
  time: number;
  /** Original lifetime — needed to compute the expansion / fade
   *  envelope independently of `time`'s shrinking value. */
  maxTime: number;
  /** Element of the parent vial. Used to tint the ring (fire =
   *  orange, frost = cyan, mercury = silver, …). */
  element: import('./types').Element;
  /** True for echo-secondary blasts so the renderer can draw a softer
   *  / smaller ring (matches the halved camera shake of echoes). */
  echo: boolean;
}

export interface Modifiers {
  potionDamageMult: number;
  potionRadiusMult: number;
  potionCooldownMult: number;
  potionEchoExplode: number;
  potionLeavesFire: boolean;
  /** Card-driven elemental conversion of the base vial. Highest-priority
   *  flag wins (frost > acid > mercury > fire > neutral). The default
   *  vial is `neutral`; `potionLeavesFire` and `fireRubyActive` still
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
  goldDropMult: number;
  fireRubyCounter: number;
  fireRubyActive: boolean;
  mercuryRingActive: boolean;
  reactionDamageMult: number;
  aetherEngineActive: boolean;
  /** Reactions also charge Overload (+10) when crown_of_elements is active. */
  reactionOverloadCharge: number;
  /** Triple Throw card: every `tripleThrowInterval` seconds the mannequin
   *  spawns a 3-vial fan toward the nearest enemy. 0 = inactive. */
  tripleThrowActive: boolean;
  tripleThrowTimer: number;
  tripleThrowInterval: number;
  /** Salamander legendary: forces every vial to be fire-element and leaves
   *  a fire pool. Cooldown is increased once at apply-time (mq.basePotionCooldown ×= 1.25). */
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
  { id: 'hp_x125',         label: 'Живучесть',       desc: '+25% к ХП врагов' },
  { id: 'speed_x110',      label: 'Прыткость',       desc: '+10% к скорости врагов' },
  { id: 'gold_minus10',    label: 'Скупость',         desc: '−10% к золоту' },
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
  /** Active vial-impact shockwaves — visual rings drawn at the
   *  splash radius for ~0.5 s after every vial landing. See
   *  `PotionBlast` for the per-blast fields. */
  potionBlasts: PotionBlast[];
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
  /** Per-shot crit chance (0..1) for both vials and tower projectiles. */
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
  /** Active dungeon-law mutators. Epic/Ancient re-roll them before every wave;
   *  Endless stacks new laws permanently after 15-wave cycles. Empty in
   *  Normal / Daily. The order in this array is also the apply-order; later
   *  entries stack on top of earlier ones. */
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
  /** Mannequin Overload selection for THIS run. Mirrored from the meta
   *  save at run start; cards (e.g. `chronos`) may temporarily override
   *  the slot for the duration of the run. The previous separate
   *  `auraModuleId` slot has been removed: passive auras were dropped in
   *  favour of a single, more impactful Overload choice. */
  activeModuleId: string;
  /** Active Death Mark fuses spawned by the death_mark Overload. Each entry
   *  is consumed after its delay elapses by `tickDeathMarks`. */
  deathMarks: DeathMarkFuse[];
  /** Pending meteor impacts queued by the meteor_shower Overload. Each
   *  meteor lands at its scheduled time and is removed after detonating. */
  meteorImpacts: MeteorImpact[];
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
  /** Charges for the «Алхимическая буря» recipe — each thrown vial consumes
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
  kind: 'normal' | 'crit' = 'normal',
): void {
  // Crits live a bit longer and float slightly faster so they read as
  // "big" against ambient ticks of armor / dodge text.
  const life = kind === 'crit' ? 1.1 : 0.8;
  const vy = kind === 'crit' ? -42 : -32;
  state.floatingTexts.push({
    id: newId(state),
    text,
    pos: { ...pos },
    color,
    life,
    maxLife: life,
    vy,
    kind,
  });
}

export function newStatusEffects(): StatusEffects {
  return newStatus();
}
