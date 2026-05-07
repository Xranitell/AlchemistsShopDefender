import { dist, norm, scale, sub, type Vec2 } from '../engine/math';
import type { Enemy, GameState, Projectile } from './state';
import { newId, spawnFloatingText } from './state';
import { checkElementalReaction } from './reactions';
import { tryBossDodge } from './enemy';
import type { Element } from './types';
import { audio } from '../audio/audio';
import { tutorial } from '../ui/tutorial';
import { t } from '../i18n';
import { shakeCamera } from '../engine/shake';
import {
  potionDamageMultiplier,
  consumeStormCharge,
} from './potions';
import { MANNEQUIN_IDLE_ANIM } from '../render/creatureAnims';

/** Frost is a "finisher" element: it never one-shots a healthy target.
 *  If a frost hit would drop an enemy below this fraction of max HP, the
 *  damage is clamped at the threshold; only a *follow-up* frost hit on
 *  an already-weakened (<25 % HP) target executes them outright. Bosses
 *  are exempt to keep phase transitions intact. */
const FROST_EXECUTE_THRESHOLD = 0.25;

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

/** Lobs a mortar shell on a parabolic arc toward the target's current
 *  position. The shell behaves like a thrown potion: it cannot be
 *  intercepted in flight, lands at the predicted point, and detonates
 *  with a flask-style shockwave + a burning fire-pool. Used exclusively
 *  by the mortar tower so its silhouette / impact reads as siege
 *  artillery instead of a sniper rifle. */
export function fireMortarShell(
  state: GameState,
  fromPos: Vec2,
  target: Enemy,
  damage: number,
  splash: number,
  element: Projectile['element'],
): void {
  // Mortars fire at the target's *current* position. The 140-px splash
  // is wide enough that a moving target still lands inside the blast,
  // so a clean point shot reads as siege artillery instead of a guided
  // missile chasing the enemy through the air.
  const ts: Vec2 = { ...target.pos };
  const d = dist(fromPos, ts);
  // Scale flight time with distance — short shots feel snappy, long
  // shots have the satisfying "wait for it" siege beat.
  const duration = Math.min(1.1, Math.max(0.55, d / 700));
  // Tall arc: mortar shells fly higher than thrown flasks so the shadow
  // sweeps across the floor.
  const peakHeight = Math.min(170, 80 + d * 0.18);
  state.projectiles.push({
    id: newId(state),
    kind: 'tower',
    pos: { ...fromPos },
    vel: { x: 0, y: 0 },
    damage,
    splashRadius: splash,
    targetId: target.id,
    element,
    life: duration + 0.1,
    // Mortar fire is the iconic burning pool drop — every shell leaves
    // one even without the Flammable Mix modifier.
    leaveFire: true,
    echoExplosion: false,
    bonusFromManualAim: false,
    arc: { start: { ...fromPos }, target: ts, t: 0, duration, peakHeight, height: 0 },
  });
  audio.playSfx('towerFire', { detune: 0.7 });
}

export function throwPotion(
  state: GameState,
  to: Vec2,
  manual: boolean,
): void {
  const m = state.mannequin;
  const stormMult = consumeStormCharge(state);
  const damage = m.basePotionDamage * state.modifiers.potionDamageMult
    * potionDamageMultiplier(state) * stormMult;
  const radius = m.basePotionRadius * state.modifiers.potionRadiusMult;

  // Parabolic arc: potion follows a ballistic curve from the alchemist to the
  // aim point, landing in `duration` seconds. Flight time scales mildly with
  // distance so short tosses feel snappy and long ones feel hefty.
  //
  // Launch the flask from the mannequin's chest (≈ half the rendered
  // sprite height above the feet anchor) instead of straight from the
  // ground, so the throw visually leaves from the hand rather than
  // teleporting up out of the floor.
  const mannequinDisplayHeight = MANNEQUIN_IDLE_ANIM.sh * MANNEQUIN_IDLE_ANIM.scale;
  const start: Vec2 = { x: m.pos.x, y: m.pos.y - mannequinDisplayHeight / 2 };
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
  // Build an enemy id → enemy lookup once per frame. Tower projectiles each
  // need to resolve `targetId` and the previous code did `state.enemies.find`
  // per projectile per frame (O(P×E)). With many projectiles in flight this
  // dominated the update phase on weaker devices.
  let enemyById: Map<number, Enemy> | null = null;
  for (let i = 0; i < state.projectiles.length; i++) {
    if (state.projectiles[i]!.kind === 'tower' && state.projectiles[i]!.targetId !== null) {
      enemyById = new Map();
      for (const e of state.enemies) enemyById.set(e.id, e);
      break;
    }
  }

  const remove: number[] = [];
  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i]!;
    p.life -= dt;

    let hit: Enemy | null = null;

    if (p.arc) {
      // Parabolic flight (potions and mortar shells): interpolate along
      // the ground plane while tracking a vertical (z) height offset
      // used only for rendering. The projectile is "in the air" and
      // will not collide with enemies until it lands at `t === 1`.
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
      // During flight the projectile is airborne — no mid-air hits.
      continue;
    }

    // Linear projectiles (towers).
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    if (p.kind === 'tower') {
      // Track target if alive (O(1) lookup via cached map).
      if (p.targetId !== null && enemyById) {
        const target = enemyById.get(p.targetId);
        if (target) {
          const dx = p.pos.x - target.pos.x;
          const dy = p.pos.y - target.pos.y;
          const r = target.kind.radius + 6;
          if (dx * dx + dy * dy < r * r) hit = target;
        }
      }
      // Fall back: any enemy within range (handles homing+death).
      if (!hit) {
        for (const e of state.enemies) {
          const dx = e.pos.x - p.pos.x;
          const dy = e.pos.y - p.pos.y;
          const r = e.kind.radius + 4;
          if (dx * dx + dy * dy < r * r) { hit = e; break; }
        }
      }
    } else if (p.kind === 'potion') {
      // Echo-explosion secondary blasts do not have an arc — they sit still
      // and just wait out their tiny life before detonating.
      for (const e of state.enemies) {
        const dx = e.pos.x - p.pos.x;
        const dy = e.pos.y - p.pos.y;
        const r = e.kind.radius + 6;
        if (dx * dx + dy * dy < r * r) { hit = e; break; }
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

  // Tick the potion-impact shockwave VFX (visual-only; damage was
  // already resolved at spawn time inside `resolveImpact`). Ringed
  // entries that have run out of life are spliced out so the array
  // stays bounded.
  for (let i = state.potionBlasts.length - 1; i >= 0; i--) {
    const b = state.potionBlasts[i]!;
    b.time -= dt;
    if (b.time <= 0) state.potionBlasts.splice(i, 1);
  }
}

function resolveImpact(state: GameState, p: Projectile, at: Vec2): void {
  // Mortar shells use the parabolic-arc pipeline, so we treat any
  // arc-tagged tower projectile as a "siege impact" — same flask-style
  // shockwave, glass-shatter SFX and camera shake as a thrown potion.
  // Linear tower projectiles (needler, acid, mercury) keep the
  // muzzle-flash-only behaviour.
  const isMortarShell = p.kind === 'tower' && !!p.arc;
  if ((p.kind === 'potion' || isMortarShell) && !p.echoExplosion) {
    // Potion / mortar glass-shatter on landing. Echo-secondary blasts
    // deliberately skip the SFX so the rate-limit stays kind to
    // chained reactions.
    audio.playSfx('potionImpact');
  }
  // Spawn the impact-shockwave VFX so the player can see the splash
  // zone the area-damage check actually used. Potions and mortar shells
  // both get a ring; linear tower projectiles (needler, acid) skip it
  // because they have no splash radius and a 0-radius ring would just
  // be a flash on top of the existing muzzle-flash sparkles.
  if ((p.kind === 'potion' || isMortarShell) && p.splashRadius > 0) {
    state.potionBlasts.push({
      id: newId(state),
      pos: { x: at.x, y: at.y },
      radius: p.splashRadius,
      time: 0.5,
      maxTime: 0.5,
      element: p.element,
      echo: !!p.echoExplosion,
    });
  }
  // Camera shake for splash impacts: scaled by splash radius so a wide
  // potion explosion / mortar shell shakes harder than a single-target
  // needler. Linear tower projectiles still skip the shake — they fire
  // on every cooldown and constant shake reads as jitter rather than
  // weight. Echo secondaries from the player's own potions get a
  // softer kick to avoid double-thump on chain reactions.
  if (p.splashRadius > 0 && (p.kind === 'potion' || isMortarShell)) {
    const base = Math.min(5, 1.5 + p.splashRadius / 40);
    const mag = p.echoExplosion ? base * 0.5 : base;
    shakeCamera(mag, 0.16);
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

  if (p.leaveFire && (p.kind === 'potion' || isMortarShell)) {
    // Potion fire pools scale with the brewing-mult so flammable-mix
    // potions hit harder; mortar shells are siege weapons and get a
    // flat baseline DPS (independent of the player's potion stats) so
    // their pool reads as the *tower's* contribution rather than the
    // alchemist's. Slightly tighter radius than the splash so the
    // visual fire fits inside the shockwave ring.
    const dps = p.kind === 'potion'
      ? 8 * state.modifiers.potionDamageMult
      : 6;
    const time = isMortarShell ? 2.4 : 3.0;
    state.firePools.push({
      id: newId(state),
      pos: { ...at },
      radius: p.splashRadius * 0.85,
      dps,
      time,
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
  let bestD2 = maxDistance * maxDistance;
  for (const e of state.enemies) {
    const dx = at.x - e.pos.x;
    const dy = at.y - e.pos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = e; }
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
    const dx = at.x - e.pos.x;
    const dy = at.y - e.pos.y;
    const d2 = dx * dx + dy * dy;
    const outerR = radius + e.kind.radius;
    if (d2 > outerR * outerR) continue;
    let dmg = damage;
    if (manualBonus) {
      const innerR = radius * 0.4;
      if (d2 < innerR * innerR) dmg *= 1.2 + state.metaPotionAimBonus;
    }
    applyDamageToEnemy(state, e, dmg, element);
  }
}

export function applyDamageToEnemy(
  state: GameState,
  e: Enemy,
  rawDamage: number,
  element: Projectile['element'],
): void {
  // Cursed-extra: dodge roll. Non-boss enemies get a per-hit chance to
  // fully evade the projectile. The chance is hard-capped so the player
  // can never softlock from too many stacked dodge extras.
  if (
    !e.kind.isBoss
    && state.modifiers.enemyDodgeChance > 0
    && state.rng.chance(Math.min(0.6, state.modifiers.enemyDodgeChance))
  ) {
    e.hitFlash = 0.08;
    spawnFloatingText(state, t('floating.dodge'), e.pos, '#a0c4ff');
    return;
  }

  // Difficulty abilities:
  // One-hit shield absorbs the first hit completely and breaks. Epic /
  // Ancient golems regenerate the shield after a short delay (8s on
  // Epic, 6s on Ancient) so a single AoE clear no longer disables them
  // for the rest of the wave.
  if (e.shieldCharges > 0) {
    e.shieldCharges -= 1;
    e.hitFlash = 0.18;
    if (e.abilities.includes('one_hit_shield') && e.abilityTier !== 'base') {
      const regenDelay = e.abilityTier === 'ancient' ? 6 : 8;
      // Only queue a regen if there isn't one already running, so
      // chaining hits while a regen is queued doesn't keep deferring it.
      if (e.shieldRegenTimer <= 0) e.shieldRegenTimer = regenDelay;
    }
    // Spawn a small visual cue via floating text so the player reads it.
    spawnFloatingText(state, t('floating.shieldHit'), e.pos, '#ffd166');
    return;
  }

  // Ethereal elite: immune while phased out.
  if (e.elite === 'ethereal' && e.etherealActive) {
    spawnFloatingText(state, t('floating.ethereal'), e.pos, '#8338ec');
    return;
  }

  // Base armor, plus homunculus phase 2+ stacks an extra 25% reduction
  // and any cursed-extra global armour bump. The total is clamped to
  // [0, 0.95] so the floor ensures damage still ticks through.
  const baseArmor = e.kind.armor
    + (e.kind.id === 'boss_homunculus' && e.bossPhase >= 2 ? 0.25 : 0)
    + state.modifiers.enemyArmorAdd;
  // Meta armour penetration scales the effective armour value down.
  const armor = Math.min(0.95,
    baseArmor * e.status.armorBreakFactor * (1 - state.metaArmorPen));
  let dmg = Math.max(1, rawDamage * (1 - armor));

  // Meta crit chance: doubled damage on a successful roll.
  if (state.metaCritChance > 0 && state.rng.chance(state.metaCritChance)) {
    dmg *= 2;
    // Crit indicator: render as the gold-sparkle 'crit' variant. The
    // damage number itself isn't shown (towers fire too fast for that
    // to be readable), but the crit tag pops up above the enemy so
    // the player gets a clear "yes that hit harder" beat.
    spawnFloatingText(state, t('floating.crit'), e.pos, '#ffe17a', 'crit');
  }

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

  // Cursed-extra: bonus shield soaks damage before it spills over to HP.
  // Damage that fully drains the shield bleeds the remainder into HP so
  // the hit still registers.
  if (e.extraShield > 0) {
    const absorbed = Math.min(e.extraShield, dmg);
    e.extraShield -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) {
      e.hitFlash = 0.10;
      audio.playSfx('enemyHit', { detune: 1.2 });
      return;
    }
  }

  // Frost finisher rule: the ice flask never one-shots a healthy target.
  // If pre-hit HP is already below the execute threshold, frost shatters
  // the enemy outright; otherwise damage is clamped so frost can never
  // bring HP below the threshold in a single tick. Bosses are exempt so
  // their phase transitions stay intact.
  let frostExecute = false;
  if (element === 'frost' && !e.kind.isBoss) {
    const executeThreshold = e.maxHp * FROST_EXECUTE_THRESHOLD;
    if (e.hp <= executeThreshold) {
      frostExecute = true;
    } else {
      dmg = Math.min(dmg, e.hp - executeThreshold);
    }
  }

  e.hp -= dmg;
  if (frostExecute) e.hp = 0;
  e.hitFlash = 0.12;
  // Stamp the element so on-death attribution (run contracts) can count
  // this hit's element as the killing blow if hp reaches 0 below.
  e.lastHitElement = element;
  audio.playSfx('enemyHit', { detune: e.kind.isBoss ? 0.6 : 1 + (state.rng.range(-1, 1) * 0.05) });
  // Boss-hit camera shake: each non-killing boss hit gets a small kick so
  // the player physically feels they're chipping a chunky enemy. Boss
  // *deaths* (a much bigger shake) are triggered separately in
  // `onEnemyDeath` to avoid double-shaking the kill frame.
  if (e.kind.isBoss && e.hp > 0) {
    shakeCamera(2.5, 0.1);
  }

  // Dash-back: on a successful hit push the enemy away from the hero
  // for a brief period so the projectile knocks them back slightly.
  // Tier scales how long the kite lasts — Epic doubles the impulse,
  // Ancient stretches it further so rats become very hard to chain.
  if (e.abilities.includes('dash_back_on_hit')) {
    const dashDuration =
      e.abilityTier === 'epic' ? 0.45 : e.abilityTier === 'ancient' ? 0.65 : 0.25;
    e.dashBackTimer = Math.max(e.dashBackTimer, dashDuration);
  }

  // Boss perpendicular dodge: triggered on hits when ready.
  if (e.kind.isBoss) {
    tryBossDodge(state, e);
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
