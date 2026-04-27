import { dist, dist2, norm, scale, sub, type Vec2 } from '../engine/math';
import type { Enemy, GameState, Projectile } from './state';
import { newId, spawnFloatingText } from './state';
import { checkElementalReaction } from './reactions';

export function fireTowerProjectile(
  state: GameState,
  fromPos: Vec2,
  target: Enemy,
  damage: number,
  splash: number,
  speed: number,
  element: Projectile['element'],
): void {
  const dir = norm(sub(target.pos, fromPos));
  state.projectiles.push({
    id: newId(state),
    kind: 'tower',
    pos: { ...fromPos },
    vel: scale(dir, speed),
    damage,
    splashRadius: splash,
    targetId: target.id,
    element,
    life: 2.0,
    leaveFire: false,
    echoExplosion: false,
    bonusFromManualAim: false,
  });
}

export function throwPotion(
  state: GameState,
  to: Vec2,
  manual: boolean,
): void {
  const m = state.mannequin;
  const damage = m.basePotionDamage * state.modifiers.potionDamageMult;
  const radius = m.basePotionRadius * state.modifiers.potionRadiusMult;
  const dir = norm(sub(to, m.pos));
  const speed = 520;

  // Manual aim grants a bonus on the centre of the explosion.
  state.projectiles.push({
    id: newId(state),
    kind: 'potion',
    pos: { ...m.pos },
    vel: scale(dir, speed),
    damage,
    splashRadius: radius,
    targetId: null,
    element: (state.modifiers.potionLeavesFire || state.modifiers.fireRubyActive) ? 'fire' : 'neutral',
    life: 1.6,
    leaveFire: state.modifiers.potionLeavesFire || state.modifiers.fireRubyActive,
    echoExplosion: state.modifiers.potionEchoExplode && state.rng.chance(0.5),
    bonusFromManualAim: manual,
  });
}

export function updateProjectiles(state: GameState, dt: number): void {
  const remove: number[] = [];
  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i]!;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;

    let hit: Enemy | null = null;

    if (p.kind === 'tower') {
      // Track target if alive.
      if (p.targetId !== null) {
        const target = state.enemies.find((e) => e.id === p.targetId);
        if (target && dist(p.pos, target.pos) < (target.kind.radius + 6)) {
          hit = target;
        }
      }
      // Fall back: any enemy within 8px (handles homing+death).
      if (!hit) {
        for (const e of state.enemies) {
          if (dist2(e.pos, p.pos) < (e.kind.radius + 4) ** 2) {
            hit = e; break;
          }
        }
      }
    } else if (p.kind === 'potion') {
      // Potions explode either on first enemy contact or at travel limit.
      for (const e of state.enemies) {
        if (dist2(e.pos, p.pos) < (e.kind.radius + 6) ** 2) {
          hit = e; break;
        }
      }
    }

    const offscreen =
      p.pos.x < -50 || p.pos.x > state.arena.width + 50 ||
      p.pos.y < -50 || p.pos.y > state.arena.height + 50;

    if (hit || p.life <= 0 || offscreen) {
      // Resolve impact at the projectile's position (or potion centre).
      resolveImpact(state, p, hit?.pos ?? p.pos);
      remove.push(i);
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.projectiles.splice(remove[i]!, 1);
}

function resolveImpact(state: GameState, p: Projectile, at: Vec2): void {
  if (p.splashRadius > 0) {
    applyAreaDamage(state, at, p.splashRadius, p.damage, p.element, p.bonusFromManualAim);
  } else {
    // Single-target hit.
    const e = nearestEnemy(state, at, 14);
    if (e) applyDamageToEnemy(state, e, p.damage, p.element);
  }

  if (p.kind === 'potion' && p.leaveFire) {
    state.firePools.push({
      id: newId(state),
      pos: { ...at },
      radius: p.splashRadius * 0.9,
      dps: 8 * state.modifiers.potionDamageMult,
      time: 3.0,
    });
  }

  if (p.kind === 'potion' && p.echoExplosion) {
    // Schedule a smaller secondary explosion via a short-lived projectile.
    state.projectiles.push({
      id: newId(state),
      kind: 'potion',
      pos: { ...at },
      vel: { x: 0, y: 0 },
      damage: p.damage * 0.5,
      splashRadius: p.splashRadius * 0.6,
      targetId: null,
      element: p.element,
      life: 0.25, // life ticks down then triggers an impact at rest
      leaveFire: false,
      echoExplosion: false,
      bonusFromManualAim: false,
    });
  }
}

function nearestEnemy(state: GameState, at: Vec2, maxDistance: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = maxDistance;
  for (const e of state.enemies) {
    const d = dist(at, e.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export function applyAreaDamage(
  state: GameState,
  at: Vec2,
  radius: number,
  damage: number,
  element: Projectile['element'],
  manualBonus: boolean,
): void {
  for (const e of state.enemies) {
    const d = dist(at, e.pos);
    if (d > radius + e.kind.radius) continue;
    let dmg = damage;
    if (manualBonus && d < radius * 0.4) dmg *= 1.2;
    applyDamageToEnemy(state, e, dmg, element);
  }
}

export function applyDamageToEnemy(
  state: GameState,
  e: Enemy,
  rawDamage: number,
  element: Projectile['element'],
): void {
  const armor = e.kind.armor * e.status.armorBreakFactor;
  let dmg = Math.max(1, rawDamage * (1 - armor));

  // Engineering: +30% damage to burning enemies.
  if (state.modifiers.towerBonusVsBurning && e.status.burnTime > 0) {
    dmg *= 1.3;
  }

  e.hp -= dmg;
  e.hitFlash = 0.12;

  // Check elemental reactions before applying new status (order matters).
  checkElementalReaction(state, e, element);

  // Apply elemental statuses.
  if (element === 'fire') {
    e.status.burnDps = Math.max(e.status.burnDps, 6 * state.modifiers.potionDamageMult);
    e.status.burnTime = Math.max(e.status.burnTime, 2.5);
  } else if (element === 'mercury') {
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.55);
    e.status.slowTime = Math.max(e.status.slowTime, 2.5);
  } else if (element === 'acid') {
    e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.5);
    e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 4);
  } else if (element === 'aether') {
    e.status.aetherMarkTime = Math.max(e.status.aetherMarkTime, 3);
  }

  // Mercury Coating card: all tower hits apply mild slow.
  if (state.modifiers.towerMercurySlow && element === 'neutral') {
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.8);
    e.status.slowTime = Math.max(e.status.slowTime, 1.5);
  }
  // Acid Tips card: all tower hits apply mild armor break.
  if (state.modifiers.towerAcidBreak && element === 'neutral') {
    e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.85);
    e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 2);
  }

  if (e.hp <= 0) {
    spawnFloatingText(state, '+', e.pos, '#ffd166');
  }
}
