import { dist, type Vec2 } from '../engine/math';
import type { Enemy, GameState } from './state';
import { newId, spawnFloatingText } from './state';
import type { Element } from './types';
import { addOverload } from './enemy';

export interface ReactionPool {
  id: number;
  kind:
    | 'caustic_vapor'   // fire + acid
    | 'time_rift'       // mercury + aether
    | 'spark_cascade'   // fire + aether (chain)
    | 'brittle_frost'   // acid + frost
    | 'glass_shatter'   // mercury + frost
    | 'mutagen_burst'   // acid + poison
    | 'flash_steam';    // fire + frost
  pos: Vec2;
  radius: number;
  time: number;
  maxTime: number;
}

/**
 * Triggered every time an enemy is freshly hit by an `element`. Examines the
 * enemy's existing status flags to detect 2-element combinations and spawns
 * the matching reaction pool / one-off effect.
 *
 * Reactions implemented:
 *   Огонь   + Кислота  → Едкий пар (caustic_vapor)
 *   Ртуть   + Эфир     → Временной разлом (time_rift)
 *   Огонь   + Эфир     → Искровой каскад (spark_cascade) — instant chain
 *   Кислота + Мороз    → Хрупкая глазурь (brittle_frost)
 *   Ртуть   + Мороз    → Стеклянная заморозка (glass_shatter)
 *   Кислота + Яд       → Мутагенный взрыв (mutagen_burst)
 *   Огонь   + Мороз    → Паровой удар (flash_steam) — clears chill, AoE burn
 */
export function checkElementalReaction(
  state: GameState,
  enemy: Enemy,
  newElement: Element,
): void {
  if (newElement === 'neutral') return;
  const s = enemy.status;

  // Fire + Acid = Caustic Vapor
  if (
    (newElement === 'fire' && s.armorBreakTime > 0) ||
    (newElement === 'acid' && s.burnTime > 0)
  ) {
    spawnPool(state, 'caustic_vapor', enemy.pos, 55, 3.0);
    spawnFloatingText(state, 'Едкий пар!', enemy.pos, '#d2f55a');
    chargeOverloadOnReaction(state, 15);
  }

  // Mercury + Aether = Time Rift
  if (
    (newElement === 'mercury' && hasAetherMark(enemy)) ||
    (newElement === 'aether' && s.slowTime > 0)
  ) {
    spawnPool(state, 'time_rift', enemy.pos, 65, 2.5);
    spawnFloatingText(state, 'Временной разлом!', enemy.pos, '#7df9ff');
    chargeOverloadOnReaction(state, 15);
  }

  // Fire + Aether = Spark Cascade — instant chain to up to 3 nearby enemies.
  if (
    (newElement === 'fire' && hasAetherMark(enemy)) ||
    (newElement === 'aether' && s.burnTime > 0)
  ) {
    triggerSparkCascade(state, enemy);
    spawnFloatingText(state, 'Искровой каскад!', enemy.pos, '#a78bfa');
    chargeOverloadOnReaction(state, 12);
  }

  // Acid + Frost = Brittle Frost — strong armor break + freeze pool.
  if (
    (newElement === 'acid' && s.frostMarkTime > 0) ||
    (newElement === 'frost' && s.armorBreakTime > 0)
  ) {
    spawnPool(state, 'brittle_frost', enemy.pos, 50, 2.5);
    enemy.status.armorBreakFactor = Math.min(enemy.status.armorBreakFactor, 0.3);
    enemy.status.armorBreakTime = Math.max(enemy.status.armorBreakTime, 3.5);
    spawnFloatingText(state, 'Хрупкая глазурь!', enemy.pos, '#7dd3fc');
    chargeOverloadOnReaction(state, 8);
  }

  // Mercury + Frost = Glass Shatter — burst damage to slow + chilled enemies.
  if (
    (newElement === 'mercury' && s.frostMarkTime > 0) ||
    (newElement === 'frost' && s.slowTime > 0)
  ) {
    spawnPool(state, 'glass_shatter', enemy.pos, 45, 0.6);
    spawnFloatingText(state, 'Стекло вдребезги!', enemy.pos, '#c0e8ff');
    chargeOverloadOnReaction(state, 8);
  }

  // Acid + Poison = Mutagen Burst — heavy DoT around target.
  if (
    (newElement === 'acid' && s.poisonTime > 0) ||
    (newElement === 'poison' && s.armorBreakTime > 0)
  ) {
    spawnPool(state, 'mutagen_burst', enemy.pos, 60, 4.0);
    spawnFloatingText(state, 'Мутаген!', enemy.pos, '#9be36b');
    chargeOverloadOnReaction(state, 10);
  }

  // Fire + Frost = Flash Steam — clears chill, deals AoE burn.
  if (
    (newElement === 'fire' && s.frostMarkTime > 0) ||
    (newElement === 'frost' && s.burnTime > 0)
  ) {
    spawnPool(state, 'flash_steam', enemy.pos, 70, 1.5);
    enemy.status.frostMarkTime = 0;
    spawnFloatingText(state, 'Пар!', enemy.pos, '#f4a261');
    chargeOverloadOnReaction(state, 8);
  }
}

/** Aether Engine catalyst card and Crown of Elements legendary both grant
 *  Overload charge on reactions; the legendary stacks additively on top.
 *  This helper centralises that so individual reactions don't need to know
 *  which sources are active. */
function chargeOverloadOnReaction(state: GameState, baseAmount: number): void {
  let total = 0;
  if (state.modifiers.aetherEngineActive) total += baseAmount;
  if (state.modifiers.reactionOverloadCharge > 0) {
    total += state.modifiers.reactionOverloadCharge;
  }
  if (total > 0) addOverload(state, total);
}

function hasAetherMark(enemy: Enemy): boolean {
  return enemy.status.aetherMarkTime > 0;
}

function spawnPool(
  state: GameState,
  kind: ReactionPool['kind'],
  pos: Vec2,
  radius: number,
  time: number,
): void {
  state.reactionPools.push({
    id: newId(state),
    kind,
    pos: { ...pos },
    radius,
    time,
    maxTime: time,
  });
}

function triggerSparkCascade(state: GameState, source: Enemy): void {
  // Find up to 3 nearest enemies within 180px and zap each for a flat 14 dmg
  // scaled by reaction modifier.
  const candidates = state.enemies
    .filter((e) => e.id !== source.id)
    .map((e) => ({ e, d: dist(source.pos, e.pos) }))
    .filter((x) => x.d < 180)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  const dmg = 14 * state.modifiers.reactionDamageMult;
  for (const c of candidates) {
    c.e.hp -= dmg;
    c.e.hitFlash = Math.max(c.e.hitFlash, 0.1);
    c.e.status.aetherMarkTime = Math.max(c.e.status.aetherMarkTime, 1.5);
  }
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

      const dmgMult = state.modifiers.reactionDamageMult;
      switch (rp.kind) {
        case 'caustic_vapor':
          e.hp -= 6 * dt * dmgMult;
          e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.4);
          e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 1.5);
          e.hitFlash = Math.max(e.hitFlash, 0.04);
          break;
        case 'time_rift':
          e.status.slowFactor = Math.min(e.status.slowFactor, 0.25);
          e.status.slowTime = Math.max(e.status.slowTime, 0.5);
          break;
        case 'brittle_frost':
          // Frozen enemies inside a brittle pool lose 5 HP / sec from
          // crystallisation pressure (damages even slowed enemies).
          e.status.slowFactor = Math.min(e.status.slowFactor, 0.3);
          e.status.slowTime = Math.max(e.status.slowTime, 0.5);
          e.status.frostMarkTime = Math.max(e.status.frostMarkTime, 1.0);
          e.hp -= 5 * dt * dmgMult;
          break;
        case 'glass_shatter':
          // Single big damage tick on first contact.
          if (rp.time > rp.maxTime - 0.1) {
            e.hp -= 30 * dmgMult;
            e.hitFlash = Math.max(e.hitFlash, 0.12);
          }
          break;
        case 'mutagen_burst':
          // Sticks heavy poison and ticks armour break.
          e.status.poisonDps = Math.max(e.status.poisonDps, 8 * dmgMult);
          e.status.poisonTime = Math.max(e.status.poisonTime, 3);
          e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.55);
          e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 2);
          break;
        case 'flash_steam':
          // AoE burn that clears chills.
          e.status.frostMarkTime = 0;
          e.status.burnDps = Math.max(e.status.burnDps, 9 * dmgMult);
          e.status.burnTime = Math.max(e.status.burnTime, 1.5);
          break;
        case 'spark_cascade':
          // Spark cascade is instant — pool only used for VFX trace.
          break;
      }
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.reactionPools.splice(remove[i]!, 1);
}
