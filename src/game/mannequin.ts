import { dist } from '../engine/math';
import type { GameState } from './state';
import { throwPotion } from './projectile';
import { tryActivateOverload } from './overload';

export function updateMannequin(state: GameState, dt: number): void {
  const m = state.mannequin;
  if (m.damageFlash > 0) m.damageFlash -= dt;
  m.potionTimer -= dt;

  // Manual fire (mouse/touch click). Manual aim grants centre-bonus damage.
  if (state.manualFireRequested && m.potionTimer <= 0) {
    const aim = clampAim(state, state.aim);
    throwPotion(state, aim, /*manual*/ true);
    m.potionTimer = m.basePotionCooldown * state.modifiers.potionCooldownMult;
  } else if (m.potionTimer <= 0 && state.enemies.length > 0) {
    // Auto fire at nearest enemy.
    const target = nearestEnemyTo(state);
    if (target) {
      throwPotion(state, target.pos, /*manual*/ false);
      m.potionTimer = m.basePotionCooldown * state.modifiers.potionCooldownMult;
    }
  }

  if (state.overloadRequested) {
    tryActivateOverload(state);
  }

  state.manualFireRequested = false;
  state.overloadRequested = false;
}

function nearestEnemyTo(state: GameState) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = dist(e.pos, state.mannequin.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function clampAim(state: GameState, aim: { x: number; y: number }) {
  // Clamp aim inside arena to avoid throws to outside.
  return {
    x: Math.max(20, Math.min(state.arena.width - 20, aim.x)),
    y: Math.max(20, Math.min(state.arena.height - 20, aim.y)),
  };
}
