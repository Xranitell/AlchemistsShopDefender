import type { GameState } from './state';
import { throwPotion } from './projectile';
import { tryActivateOverload } from './overload';

export function updateMannequin(state: GameState, dt: number): void {
  const m = state.mannequin;
  if (m.damageFlash > 0) m.damageFlash -= dt;
  if (m.throwAnim > 0) m.throwAnim -= dt;
  m.potionTimer -= dt;

  // Manual fire only — player must click to throw a potion. (No auto-aim.)
  if (state.manualFireRequested && m.potionTimer <= 0) {
    const aim = clampAim(state, state.aim);
    tickFireRuby(state);
    throwPotion(state, aim, /*manual*/ true);
    m.potionTimer = m.basePotionCooldown * state.modifiers.potionCooldownMult;
    // Face the throw and trigger the mid-throw pose briefly.
    const dx = aim.x - m.pos.x;
    const dy = aim.y - m.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    m.throwDir = { x: dx / len, y: dy / len };
    m.throwAnim = 0.22;
  }

  if (state.overloadRequested) {
    tryActivateOverload(state);
  }

  state.manualFireRequested = false;
  state.overloadRequested = false;
}

function tickFireRuby(state: GameState): void {
  if (state.modifiers.fireRubyCounter <= 0) return;
  state.modifiers.fireRubyCounter--;
  if (state.modifiers.fireRubyCounter <= 0) {
    state.modifiers.fireRubyActive = true;
    state.modifiers.fireRubyCounter = 5;
  } else {
    state.modifiers.fireRubyActive = false;
  }
}

function clampAim(state: GameState, aim: { x: number; y: number }) {
  return {
    x: Math.max(20, Math.min(state.arena.width - 20, aim.x)),
    y: Math.max(20, Math.min(state.arena.height - 20, aim.y)),
  };
}
