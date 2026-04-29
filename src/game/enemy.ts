import { dist, norm, sub, type Vec2 } from '../engine/math';
import type { Enemy, GameState } from './state';
import { newId, spawnFloatingText } from './state';
import { ENEMIES } from '../data/enemies';
import { spawnEnemy } from './wave';
import { applyDamageToEnemy } from './projectile';
import { audio } from '../audio/audio';
import { t } from '../i18n';
import { INGREDIENT_DROP_TABLE, INGREDIENTS, type IngredientId } from '../data/potions';
import { takenDamageMultiplier, goldMultiplier, absorbWithShield, enemySpeedMultiplier } from './potions';

export function updateEnemies(state: GameState, dt: number): void {
  const m = state.mannequin;
  const remove: number[] = [];

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i]!;

    // Status decay & damage over time.
    if (e.status.burnTime > 0) {
      e.status.burnTime -= dt;
      e.hp -= e.status.burnDps * dt;
      e.hitFlash = Math.max(e.hitFlash, 0.04);
    } else {
      e.status.burnDps = 0;
    }
    if (e.status.slowTime > 0) {
      e.status.slowTime -= dt;
    } else {
      e.status.slowFactor = 1;
    }
    if (e.status.armorBreakTime > 0) {
      e.status.armorBreakTime -= dt;
    } else {
      e.status.armorBreakFactor = 1;
    }
    if (e.status.aetherMarkTime > 0) {
      e.status.aetherMarkTime -= dt;
    }
    if (e.status.frostMarkTime > 0) {
      e.status.frostMarkTime -= dt;
    }
    if (e.status.poisonTime > 0) {
      e.status.poisonTime -= dt;
      // Poison ignores armour — apply DoT directly.
      e.hp -= e.status.poisonDps * dt;
      e.hitFlash = Math.max(e.hitFlash, 0.03);
    } else {
      e.status.poisonDps = 0;
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;

    // Dash-back: while this timer is >0 the enemy is pushed away from the
    // hero instead of toward them (brief knockback from the last hit).
    if (e.dashBackTimer > 0) {
      e.dashBackTimer -= dt;
    }

    // ── Elite modifier ticks ──
    // Regenerating: +5 HP/sec up to 50 % max HP.
    if (e.elite === 'regenerating' && e.hp < e.maxHp * 0.5) {
      e.hp = Math.min(e.maxHp * 0.5, e.hp + 5 * dt);
    }
    // Ethereal: cycle 4 s visible → 1 s immune.
    if (e.elite === 'ethereal') {
      e.etherealTimer -= dt;
      if (e.etherealTimer <= 0) {
        e.etherealActive = !e.etherealActive;
        e.etherealTimer = e.etherealActive ? 1 : 4;
      }
    }

    // --- Per-kind pre-move behaviours ---
    // Sapper: once it gets close enough to the mannequin, freeze in place and
    // tick a short fuse; explode radially when the fuse reaches zero.
    if (e.kind.id === 'sapper') {
      const d2m = dist(e.pos, m.pos);
      if (e.sapperFuse > 0 || d2m < e.kind.radius + 48) {
        if (e.sapperFuse <= 0) {
          e.sapperFuse = 0.55;
          spawnFloatingText(state, '!', e.pos, '#ff5a5a');
        }
        e.sapperFuse -= dt;
        // Pulse by flashing hitFlash so the sprite visibly blinks red.
        e.hitFlash = Math.max(e.hitFlash, 0.12);
        if (e.sapperFuse <= 0) {
          sapperDetonate(state, e);
          remove.push(i);
          continue;
        }
        // Frozen: don't run the normal move step this frame.
        continue;
      }
    }

    // Homunculus: phase transitions on HP thresholds and periodic minion summon.
    if (e.kind.id === 'boss_homunculus') {
      updateHomunculus(state, e, dt);
    }

    // Boss specials: tick cooldowns and run boss-kind specific behaviour.
    if (e.kind.isBoss) {
      if (e.bossSpecialCooldown > 0) e.bossSpecialCooldown -= dt;
      if (e.bossDodgeTimer > 0) e.bossDodgeTimer -= dt;
      if (e.bossSlamWindup > 0) {
        e.bossSlamWindup -= dt;
        e.hitFlash = Math.max(e.hitFlash, 0.18);
        if (e.bossSlamWindup <= 0) {
          minibossSlimeSlam(state, e);
        }
      }
      // Miniboss slime: trigger slam wind-up when ready.
      if (e.kind.id === 'miniboss_slime'
          && e.bossSpecialCooldown <= 0 && e.bossSlamWindup <= 0) {
        e.bossSlamWindup = 0.7;
        e.bossSpecialCooldown = 7;
        spawnFloatingText(state, '⚡', e.pos, '#ffd166');
      }
      // Homunculus: teleport in phases 2+, on cooldown.
      if (e.kind.id === 'boss_homunculus'
          && e.bossPhase >= 2 && e.bossSpecialCooldown <= 0) {
        homunculusTeleport(state, e);
        e.bossSpecialCooldown = 10;
      }
    }

    // Move: while dodging, follow the perpendicular dash direction;
    // while sapper-fused, freeze (handled above); otherwise toward the mannequin
    // (or away during a dash-back impulse).
    if (e.bossDodgeTimer > 0) {
      e.pos.x += e.bossDodgeDir.x * e.bossDodgeSpeed * dt;
      e.pos.y += e.bossDodgeDir.y * e.bossDodgeSpeed * dt;
    } else {
      // Miniboss slam wind-up freezes the boss in place for the wind-up window.
      if (e.bossSlamWindup > 0) {
        // Skip the regular movement step so the slam telegraphs cleanly.
      } else {
        const dir = norm(sub(m.pos, e.pos));
        const dashMult = e.dashBackTimer > 0 ? -0.6 : 1;
        // Homunculus phase 3 gets +50% speed.
        const phaseSpeedBoost = e.kind.id === 'boss_homunculus' && e.bossPhase >= 3 ? 1.5 : 1;
        // Frenzied elite: ×1.5 speed.
        const eliteSpeedMult = e.elite === 'frenzied' ? 1.5 : 1;
        const speed = e.kind.speed * e.status.slowFactor
          * state.difficultyModifier.speedMult * dashMult * phaseSpeedBoost * eliteSpeedMult
          * enemySpeedMultiplier(state);
        e.pos.x += dir.x * speed * dt;
        e.pos.y += dir.y * speed * dt;
      }
    }

    // Mercury ring: slow enemies near mannequin.
    if (state.modifiers.mercuryRingActive) {
      const dToM = dist(e.pos, m.pos);
      if (dToM < 120 * state.metaAuraRadiusMult) {
        e.status.slowFactor = Math.min(e.status.slowFactor, 0.6);
        e.status.slowTime = Math.max(e.status.slowTime, 0.2);
      }
    }

    // Hit mannequin.
    const d = dist(e.pos, m.pos);
    if (d < e.kind.radius + 22) {
      const scaledDamage = e.kind.damage * state.difficultyModifier.damageMult;
      const shieldMult = state.tempShieldTime > 0 ? (1 - state.tempShieldReduction) : 1;
      const rawDmg = Math.max(1, scaledDamage * (1 - state.metaMannequinArmor) * shieldMult * takenDamageMultiplier(state));
      const dmgReduced = absorbWithShield(state, rawDmg);
      m.hp -= dmgReduced;
      state.metaAutoRepairCooldown = 5;
      m.damageFlash = 0.25;
      spawnFloatingText(state, `-${Math.round(dmgReduced)}`, m.pos, '#ff6a3d');
      // Thorny shell: reflect damage on melee contact.
      if (state.modifiers.thornyShell) {
        e.hp -= 8;
        e.hitFlash = 0.12;
        if (e.hp <= 0) {
          onEnemyDeath(state, e);
        }
      }
      remove.push(i);
      continue;
    }

    if (e.hp <= 0) {
      onEnemyDeath(state, e);
      remove.push(i);
    }
  }

  for (let i = remove.length - 1; i >= 0; i--) state.enemies.splice(remove[i]!, 1);

  // Tick the temporary shield countdown while we're in the update loop.
  if (state.tempShieldTime > 0) {
    state.tempShieldTime = Math.max(0, state.tempShieldTime - dt);
  }

  // Mannequin death check.
  if (m.hp <= 0) {
    if (state.golemHeartCharges > 0) {
      // Golem Heart legendary: consume the charge to survive at 1 HP and grant
      // a strong 6-second shield while the player recovers.
      state.golemHeartCharges = 0;
      m.hp = 1;
      state.tempShieldTime = 6;
      state.tempShieldReduction = 0.8;
      m.damageFlash = 0.4;
      spawnFloatingText(state, t('floating.golemHeart'), m.pos, '#ffb86b');
    } else if (!state.reviveUsed) {
      m.hp = 0;
      state.revivePaused = true;
    } else {
      m.hp = 0;
      state.phase = 'gameover';
    }
  }
}

/** Sapper hit zero on its fuse — do big AoE damage and splash minions. */
function sapperDetonate(state: GameState, e: Enemy): void {
  const m = state.mannequin;
  const radius = 72;
  // Spawn a visible fire pool at the blast point for feedback.
  state.firePools.push({
    id: newId(state),
    pos: { x: e.pos.x, y: e.pos.y },
    radius: radius * 0.6,
    dps: 14,
    time: 1.2,
  });
  // Damage to mannequin.
  if (dist(m.pos, e.pos) < radius) {
    const scaled = e.kind.damage * state.difficultyModifier.damageMult;
    const shieldMult = state.tempShieldTime > 0 ? (1 - state.tempShieldReduction) : 1;
    const raw = Math.max(1, scaled * (1 - state.metaMannequinArmor) * shieldMult * takenDamageMultiplier(state));
    const dmg = absorbWithShield(state, raw);
    m.hp -= dmg;
    m.damageFlash = 0.3;
    state.metaAutoRepairCooldown = 5;
    spawnFloatingText(state, `-${Math.round(dmg)}`, m.pos, '#ff6a3d');
  }
  // Damage to nearby enemies.
  for (const other of state.enemies) {
    if (other.id === e.id) continue;
    if (dist(other.pos, e.pos) < radius) {
      applyDamageToEnemy(state, other, 10, 'fire');
    }
  }
  // Kill counter + currency (no gold drop here — sapper is a nuisance not a reward).
  state.totalKills += 1;
}

/**
 * Drive the 3-phase final boss. Phase transitions at 66% and 33% HP mark
 * visual state (sprite tint via hitFlash) and adjust mechanics. While
 * the boss is alive it periodically spawns minions (slimes/rats) at
 * its current location so the player always has chip-damage threats.
 */
function updateHomunculus(state: GameState, e: Enemy, dt: number): void {
  const hpRatio = e.hp / e.maxHp;
  const desiredPhase = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;
  if (desiredPhase > e.bossPhase) {
    e.bossPhase = desiredPhase;
    e.minionSummonTimer = 0.5;
    if (desiredPhase === 2) {
      spawnFloatingText(state, t('floating.armor'), e.pos, '#c9c9d8');
    } else if (desiredPhase === 3) {
      spawnFloatingText(state, t('floating.rage'), e.pos, '#ff6a3d');
    }
    e.hitFlash = 0.35;
  }

  // Tick the minion-summon timer. Phase 1 summons the fastest, phase 3 slowest
  // (the boss is already brutal from the speed buff).
  e.minionSummonTimer -= dt;
  if (e.minionSummonTimer <= 0) {
    const period = e.bossPhase === 1 ? 3 : e.bossPhase === 2 ? 3.5 : 4.5;
    e.minionSummonTimer = period;
    summonHomunculusMinions(state, e);
  }
}

function summonHomunculusMinions(state: GameState, e: Enemy): void {
  const phase = e.bossPhase;
  // Pool per phase: 1 spawns slimes, 2 spawns rats (kite), 3 spawns sappers (panic).
  const kindId =
    phase === 1 ? 'slime' :
    phase === 2 ? 'rat' :
    'sapper';
  const count = phase === 1 ? 3 : phase === 2 ? 4 : 2;
  const kind = ENEMIES[kindId];
  if (!kind) return;
  for (let i = 0; i < count; i++) {
    const angle = state.rng.range(0, Math.PI * 2);
    const r = 40 + state.rng.range(0, 24);
    const pos = {
      x: e.pos.x + Math.cos(angle) * r,
      y: e.pos.y + Math.sin(angle) * r,
    };
    spawnEnemy(state, kind, pos);
  }
  spawnFloatingText(state, t('floating.summon'), e.pos, '#c084fc');
}

/** Miniboss slime "slam": after a brief wind-up, deal AoE damage in a radius
 *  around the boss. Hurts the mannequin if it's within reach and lights a
 *  short fire pool for visual feedback. */
function minibossSlimeSlam(state: GameState, e: Enemy): void {
  const m = state.mannequin;
  const radius = 110;
  state.firePools.push({
    id: newId(state),
    pos: { x: e.pos.x, y: e.pos.y },
    radius: radius * 0.7,
    dps: 6,
    time: 0.8,
  });
  if (dist(m.pos, e.pos) < radius) {
    const scaled = e.kind.damage * state.difficultyModifier.damageMult * 0.6;
    const shieldMult = state.tempShieldTime > 0 ? (1 - state.tempShieldReduction) : 1;
    const raw = Math.max(1, scaled * (1 - state.metaMannequinArmor) * shieldMult * takenDamageMultiplier(state));
    const dmg = absorbWithShield(state, raw);
    m.hp -= dmg;
    m.damageFlash = 0.3;
    state.metaAutoRepairCooldown = 5;
    spawnFloatingText(state, `-${Math.round(dmg)}`, m.pos, '#ff6a3d');
  }
  spawnFloatingText(state, t('floating.slam'), e.pos, '#ffd166');
}

/** Homunculus teleport: jump to a point 220-260px from the mannequin in a
 *  random direction. Used in phase 2+ to keep the player honest about
 *  positioning. */
function homunculusTeleport(state: GameState, e: Enemy): void {
  const m = state.mannequin;
  const angle = state.rng.range(0, Math.PI * 2);
  const r = 220 + state.rng.range(0, 40);
  const nx = Math.max(40, Math.min(state.arena.width - 40, m.pos.x + Math.cos(angle) * r));
  const ny = Math.max(40, Math.min(state.arena.height - 40, m.pos.y + Math.sin(angle) * r));
  e.pos.x = nx;
  e.pos.y = ny;
  e.hitFlash = 0.25;
  spawnFloatingText(state, t('floating.teleport'), e.pos, '#c084fc');
}

/** Boss perpendicular dodge: triggered from `applyDamageToEnemy` when a boss
 *  with active-dodge ability takes damage and its cooldown is ready. */
export function tryBossDodge(state: GameState, e: Enemy): void {
  if (!e.kind.isBoss) return;
  // Only the rat-king and homunculus actively dodge — slime miniboss is bulky.
  if (e.kind.id !== 'boss_rat_king' && e.kind.id !== 'boss_homunculus') return;
  if (e.bossDodgeTimer > 0 || e.bossSpecialCooldown > 0) return;
  // Don't dodge above 80% HP (let the player learn the fight first).
  if (e.hp / e.maxHp > 0.8) return;
  const m = state.mannequin;
  const toMan = norm(sub(m.pos, e.pos));
  // Pick perpendicular direction: rotate +90° or -90° at random.
  const sign = state.rng.chance(0.5) ? 1 : -1;
  e.bossDodgeDir = { x: -toMan.y * sign, y: toMan.x * sign };
  e.bossDodgeTimer = 0.45;
  e.bossDodgeSpeed = 280;
  e.bossSpecialCooldown = e.kind.id === 'boss_rat_king' ? 4.5 : 6;
  spawnFloatingText(state, t('floating.dodge'), e.pos, '#9be3ff');
}

export function updateGoldPickups(state: GameState, dt: number): void {
  const m = state.mannequin;
  if (state.magnetTimer > 0) state.magnetTimer -= dt;
  const remove: number[] = [];
  for (let i = 0; i < state.goldPickups.length; i++) {
    const g = state.goldPickups[i]!;
    g.life -= dt;
    const d = dist(g.pos, m.pos);
    // All pickups are always attracted toward the hero automatically.
    const dir = norm(sub(m.pos, g.pos));
    const sp = 280 + Math.max(0, 600 - d) * 1.2;
    g.pos.x += dir.x * sp * dt;
    g.pos.y += dir.y * sp * dt;
    if (d < 18 || g.life <= 0) {
      if (d < 18) {
        state.gold += g.value;
        audio.playSfx('goldPickup');
      }
      remove.push(i);
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.goldPickups.splice(remove[i]!, 1);
}

export function updateFirePools(state: GameState, dt: number): void {
  const remove: number[] = [];
  for (let i = 0; i < state.firePools.length; i++) {
    const fp = state.firePools[i]!;
    fp.time -= dt;
    if (fp.time <= 0) { remove.push(i); continue; }
    for (const e of state.enemies) {
      if (e.elite === 'ethereal' && e.etherealActive) continue;
      const d = dist(fp.pos, e.pos);
      if (d <= fp.radius + e.kind.radius) {
        const fireMult = e.elite === 'fire_resistant' ? 0.4 : 1;
        e.hp -= fp.dps * dt * fireMult;
        e.hitFlash = Math.max(e.hitFlash, 0.04);
        if (e.elite !== 'fire_resistant') {
          e.status.burnDps = Math.max(e.status.burnDps, fp.dps * 0.5);
          e.status.burnTime = Math.max(e.status.burnTime, 1);
        }
      }
    }
  }
  for (let i = remove.length - 1; i >= 0; i--) state.firePools.splice(remove[i]!, 1);
}

export function updateFloatingTexts(state: GameState, dt: number): void {
  const remove: number[] = [];
  for (let i = 0; i < state.floatingTexts.length; i++) {
    const t = state.floatingTexts[i]!;
    t.life -= dt;
    t.pos.y += t.vy * dt;
    if (t.life <= 0) remove.push(i);
  }
  for (let i = remove.length - 1; i >= 0; i--) state.floatingTexts.splice(remove[i]!, 1);
}

export function addOverload(state: GameState, amount: number): void {
  const o = state.overload;
  o.charge = Math.min(o.maxCharge, o.charge + amount * state.metaOverloadRateMult);
}

/**
 * Common bookkeeping for an enemy that just died: gold drop, kill counter,
 * essence, overload charge, plus difficulty-driven on-death abilities
 * (slime split / explode-on-death).
 */
function onEnemyDeath(state: GameState, e: Enemy): void {
  audio.playSfx('enemyDeath', { detune: e.kind.isBoss ? 0.5 : 1 });
  const goldMult = state.modifiers.goldDropMult
    * state.difficultyModifier.goldMult
    * (state.transmuteTimer > 0 ? state.transmuteGoldMult : 1)
    * goldMultiplier(state);
  const value = Math.round(state.rng.range(e.kind.goldDrop[0], e.kind.goldDrop[1]) * goldMult);
  state.goldPickups.push({
    id: newId(state),
    pos: { x: e.pos.x + state.rng.range(-6, 6), y: e.pos.y + state.rng.range(-6, 6) },
    value,
    life: 12,
  });
  state.totalKills += 1;
  state.essence += e.kind.isBoss ? 3 : 1;
  addOverload(state, e.kind.isBoss ? 25 : 6);

  // Split-on-death: spawn N smaller slimes (2 the first generation, 1 the
  // second) at the death position. Offspring inherit abilities but cannot
  // split themselves beyond generation 2.
  if (e.abilities.includes('split_on_death') && e.splitGeneration < 2) {
    const count = e.splitGeneration === 0 ? 2 : 1;
    const slime = ENEMIES['slime'];
    if (slime) {
      for (let i = 0; i < count; i++) {
        const angle = state.rng.range(0, Math.PI * 2);
        const r = 14 + state.rng.range(0, 8);
        const pos = {
          x: e.pos.x + Math.cos(angle) * r,
          y: e.pos.y + Math.sin(angle) * r,
        };
        spawnEnemy(state, slime, pos, e.splitGeneration + 1);
      }
    }
  }

  // Explode-on-death: do a small fire-pool-less radial damage burst.
  if (e.abilities.includes('explode_on_death')) {
    const radius = 60;
    for (const other of state.enemies) {
      if (other.id === e.id) continue;
      if (dist(other.pos, e.pos) < radius) {
        applyDamageToEnemy(state, other, 6, 'fire');
      }
    }
    // Damage the hero too if close enough.
    if (dist(state.mannequin.pos, e.pos) < radius) {
      const raw = Math.max(1, 4 * state.difficultyModifier.damageMult * (1 - state.metaMannequinArmor) * takenDamageMultiplier(state));
      const dmg = absorbWithShield(state, raw);
      state.mannequin.hp -= dmg;
      state.mannequin.damageFlash = 0.22;
      spawnFloatingText(state, `-${Math.round(dmg)}`, state.mannequin.pos, '#ff6a3d');
    }
  }

  // Crafting ingredient drops. Split-on-death offspring are NOT eligible
  // (`splitGeneration > 0`) so a single packed slime wave can't flood the
  // economy with jelly.
  if (e.splitGeneration === 0) {
    rollIngredientDrop(state, e);
  }
}

function rollIngredientDrop(state: GameState, e: Enemy): void {
  for (const row of INGREDIENT_DROP_TABLE) {
    if (row.enemyId !== e.kind.id) continue;
    const amount = row.guaranteedAmount ?? (state.rng.chance(row.chance) ? 1 : 0);
    if (amount <= 0) continue;
    state.onIngredientDrop?.(row.ingredient, amount);
    const ing = INGREDIENTS[row.ingredient as IngredientId];
    spawnFloatingText(state, `+${amount} ${t(ing.i18nKey)}`, e.pos, ing.color);
    return;
  }
}

// Convenience used in projectile.ts via importVec2 reference.
export type _Vec2 = Vec2;
