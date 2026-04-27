import { dist, type Vec2 } from '../engine/math';
import type { Enemy, GameState } from './state';
import { newId, spawnFloatingText } from './state';
import type { Element } from './types';
import { addOverload } from './enemy';

export interface ReactionPool {
  id: number;
  kind: 'caustic_vapor' | 'time_rift';
  pos: Vec2;
  radius: number;
  time: number;
}

export function checkElementalReaction(
  state: GameState,
  enemy: Enemy,
  newElement: Element,
): void {
  if (newElement === 'neutral') return;

  // Fire + Acid = Caustic Vapor (AoE damage + armor reduction cloud)
  if (
    (newElement === 'fire' && enemy.status.armorBreakTime > 0) ||
    (newElement === 'acid' && enemy.status.burnTime > 0)
  ) {
    spawnCausticVapor(state, enemy.pos);
    spawnFloatingText(state, 'Едкий пар!', enemy.pos, '#d2f55a');
    if (state.modifiers.aetherEngineActive) addOverload(state, 15);
  }

  // Mercury + Aether = Time Rift (strong slow zone)
  if (
    (newElement === 'mercury' && hasAetherHit(enemy)) ||
    (newElement === 'aether' && enemy.status.slowTime > 0)
  ) {
    spawnTimeRift(state, enemy.pos);
    spawnFloatingText(state, 'Временной разлом!', enemy.pos, '#7df9ff');
    if (state.modifiers.aetherEngineActive) addOverload(state, 15);
  }
}

function hasAetherHit(enemy: Enemy): boolean {
  return enemy.status.burnTime <= 0 &&
    enemy.status.slowTime <= 0 &&
    enemy.status.armorBreakTime <= 0;
}

function spawnCausticVapor(state: GameState, pos: Vec2): void {
  state.reactionPools.push({
    id: newId(state),
    kind: 'caustic_vapor',
    pos: { ...pos },
    radius: 55,
    time: 3.0,
  });
}

function spawnTimeRift(state: GameState, pos: Vec2): void {
  state.reactionPools.push({
    id: newId(state),
    kind: 'time_rift',
    pos: { ...pos },
    radius: 65,
    time: 2.5,
  });
}

export function updateReactionPools(state: GameState, dt: number): void {
  const remove: number[] = [];
  for (let i = 0; i < state.reactionPools.length; i++) {
    const rp = state.reactionPools[i]!;
    rp.time -= dt;
    if (rp.time <= 0) { remove.push(i); continue; }

    for (const e of state.enemies) {
      const d = dist(rp.pos, e.pos);
      if (d > rp.radius + e.kind.radius) continue;

      if (rp.kind === 'caustic_vapor') {
        e.hp -= 6 * dt * state.modifiers.reactionDamageMult;
        e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.4);
        e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 1.5);
        e.hitFlash = Math.max(e.hitFlash, 0.04);
      } else if (rp.kind === 'time_rift') {
        e.status.slowFactor = Math.min(e.status.slowFactor, 0.25);
        e.status.slowTime = Math.max(e.status.slowTime, 0.5);
      }
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.reactionPools.splice(remove[i]!, 1);
}
