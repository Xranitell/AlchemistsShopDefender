import { dist } from '../engine/math';
import type { GameState, Enemy } from './state';
import { spawnFloatingText } from './state';
import { throwPotion } from './projectile';
import { tryActivateOverload } from './overload';
import { audio } from '../audio/audio';
import { tutorial } from '../ui/tutorial';
import { potionCooldownMultiplier } from './potions';

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
    audio.playSfx('throwPotion');
    tutorial.notify('manualThrow');
    m.potionTimer = m.basePotionCooldown * state.modifiers.potionCooldownMult
      * potionCooldownMultiplier(state);
    // Face the throw and trigger the mid-throw pose briefly.
    const dx = aim.x - m.pos.x;
    const dy = aim.y - m.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    m.throwDir = { x: dx / len, y: dy / len };
    m.throwAnim = 0.22;
  }

  // Triple Throw card (GDD §8.2): every `tripleThrowInterval` seconds the
  // alchemist also lobs a 3-potion fan toward the highest-priority enemy on
  // the board. The fan is spawned on TOP of normal throws — it doesn't
  // consume the manual cooldown — so the card stacks with the rest of the
  // potion build instead of replacing it.
  if (state.modifiers.tripleThrowActive) {
    state.modifiers.tripleThrowTimer -= dt;
    if (state.modifiers.tripleThrowTimer <= 0) {
      state.modifiers.tripleThrowTimer = state.modifiers.tripleThrowInterval;
      const target = pickFanTarget(state);
      if (target) {
        spawnFanThrow(state, target);
        audio.playSfx('throwPotion', { detune: 1.1 });
      }
    }
  }

  if (state.overloadRequested) {
    tryActivateOverload(state);
  }

  state.manualFireRequested = false;
  state.overloadRequested = false;
}

/** Pick the most threatening enemy (closest to the mannequin) as the centre
 *  of the Triple-Throw fan. Returns null if the board is empty. */
function pickFanTarget(state: GameState): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = dist(e.pos, state.mannequin.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Spawn a 3-potion fan aimed at `target`. The two side potions land slightly
 *  off-axis (~22°) of the centre potion so the fan has a visible spread. */
function spawnFanThrow(state: GameState, target: Enemy): void {
  const m = state.mannequin;
  const dx = target.pos.x - m.pos.x;
  const dy = target.pos.y - m.pos.y;
  const baseAngle = Math.atan2(dy, dx);
  const baseDist = Math.hypot(dx, dy);
  const FAN = 0.38; // ~22° off-axis
  for (const dAng of [-FAN, 0, FAN]) {
    const a = baseAngle + dAng;
    const tx = m.pos.x + Math.cos(a) * baseDist;
    const ty = m.pos.y + Math.sin(a) * baseDist;
    const aim = clampAim(state, { x: tx, y: ty });
    throwPotion(state, aim, /*manual*/ false);
  }
  spawnFloatingText(state, 'x3', m.pos, '#ffd166');
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
