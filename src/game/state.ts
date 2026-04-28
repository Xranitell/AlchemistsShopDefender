import type { Vec2 } from '../engine/math';
import { Rng } from '../engine/rng';
import type { CardDef, Entrance, EnemyKind, StatusEffects, TowerKind, WaveDef } from './types';
import { newStatus } from './types';
import type { ReactionPool } from './reactions';
import type { DifficultyMode, DifficultyModifier, EnemyAbility } from '../data/difficulty';

export type Phase =
  | 'menu'
  | 'preparing'
  | 'wave'
  | 'card_select'
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
}

export type TargetingMode = 'nearest' | 'strongest' | 'fastest' | 'debuffed' | 'first';

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

export interface RunePoint {
  id: number;
  pos: Vec2;
  active: boolean; // unlocked by meta-progression (always true in MVP)
  towerId: number | null;
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
  element: 'neutral' | 'fire' | 'mercury' | 'acid' | 'aether';
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

export interface Modifiers {
  potionDamageMult: number;
  potionRadiusMult: number;
  potionCooldownMult: number;
  potionEchoExplode: number;
  potionLeavesFire: boolean;
  towerFireRateMult: number;
  towerRangeMult: number;
  towerDamageMult: number;
  towerBonusVsBurning: boolean;
  towerMercurySlow: boolean;
  towerAcidBreak: boolean;
  towerSyncVolley: boolean;
  lootRadiusMult: number;
  overloadType: 'lightning' | 'chronos';
  thornyShell: boolean;
  goldDropMult: number;
  fireRubyCounter: number;
  fireRubyActive: boolean;
  mercuryRingActive: boolean;
  reactionDamageMult: number;
  aetherEngineActive: boolean;
}

export const newModifiers = (): Modifiers => ({
  potionDamageMult: 1,
  potionRadiusMult: 1,
  potionCooldownMult: 1,
  potionEchoExplode: 0,
  potionLeavesFire: false,
  towerFireRateMult: 1,
  towerRangeMult: 1,
  towerDamageMult: 1,
  towerBonusVsBurning: false,
  towerMercurySlow: false,
  towerAcidBreak: false,
  towerSyncVolley: false,
  lootRadiusMult: 1,
  overloadType: 'lightning',
  thornyShell: false,
  goldDropMult: 1,
  fireRubyCounter: 0,
  fireRubyActive: false,
  mercuryRingActive: false,
  reactionDamageMult: 1,
  aetherEngineActive: false,
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
  /** Gold cost of the next reroll during the current card-draft. Grows by
   * +25 every time a reroll is spent (starts at 50). Resets to 50 at the
   * start of each draft. */
  rerollCost: number;
  /** Whether the free rewarded-ad reroll was already used this draft. */
  freeRerollUsed: boolean;
}

export interface OverloadState {
  charge: number;
  maxCharge: number;
}

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
  // --- Difficulty / dungeon mode ---
  /** Which dungeon difficulty was picked for this run. */
  difficulty: DifficultyMode;
  /** The modifier bundle for the active difficulty, already scaled up for
   *  the current endless loop count. */
  difficultyModifier: DifficultyModifier;
  /** In endless mode, how many full wave-lists we have already completed. */
  endlessLoop: number;
  /** Seconds left on the active "Temporary Shield" buy. While >0 incoming
   * damage to the mannequin is reduced by `tempShieldReduction`. */
  tempShieldTime: number;
  /** Damage reduction applied while `tempShieldTime > 0` (e.g. 0.5 = -50% dmg). */
  tempShieldReduction: number;
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
