import type { Vec2 } from '../engine/math';
import { Rng } from '../engine/rng';
import type { CardDef, Entrance, EnemyKind, StatusEffects, TowerKind, WaveDef } from './types';
import { newStatus } from './types';
import type { ReactionPool } from './reactions';

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
  potionEchoExplode: boolean;
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
  mercuryRingActive: boolean;
  reactionDamageMult: number;
  aetherEngineActive: boolean;
}

export const newModifiers = (): Modifiers => ({
  potionDamageMult: 1,
  potionRadiusMult: 1,
  potionCooldownMult: 1,
  potionEchoExplode: false,
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
  /** Time accumulator (debug + status effects). */
  worldTime: number;
  nextEntityId: number;
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
