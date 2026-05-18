import { dist } from '../engine/math';
import type { GameState, Enemy } from './state';
import { applyDamageToEnemy } from './projectile';
import { spawnFloatingText } from './state';
import { audio } from '../audio/audio';
import { tutorial } from '../ui/tutorial';
import { t } from '../i18n';
import { shakeCamera } from '../engine/shake';
import {
  ALCH_DOME_DURATION,
  ALCH_DOME_REDUCTION,
  FROST_NOVA_DURATION,
  VORTEX_RADIUS,
  VORTEX_DAMAGE,
  VORTEX_PULL_FORCE,
  METEOR_COUNT,
  METEOR_DAMAGE,
  METEOR_RADIUS,
  METEOR_INTERVAL,
  DEATH_MARK_COUNT,
  DEATH_MARK_DELAY,
  DEATH_MARK_RADIUS,
  DEATH_MARK_HP_FRACTION,
  PRISM_BURN_DPS,
  PRISM_BURN_TIME,
  PRISM_FROST_TIME,
  PRISM_AETHER_TIME,
} from '../data/modules';

const LIGHTNING_TARGETS = 6;
const LIGHTNING_RANGE = 380;
const LIGHTNING_DAMAGE = 40;
const CHRONOS_DURATION = 5;

export interface OverloadEffect {
  /** Lightning chain target positions, used for VFX. */
  lightningChain: { x: number; y: number }[];
  age: number;
}

let activeEffect: OverloadEffect | null = null;

export function getActiveEffect(): OverloadEffect | null { return activeEffect; }

export function tickOverloadEffect(dt: number): void {
  if (!activeEffect) return;
  activeEffect.age += dt;
  if (activeEffect.age > 0.45) activeEffect = null;
}

export function tryActivateOverload(state: GameState): boolean {
  const o = state.overload;
  if (o.charge < o.maxCharge) return false;
  o.charge = 0;
  audio.playSfx('overloadActivate');
  tutorial.notify('overloadActivated');
  // Big satisfying kick on overload — this is the player's "big button".
  shakeCamera(6, 0.28);

  switch (state.activeModuleId) {
    case 'chronos':
      return runChronos(state);
    case 'alch_dome':
      return runAlchDome(state);
    case 'frost_nova':
      return runFrostNova(state);
    case 'vortex':
      return runVortex(state);
    case 'meteor_shower':
      return runMeteorShower(state);
    case 'death_mark':
      return runDeathMark(state);
    case 'element_prism':
      return runElementPrism(state);
    case 'lightning':
    default:
      return runLightning(state);
  }
}

/** Tick down active-module timers (death marks, meteor impacts). Called
 *  once per frame from the main update loop. */
export function tickModuleTimers(state: GameState, dt: number): void {
  tickMeteorImpacts(state, dt);
  tickDeathMarks(state, dt);
}

function runLightning(state: GameState): boolean {
  // Pick up to N nearest enemies within range, prioritising bosses.
  const candidates = state.enemies
    .map((e) => ({ e, d: dist(e.pos, state.mannequin.pos) }))
    .filter((x) => x.d <= LIGHTNING_RANGE)
    .sort((a, b) => {
      const aBoss = a.e.kind.isBoss ? 1 : 0;
      const bBoss = b.e.kind.isBoss ? 1 : 0;
      if (aBoss !== bBoss) return bBoss - aBoss;
      return a.d - b.d;
    })
    .slice(0, LIGHTNING_TARGETS);

  if (candidates.length === 0) {
    spawnFloatingText(state, t('floating.lightning'), state.mannequin.pos, '#7df9ff');
    return true;
  }

  for (const c of candidates) {
    applyDamageToEnemy(state, c.e, LIGHTNING_DAMAGE, 'aether');
  }
  activeEffect = {
    lightningChain: [
      { ...state.mannequin.pos },
      ...candidates.map((c) => ({ ...c.e.pos })),
    ],
    age: 0,
  };
  spawnFloatingText(state, t('floating.lightning.ex'), state.mannequin.pos, '#7df9ff');
  return true;
}

function runChronos(state: GameState): boolean {
  for (const e of state.enemies) {
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.4);
    e.status.slowTime = Math.max(e.status.slowTime, CHRONOS_DURATION);
  }
  spawnFloatingText(state, t('floating.chronos'), state.mannequin.pos, '#c084fc');
  return true;
}

function runAlchDome(state: GameState): boolean {
  // Layered with the regular shield system: pick whichever is stronger.
  state.tempShieldTime = Math.max(state.tempShieldTime, ALCH_DOME_DURATION);
  state.tempShieldReduction = Math.max(state.tempShieldReduction, ALCH_DOME_REDUCTION);
  spawnFloatingText(state, t('floating.alch_dome'), state.mannequin.pos, '#7df9ff');
  return true;
}

function runFrostNova(state: GameState): boolean {
  // Full freeze: drop slowFactor to 0 so the enemy can't move at all and
  // refresh the slow timer to the nova duration. Existing freezes always
  // win against a partial Chronos so the player's burst combo is intact.
  for (const e of state.enemies) {
    e.status.slowFactor = 0;
    e.status.slowTime = Math.max(e.status.slowTime, FROST_NOVA_DURATION);
    e.status.frostMarkTime = Math.max(e.status.frostMarkTime, FROST_NOVA_DURATION);
  }
  spawnFloatingText(state, t('floating.frost_nova'), state.mannequin.pos, '#7ec8ff');
  return true;
}

function runVortex(state: GameState): boolean {
  // Pull every enemy in radius toward the mannequin and deal a single AoE
  // pulse. Damage is applied first so even fragile enemies that get yanked
  // through the centre still take the hit.
  const m = state.mannequin.pos;
  for (const e of state.enemies) {
    const d = dist(e.pos, m);
    if (d > VORTEX_RADIUS) continue;
    applyDamageToEnemy(state, e, VORTEX_DAMAGE, 'aether');
    if (d > 1) {
      // Yank the enemy a fraction of its radial distance toward us. The
      // pull caps at half the radius so distant enemies don't snap onto
      // the hero's hitbox.
      const pull = Math.min(VORTEX_PULL_FORCE, d * 0.6);
      e.pos.x += ((m.x - e.pos.x) / d) * pull;
      e.pos.y += ((m.y - e.pos.y) / d) * pull;
    }
  }
  spawnFloatingText(state, t('floating.vortex'), state.mannequin.pos, '#a78bfa');
  return true;
}

/** Star Fall / Звездопад — drop METEOR_COUNT meteors on the densest enemy
 *  clusters. Cluster scoring is "how many enemies are within METEOR_RADIUS
 *  of this candidate"; ties break by total HP so heavy stacks are
 *  prioritised. Meteors are *queued*, not detonated immediately, so the
 *  staggered impacts read as a meteor shower instead of a single AoE
 *  flash. Each meteor lands after `METEOR_INTERVAL * i` seconds. */
function runMeteorShower(state: GameState): boolean {
  if (state.enemies.length === 0) {
    spawnFloatingText(state, t('floating.meteor_shower'), state.mannequin.pos, '#ff8855');
    return true;
  }
  // Score every enemy as a potential meteor target by how many other
  // enemies sit inside the splash. This intentionally re-uses each
  // enemy's current position as the candidate centre — works well even
  // when packs split into two groups, because the densest enemy in each
  // pack scores highest within its own group.
  type Candidate = { pos: { x: number; y: number }; score: number; hp: number };
  const cands: Candidate[] = state.enemies.map((e) => {
    let score = 0;
    let hpSum = 0;
    for (const other of state.enemies) {
      if (dist(e.pos, other.pos) <= METEOR_RADIUS) {
        score += 1;
        hpSum += other.hp;
      }
    }
    return { pos: { x: e.pos.x, y: e.pos.y }, score, hp: hpSum };
  });
  // Greedy non-maximum suppression: pick the highest-score candidate,
  // remove every other candidate inside its splash, then repeat. This
  // keeps meteors from stacking on top of each other.
  const picks: Candidate[] = [];
  while (picks.length < METEOR_COUNT && cands.length > 0) {
    cands.sort((a, b) => (b.score - a.score) || (b.hp - a.hp));
    const best = cands.shift();
    if (!best) break;
    picks.push(best);
    for (let i = cands.length - 1; i >= 0; i--) {
      if (dist(cands[i]!.pos, best.pos) <= METEOR_RADIUS * 0.8) cands.splice(i, 1);
    }
  }
  // If the pack is small and we couldn't find enough distinct clusters,
  // top up with random offsets near the mannequin so the player still
  // sees the full visual flourish.
  while (picks.length < METEOR_COUNT) {
    const a = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 240;
    picks.push({
      pos: {
        x: state.mannequin.pos.x + Math.cos(a) * r,
        y: state.mannequin.pos.y + Math.sin(a) * r,
      },
      score: 0,
      hp: 0,
    });
  }
  for (let i = 0; i < picks.length; i++) {
    const delay = i * METEOR_INTERVAL;
    state.meteorImpacts.push({
      id: state.nextEntityId++,
      pos: picks[i]!.pos,
      delay,
      damage: METEOR_DAMAGE,
      radius: METEOR_RADIUS,
      total: delay,
    });
  }
  spawnFloatingText(state, t('floating.meteor_shower'), state.mannequin.pos, '#ff8855');
  return true;
}

/** Detonate any meteor whose fuse has elapsed and prune it from the list.
 *  Called once per frame from `tickModuleTimers`. */
function tickMeteorImpacts(state: GameState, dt: number): void {
  if (state.meteorImpacts.length === 0) return;
  const survivors: typeof state.meteorImpacts = [];
  for (const m of state.meteorImpacts) {
    m.delay -= dt;
    if (m.delay > 0) {
      survivors.push(m);
      continue;
    }
    audio.playSfx('overloadActivate', { detune: 0.6 });
    shakeCamera(3, 0.18);
    for (const e of state.enemies) {
      if (dist(e.pos, m.pos) <= m.radius) {
        applyDamageToEnemy(state, e, m.damage, 'fire');
        // Light burn from the meteor itself so towers' burning-bonus
        // riders still kick in for a tick after the explosion.
        e.status.burnDps = Math.max(e.status.burnDps, 12);
        e.status.burnTime = Math.max(e.status.burnTime, 1.5);
      }
    }
    spawnFloatingText(state, t('floating.meteor_impact'), m.pos, '#ffb060');
  }
  state.meteorImpacts = survivors;
}

/** Death Mark / Метка смерти — pick the strongest non-bosses (by current
 *  HP), tag them with a fuse, and detonate after DEATH_MARK_DELAY for AoE
 *  damage equal to a fraction of the marked enemy's *current* HP. Bosses
 *  are excluded so this can't trivialise them, but the AoE ring still
 *  damages bosses caught inside it from a regular enemy detonation. */
function runDeathMark(state: GameState): boolean {
  const candidates = state.enemies
    .filter((e) => !e.kind.isBoss)
    .sort((a, b) => b.hp - a.hp)
    .slice(0, DEATH_MARK_COUNT);
  if (candidates.length === 0) {
    spawnFloatingText(state, t('floating.death_mark'), state.mannequin.pos, '#ff5577');
    return true;
  }
  for (const e of candidates) {
    state.deathMarks.push({
      id: state.nextEntityId++,
      enemyId: e.id,
      delay: DEATH_MARK_DELAY,
      pos: { x: e.pos.x, y: e.pos.y },
      age: 0,
    });
  }
  spawnFloatingText(state, t('floating.death_mark'), state.mannequin.pos, '#ff5577');
  return true;
}

/** Detonate any Death Mark whose fuse elapsed. The marked enemy itself
 *  takes 100% of the calculated damage (so even tanky stragglers get the
 *  full hit), and every other enemy inside DEATH_MARK_RADIUS takes the
 *  computed AoE damage. If the marked enemy died early, we still
 *  detonate at the cached pos so the player gets the visible payoff. */
function tickDeathMarks(state: GameState, dt: number): void {
  if (state.deathMarks.length === 0) return;
  const survivors: typeof state.deathMarks = [];
  for (const dm of state.deathMarks) {
    dm.age += dt;
    dm.delay -= dt;
    // Track the marked enemy's current pos while it's still alive — once
    // it dies we keep the cached pos for the explosion.
    const target: Enemy | undefined = state.enemies.find((e) => e.id === dm.enemyId);
    if (target) {
      dm.pos.x = target.pos.x;
      dm.pos.y = target.pos.y;
    }
    if (dm.delay > 0) {
      survivors.push(dm);
      continue;
    }
    audio.playSfx('overloadActivate', { detune: 1.4 });
    shakeCamera(4, 0.2);
    const baseHp = target ? target.hp : 50;
    const damage = baseHp * DEATH_MARK_HP_FRACTION;
    if (target) applyDamageToEnemy(state, target, damage, 'aether');
    for (const e of state.enemies) {
      if (e === target) continue;
      if (dist(e.pos, dm.pos) <= DEATH_MARK_RADIUS) {
        applyDamageToEnemy(state, e, damage, 'aether');
      }
    }
    spawnFloatingText(state, t('floating.death_mark.detonate'), dm.pos, '#ff5577');
  }
  state.deathMarks = survivors;
}

/** Element Prism / Призма стихий — slap burn + frost mark + aether mark
 *  on every enemy at once. The reaction system (game/reactions.ts) picks
 *  up the existing marks and chains additional damage as enemies move /
 *  take hits over the next few seconds, so the prism's value scales with
 *  how packed the field is. No flat damage is applied — the *reactions*
 *  do the work, which is what makes this overload feel different from
 *  the other AoE bursts. */
function runElementPrism(state: GameState): boolean {
  for (const e of state.enemies) {
    e.status.burnDps = Math.max(e.status.burnDps, PRISM_BURN_DPS);
    e.status.burnTime = Math.max(e.status.burnTime, PRISM_BURN_TIME);
    e.status.frostMarkTime = Math.max(e.status.frostMarkTime, PRISM_FROST_TIME);
    e.status.aetherMarkTime = Math.max(e.status.aetherMarkTime, PRISM_AETHER_TIME);
  }
  spawnFloatingText(state, t('floating.element_prism'), state.mannequin.pos, '#a78bfa');
  return true;
}
