import { dist } from '../engine/math';
import type { GameState } from './state';
import { applyDamageToEnemy } from './projectile';
import { spawnFloatingText } from './state';

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

  if (state.modifiers.overloadType === 'lightning') {
    return runLightning(state);
  } else {
    return runChronos(state);
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
    spawnFloatingText(state, 'Громоотвод', state.mannequin.pos, '#7df9ff');
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
  spawnFloatingText(state, 'Громоотвод!', state.mannequin.pos, '#7df9ff');
  return true;
}

function runChronos(state: GameState): boolean {
  for (const e of state.enemies) {
    e.status.slowFactor = Math.min(e.status.slowFactor, 0.4);
    e.status.slowTime = Math.max(e.status.slowTime, CHRONOS_DURATION);
  }
  spawnFloatingText(state, 'Хронос!', state.mannequin.pos, '#c084fc');
  return true;
}
