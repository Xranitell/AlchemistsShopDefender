import { dist } from '../engine/math';
import type { GameState } from './state';
import { applyDamageToEnemy } from './projectile';
import { spawnFloatingText } from './state';
import { audio } from '../audio/audio';
import { tutorial } from '../ui/tutorial';
import { t } from '../i18n';
import {
  ALCH_DOME_DURATION,
  ALCH_DOME_REDUCTION,
  TRANSMUTE_DURATION,
  TRANSMUTE_GOLD_MULT,
  FROST_NOVA_DURATION,
  VORTEX_RADIUS,
  VORTEX_DAMAGE,
  VORTEX_PULL_FORCE,
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

  switch (state.activeModuleId) {
    case 'chronos':
      return runChronos(state);
    case 'transmute':
      return runTransmute(state);
    case 'alch_dome':
      return runAlchDome(state);
    case 'frost_nova':
      return runFrostNova(state);
    case 'vortex':
      return runVortex(state);
    case 'lightning':
    default:
      return runLightning(state);
  }
}

/** Tick down active-module timers (transmute, etc). Called once per frame
 *  from the main update loop. */
export function tickModuleTimers(state: GameState, dt: number): void {
  if (state.transmuteTimer > 0) {
    state.transmuteTimer = Math.max(0, state.transmuteTimer - dt);
    if (state.transmuteTimer === 0) state.transmuteGoldMult = 1;
  }
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

function runTransmute(state: GameState): boolean {
  state.transmuteTimer = Math.max(state.transmuteTimer, TRANSMUTE_DURATION);
  state.transmuteGoldMult = Math.max(state.transmuteGoldMult, TRANSMUTE_GOLD_MULT);
  spawnFloatingText(state, t('floating.transmute'), state.mannequin.pos, '#ffd166');
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
