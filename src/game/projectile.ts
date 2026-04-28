import { dist, dist2, norm, scale, sub, type Vec2 } from '../engine/math';
import type { Enemy, GameState, Projectile } from './state';
import { newId, spawnFloatingText } from './state';
import { checkElementalReaction } from './reactions';
import type { Element } from './types';
import { audio } from '../audio/audio';
import { tutorial } from '../ui/tutorial';
import { t } from '../i18n';

/** Pick the element of a thrown potion based on currently-active recipe
 *  modifiers. Cards can layer multiple flags on the same potion — we resolve
 *  with a fixed priority so the most "specialised" recipe wins. */
function selectPotionElement(state: GameState): Element {
  const m = state.modifiers;
  // Salamander legendary forces every potion to be fire-element regardless of
  // any other recipe layered on top.
  if (m.salamanderActive) return 'fire';
  if (m.potionFrostActive) return 'frost';
  if (m.potionPoisonActive) return 'poison';
  if (m.potionAcidActive) return 'acid';
  if (m.potionMercuryActive) return 'mercury';
  if (m.potionAetherActive) return 'aether';
  if (m.potionLeavesFire || m.fireRubyActive) return 'fire';
  return 'neutral';
}

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
  // Slight pitch jitter per element so chained shots from the same volley
  // don't sound mechanical. Rate-limiting in the audio engine handles bursts.
  const detune = element === 'fire' ? 0.85 : element === 'frost' ? 1.2 : 1.0;
  audio.playSfx('towerFire', { detune });
}

export function throwPotion(
  state: GameState,
  to: Vec2,
  manual: boolean,
): void {
  const m = state.mannequin;
  const damage = m.basePotionDamage * state.modifiers.potionDamageMult;
  const radius = m.basePotionRadius * state.modifiers.potionRadiusMult;

  // Parabolic arc: potion follows a ballistic curve from the alchemist to the
  // aim point, landing in `duration` seconds. Flight time scales mildly with
  // distance so short tosses feel snappy and long ones feel hefty.
  const start: Vec2 = { ...m.pos };
  const target: Vec2 = { ...to };
  const d = dist(start, target);
  const duration = Math.min(0.85, Math.max(0.32, d / 900));
  // Bigger throws arc higher so the curve is visible even on short tosses.
  const peakHeight = Math.min(140, 40 + d * 0.18);

  state.projectiles.push({
    id: newId(state),
    kind: 'potion',
    pos: { ...start },
    vel: { x: 0, y: 0 },
    damage,
    splashRadius: radius,
    targetId: null,
    element: selectPotionElement(state),
    life: duration + 0.1,
    leaveFire: state.modifiers.potionLeavesFire || state.modifiers.fireRubyActive,
    echoExplosion: state.modifiers.potionEchoExplode > 0 && state.rng.chance(state.modifiers.potionEchoExplode),
    bonusFromManualAim: manual,
    arc: { start, target, t: 0, duration, peakHeight, height: 0 },
  });
}

export function updateProjectiles(state: GameState, dt: number): void {
  const remove: number[] = [];
  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i]!;
    p.life -= dt;

    let hit: Enemy | null = null;

    if (p.kind === 'potion' && p.arc) {
      // Parabolic flight: interpolate along the ground plane while tracking a
      // vertical (z) height offset used only for rendering. The potion is
      // "in the air" and will not collide with enemies until it lands.
      p.arc.t += dt / p.arc.duration;
      const t = Math.min(1, p.arc.t);
      p.pos.x = p.arc.start.x + (p.arc.target.x - p.arc.start.x) * t;
      p.pos.y = p.arc.start.y + (p.arc.target.y - p.arc.start.y) * t;
      // sin-shaped arc peaks at t=0.5.
      p.arc.height = Math.sin(t * Math.PI) * p.arc.peakHeight;
      if (p.arc.t >= 1) {
        // Landed: explode at the aim point. Find nearest enemy for splash to
        // center on (optional) otherwise just use the target point.
        resolveImpact(state, p, p.arc.target);
        remove.push(i);
        continue;
      }
      // During flight the potion is still airborne — no mid-air hits.
      continue;
    }

    // Linear projectiles (towers).
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

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
      // Echo-explosion secondary blasts do not have an arc — they sit still
      // and just wait out their tiny life before detonating.
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
      resolveImpact(state, p, hit?.pos ?? p.pos);
      remove.push(i);
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.projectiles.splice(remove[i]!, 1);
}

function resolveImpact(state: GameState, p: Projectile, at: Vec2): void {
  if (p.kind === 'potion' && !p.echoExplosion) {
    // Potion glass-shatter on landing. Echo-secondary blasts deliberately
    // skip the SFX so the rate-limit stays kind to chained reactions.
    audio.playSfx('potionImpact');
  }
  // Did this potion actually land on top of (or touching) an enemy? The
  // tutorial fires its "manual aim bonus" hint only on the first such hit.
  if (p.kind === 'potion' && p.bonusFromManualAim) {
    const closest = nearestEnemy(state, at, Math.max(p.splashRadius, 14));
    if (closest) tutorial.notify('manualHit');
  }
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
    if (manualBonus && d < radius * 0.4) dmg *= 1.2 + state.metaPotionAimBonus;
    applyDamageToEnemy(state, e, dmg, element);
  }
}

export function applyDamageToEnemy(
  state: GameState,
  e: Enemy,
  rawDamage: number,
  element: Projectile['element'],
): void {
  // Difficulty abilities:
  // One-hit shield absorbs the first hit completely and breaks.
  if (e.shieldCharges > 0) {
    e.shieldCharges -= 1;
    e.hitFlash = 0.18;
    // Spawn a small visual cue via floating text so the player reads it.
    spawnFloatingText(state, t('floating.shieldHit'), e.pos, '#ffd166');
    return;
  }

  // Ethereal elite: immune while phased out.
  if (e.elite === 'ethereal' && e.etherealActive) {
    spawnFloatingText(state, t('floating.ethereal'), e.pos, '#8338ec');
    return;
  }

  // Base armor, plus homunculus phase 2+ stacks an extra 25% reduction.
  const baseArmor = e.kind.armor
    + (e.kind.id === 'boss_homunculus' && e.bossPhase >= 2 ? 0.25 : 0);
  const armor = baseArmor * e.status.armorBreakFactor;
  let dmg = Math.max(1, rawDamage * (1 - armor));

  // Armored elite: ×0.6 physical damage, aether unaffected.
  if (e.elite === 'armored' && element !== 'aether') {
    dmg *= 0.6;
  }
  // Fire-resistant elite: ×0.4 fire damage.
  if (e.elite === 'fire_resistant' && element === 'fire') {
    dmg *= 0.4;
  }
  // Re-apply minimum damage floor after elite multipliers.
  dmg = Math.max(1, dmg);

  // Engineering: +30% damage to burning enemies.
  if (state.modifiers.towerBonusVsBurning && e.status.burnTime > 0) {
    dmg *= 1.3;
  }

  e.hp -= dmg;
  e.hitFlash = 0.12;
  audio.playSfx('enemyHit', { detune: e.kind.isBoss ? 0.6 : 1 + (state.rng.range(-1, 1) * 0.05) });

  // Dash-back: on a successful hit push the enemy away from the hero for
  // a brief period so the projectile knocks them back slightly.
  if (e.abilities.includes('dash_back_on_hit')) {
    e.dashBackTimer = Math.max(e.dashBackTimer, 0.25);
  }

  // Check elemental reactions before applying new status (order matters).
  checkElementalReaction(state, e, element);

  // Apply elemental statuses.
  if (element === 'fire') {
    // Fire-resistant elite: immune to burn status.
    if (e.elite !== 'fire_resistant') {
      e.status.burnDps = Math.max(e.status.burnDps, 6 * state.modifiers.potionDamageMult);
      e.status.burnTime = Math.max(e.status.burnTime, 2.5);
    }
  } else if (element === 'mercury') {
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.55);
    e.status.slowTime = Math.max(e.status.slowTime, 2.5);
  } else if (element === 'acid') {
    e.status.armorBreakFactor = Math.min(e.status.armorBreakFactor, 0.5);
    e.status.armorBreakTime = Math.max(e.status.armorBreakTime, 4);
  } else if (element === 'aether') {
    e.status.aetherMarkTime = Math.max(e.status.aetherMarkTime, 3);
  } else if (element === 'frost') {
    // Frost: stronger slow than mercury but shorter, plus marks the enemy
    // as "chilled" so frost-based reactions can fire.
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.4);
    e.status.slowTime = Math.max(e.status.slowTime, 2.0);
    e.status.frostMarkTime = Math.max(e.status.frostMarkTime, 2.5);
  } else if (element === 'poison') {
    // Poison: armor-piercing DoT (handled in enemy update) — half DPS of
    // burn but double duration, and ignores armor.
    e.status.poisonDps = Math.max(e.status.poisonDps, 4 * state.modifiers.potionDamageMult);
    e.status.poisonTime = Math.max(e.status.poisonTime, 5.0);
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
