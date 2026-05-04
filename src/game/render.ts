import type { GameState } from './state';
import { getActiveEffect } from './overload';
import { getSprites } from '../render/sprites';
import { drawSprite, drawSpriteRotated, type BakedSprite } from '../render/sprite';
import { drawActiveDoor, getRoomBackdrop, setBiome, getActiveBiomePalette } from '../render/room';
import { getDais, drawAbilitySlotsOverlay } from '../render/dais';
import {
  drawFirePool,
  drawPixelFloatingText,
  drawReticle,
  drawShadow,
  drawZigzagBolt,
} from '../render/effects';
import { COLORS } from '../render/palette';
import { ELITE_MODS } from '../data/eliteMods';
import { applyIsoTransform, type Camera } from '../render/camera';
import { getViewportSize } from './world';
import { updateParticles, drawParticles, spawnTrail, spawnBurst, FIRE_COLORS, MERCURY_COLORS, ACID_COLORS, AETHER_COLORS, FROST_COLORS, POISON_COLORS } from '../render/particles';
import { drawRadialGlow, getVignette, getColoredVignette } from '../render/glowCache';
import { getShakeOffset } from '../engine/shake';
import { drawShockwaves, updateShockwaves } from '../render/shockwaves';
import { getScreenFlash } from '../render/screenFlash';
import { drawScorchDecals, updateScorchDecals } from '../render/scorchDecals';
import { applyBloom } from '../render/bloom';
import type { DifficultyMode } from '../data/difficulty';
import { DIFFICULTY_MODES } from '../data/difficulty';

function difficultyAuraColor(mode: DifficultyMode): string | null {
  if (mode === 'normal') return null;
  return DIFFICULTY_MODES[mode].color;
}

// Visual sprite scales — bumped 1.5× from the original (SPRITE_SCALE 2→3,
// HERO_SCALE 3→4.5) so enemies and the mannequin read as more substantial
// on screen. Per-enemy `kind.radius` values in `data/enemies.ts` were
// scaled in lock-step so collision/aoe still match the visible silhouette.
const SPRITE_SCALE = 3;
const HERO_SCALE = 4.5;
const TOWER_SCALE = 3;
const RIM_RED = 'rgba(202, 37, 43, 0.72)';

let lastRenderTime = -1;

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  const { width: canvasW, height: canvasH } = getViewportSize();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Set biome so the room backdrop picks the right palette.
  setBiome(state.biomeId);

  // Dark background fill — covers the full canvas in viewport pixels so
  // any tiny gap left by float-rounding the world transform is filled.
  const pal = getActiveBiomePalette();
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // World→canvas camera. `width`/`height` are world dimensions, `canvasH`
  // is the actual canvas pixel height; `getRenderCamera()` returns a scale
  // such that ctx.scale(scale, scale) maps world (0..width, 0..height) onto
  // canvas (0..canvasW, 0..canvasH). On a 1920×1080 PC viewport scale === 1
  // and the transform is a no-op (existing behaviour preserved).
  const camera: Camera = getRenderCamera(width, height);
  ctx.save();
  // Camera shake is applied in viewport space (before the world transform)
  // so a 4-pixel shake reads as 4 pixels regardless of the world→canvas
  // scale used by the camera. Drawn against `Math.round` so the offset
  // stays on the pixel-art grid and doesn't introduce sub-pixel blur.
  const shake = getShakeOffset();
  if (shake.x !== 0 || shake.y !== 0) {
    ctx.translate(Math.round(shake.x), Math.round(shake.y));
  }
  applyIsoTransform(ctx, camera);

  // Pre-baked floor + walls + decor.
  ctx.drawImage(getRoomBackdrop(width, height), 0, 0);

  drawDoorOverlays(ctx, state);
  // Stone dais beneath the mannequin (cached).
  ctx.drawImage(getDais(width, height), 0, 0);
  drawAbilitySlotsOverlay(
    ctx,
    state.mannequin.pos.x,
    state.mannequin.pos.y,
    state.worldTime,
    ['cloud', 'flame', 'cloud', 'shield'],
  );
  drawDangerRim(ctx, state);
  drawRunePoints(ctx, state);
  drawScorchDecals(ctx);
  drawFirePools(ctx, state);
  drawReactionPools(ctx, state);
  drawGoldPickups(ctx, state);
  drawEnemies(ctx, state);
  drawTowers(ctx, state);
  drawMannequin(ctx, state);
  drawProjectiles(ctx, state);
  drawChainBolts(ctx, state);
  // Update and draw particle system. Use real frame delta derived from
  // worldTime so particles stay frame-rate independent. Clamp the delta to
  // avoid huge jumps after tab-switch / pause; a missed frame should never
  // teleport particles across the screen.
  let particleDt = 1 / 60;
  if (lastRenderTime >= 0) {
    particleDt = Math.max(0, Math.min(1 / 20, state.worldTime - lastRenderTime));
  }
  lastRenderTime = state.worldTime;
  updateParticles(particleDt);
  // Shockwaves drawn before particles so the bright rings don't bury the
  // sparks — particles fly outward "through" the ring, which reads as the
  // explosion shoving them outward.
  updateShockwaves(particleDt);
  updateScorchDecals(particleDt);
  drawShockwaves(ctx);
  drawParticles(ctx);
  drawOverloadVfx(ctx);
  drawAimReticle(ctx, state);
  drawFloatingTexts(ctx, state);
  // Dynamic lighting from fire pools
  drawDynamicLighting(ctx, state);

  // Daily-Event Night mode: overlay a heavy dark vignette so visibility
  // shrinks to a light disc around the mannequin. Drawn inside the world
  // transform so the disc tracks the mannequin in world coordinates.
  if (state.nightModeActive) {
    drawNightVignette(ctx, state);
  }

  // Restore from isometric transform
  ctx.restore();

  // Post-process: ambient particles drawn in screen space
  drawAmbientParticles(ctx, state);
}

/** Heavy radial darkness centred on the mannequin. The interior is fully
 *  transparent so the player can still see a disc of the floor; everything
 *  beyond the visible radius fades to near-black. */
function drawNightVignette(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  const cx = state.mannequin.pos.x;
  const cy = state.mannequin.pos.y;
  // Inner = visible disc, outer = full darkness. Tuned so a player sees a
  // generous personal radius but the arena edges are invisible.
  const inner = 180;
  const outer = 480;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(2, 4, 10, 0)');
  grad.addColorStop(0.6, 'rgba(2, 4, 10, 0.75)');
  grad.addColorStop(1, 'rgba(2, 4, 10, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawDoorOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  for (const e of state.entrances) {
    if (!e.active) continue;
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 4);
    drawActiveDoor(ctx, e.pos.x, e.pos.y, pulse, width, height);
  }
}

/** Color used to paint a rune-point's halo + star, keyed by kind. */
const RUNE_KIND_COLOR: Record<string, string> = {
  normal: 'rgba(255, 241, 172,',     // pale brass — same as before
  reinforced: 'rgba(255, 138, 60,',  // warm orange
  unstable: 'rgba(192, 132, 252,',   // unstable purple
  resonant: 'rgba(125, 249, 255,',   // cyan resonance
  defensive: 'rgba(163, 227, 106,',  // pale green
};

function drawRunePoints(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Iso-plane y-compression so the chalk circles read as painted on the
  // floor and not floating perpendicular to the camera.
  const YS = 0.5;
  // During preparing-phase only, empty active runes get an extra animated
  // ring + an upward-floating "+" glyph hovering above the chalk circle.
  // This is a pure visual nudge so the player always knows where they
  // can place a tower between waves — once the wave starts, the hint
  // disappears (placement is locked in combat).
  const showPrepHint = state.phase === 'preparing';

  for (const rp of state.runePoints) {
    if (rp.towerId !== null) continue; // tower will be drawn over the rune
    const isActive = rp.active;
    const isSelected = state.activeRunePoint === rp.id;

    ctx.save();
    ctx.translate(rp.pos.x, rp.pos.y);

    // Per-kind halo color — pulses with worldTime, with `unstable` flickering
    // sharper than the rest to read as "unstable".
    const colorBase = RUNE_KIND_COLOR[rp.kind] ?? RUNE_KIND_COLOR.normal!;
    const pulseSpeed = rp.kind === 'unstable' ? 6 : 3;
    const pulse = 0.13 + 0.08 * Math.sin(state.worldTime * pulseSpeed + rp.unstablePhase);
    const baseAlpha = isActive ? 0.75 : 0.18;
    ctx.strokeStyle = isActive ? COLORS.brassHi : COLORS.stoneHi;
    ctx.fillStyle = isActive
      ? `${colorBase} ${pulse})`
      : 'rgba(160, 160, 180, 0.05)';
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = 1.5;
    // Iso-plane chalk circle (2:1 ellipse).
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 22 * YS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Star, squished along Y so it lies on the same plane as the circle.
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = Math.cos(a) * 17;
      const y = Math.sin(a) * 17 * YS;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Inactive slot: draw an "X" hatching to communicate "locked".
    if (!isActive) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = COLORS.stoneLight;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(12, 4);
      ctx.moveTo(12, -4);
      ctx.lineTo(-12, 4);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    if (isSelected) {
      ctx.strokeStyle = COLORS.brassHi;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 28 * YS, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Prep-phase placement hint — only on active empty runes, only while
    // the player can actually act on it. Two layers:
    //   1. An expanding outer ring that fades from full to zero alpha
    //      every cycle (think "ping radar"), tinted to the rune kind so
    //      it doesn't visually fight the existing chalk circle.
    //   2. A bobbing "+" glyph above the rune so the eye is drawn even
    //      on quiet floors with many runes.
    if (showPrepHint && isActive) {
      const ringPhase = (state.worldTime * 1.4 + rp.unstablePhase) % 1;
      const ringR = 22 + ringPhase * 24;
      const ringAlpha = 0.55 * (1 - ringPhase);
      ctx.strokeStyle = `${colorBase} ${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR, ringR * YS, 0, 0, Math.PI * 2);
      ctx.stroke();

      const bob = Math.sin(state.worldTime * 3 + rp.unstablePhase) * 2;
      const plusAlpha = 0.85 + 0.15 * Math.sin(state.worldTime * 4 + rp.unstablePhase);
      ctx.globalAlpha = plusAlpha;
      ctx.strokeStyle = COLORS.brassHi;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-5, -22 + bob);
      ctx.lineTo(5, -22 + bob);
      ctx.moveTo(0, -27 + bob);
      ctx.lineTo(0, -17 + bob);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

function drawDangerRim(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'wave') return;
  const { x, y } = state.mannequin.pos;
  // Pulse + danger scaling: count enemies within a "near" zone of the
  // mannequin and crossfade pulse depth + line thickness toward red as
  // pressure mounts. Empty arena → almost invisible; surrounded → meaty
  // throbbing rim. Distance threshold matches the inner ellipse's
  // radius so the visual "matches" what the player feels close.
  const NEAR_R2 = 380 * 380;
  let nearCount = 0;
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i]!;
    const dx = e.pos.x - x;
    const dy = e.pos.y - y;
    if (dx * dx + dy * dy < NEAR_R2) nearCount++;
  }
  // Pressure ramps from 0 (no near enemies) to 1 (~10 enemies). Avoids
  // dividing by max-enemies because some waves spawn small swarms that
  // shouldn't max-saturate the rim.
  const pressure = Math.min(1, nearCount / 10);
  const pulse = 0.55 + 0.25 * Math.sin(state.worldTime * (4 + 4 * pressure));
  ctx.save();
  ctx.strokeStyle = RIM_RED;
  ctx.lineWidth = 3 + pressure * 2;
  ctx.globalAlpha = (0.4 + pressure * 0.55) * pulse;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 300, 158, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (0.10 + pressure * 0.18) * pulse;
  ctx.lineWidth = 16 + pressure * 12;
  ctx.stroke();
  ctx.restore();
}

function drawTowers(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  for (const t of state.towers) {
    // Range indicator when shop is open on this rune — iso-plane ellipse so
    // it visually lies on the floor.
    if (state.activeRunePoint === t.runePointId) {
      const R = t.kind.range * state.modifiers.towerRangeMult;
      ctx.save();
      ctx.strokeStyle = `rgba(125, 249, 255, 0.18)`;
      ctx.fillStyle = `rgba(125, 249, 255, 0.04)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(t.pos.x, t.pos.y, R, R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow under base.
    drawShadow(ctx, t.pos.x, t.pos.y + 22, 24, 7, 0.42);

    // Base glow (cached halo to avoid per-frame gradient allocation).
    drawRadialGlow(
      ctx,
      { radius: 28, inner: 'rgba(125, 249, 255, 0.3)', outer: 'rgba(125, 249, 255, 0)' },
      t.pos.x,
      t.pos.y,
      0.08,
    );

    // Base sprite
    let base = s.towerNeedler;
    let barrel = s.towerNeedlerBarrel;
    if (t.kind.id === 'mortar') { base = s.towerMortar; barrel = s.towerMortarBarrel; }
    else if (t.kind.id === 'mercury_sprayer') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'acid_injector') { base = s.towerAcid; barrel = s.towerAcidBarrel; }
    else if (t.kind.id === 'ether_coil') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'watch_tower') { base = s.towerNeedler; barrel = s.towerNeedlerBarrel; }
    drawSprite(ctx, base, t.pos.x, t.pos.y, TOWER_SCALE);

    // Rotating barrel sprite
    drawSpriteRotated(ctx, barrel, t.pos.x, t.pos.y - 6, t.aimAngle, TOWER_SCALE);

    // Эфирная катушка: pulsing arcane halo above the coil to read it as
    // distinct from the mercury sprayer it visually re-uses.
    if (t.kind.id === 'ether_coil') {
      const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 6);
      ctx.save();
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      ctx.fillStyle = '#a78bfa';
      // Two stacked diamond pixels above the head to suggest a static spark.
      ctx.fillRect(Math.round(t.pos.x - 2), Math.round(t.pos.y - 26 - pulse * 4), 4, 4);
      ctx.fillRect(Math.round(t.pos.x - 1), Math.round(t.pos.y - 32 - pulse * 4), 2, 4);
      ctx.restore();
    }

    // Сторожевой фонарь: lantern halo + slow aura pulse on the floor so the
    // player can see who's being buffed. Color matches the tower hue.
    if (t.kind.id === 'watch_tower') {
      const auraR = t.kind.range * state.modifiers.towerRangeMult;
      const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 1.5);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.10 + pulse * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(t.pos.x, t.pos.y, auraR, auraR * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Lantern flame on top.
      ctx.fillStyle = '#ffd166';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(Math.round(t.pos.x - 2), Math.round(t.pos.y - 30 - pulse * 2), 4, 5);
      ctx.fillStyle = '#ffe6a3';
      ctx.fillRect(Math.round(t.pos.x - 1), Math.round(t.pos.y - 32 - pulse * 2), 2, 3);
      ctx.restore();
    }

    // Muzzle flash when recently fired
    if (t.fireTimer < 0.08 && t.kind.behavior !== 'aura') {
      const flashX = t.pos.x + Math.cos(t.aimAngle) * 24;
      const flashY = t.pos.y - 6 + Math.sin(t.aimAngle) * 24;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = t.kind.id === 'acid_injector' ? '#d2f55a' :
                       t.kind.id === 'mercury_sprayer' ? '#7df9ff' :
                       t.kind.id === 'ether_coil' ? '#a78bfa' :
                       t.kind.id === 'mortar' ? '#ff8c3a' : '#ffd166';
      ctx.fillRect(Math.round(flashX - 3), Math.round(flashY - 3), 6, 6);
      ctx.restore();
    }

    // Level pips: small brass dots beneath the base
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = COLORS.brassHi;
      ctx.fillRect(t.pos.x - 10 + i * 8, t.pos.y + 29, 4, 4);
      ctx.fillStyle = COLORS.brass;
      ctx.fillRect(t.pos.x - 10 + i * 8, t.pos.y + 33, 4, 1);
    }
  }
}

function drawMannequin(ctx: CanvasRenderingContext2D, state: GameState): void {
  const m = state.mannequin;
  const s = getSprites();

  // Soft loot magnet ring — iso-plane ellipse on the floor.
  const lootR = m.baseLootRadius * state.modifiers.lootRadiusMult;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.10)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.ellipse(m.pos.x, m.pos.y, lootR, lootR * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Drop shadow (sized to match the 1.5×-scaled mannequin sprite).
  drawShadow(ctx, m.pos.x, m.pos.y + 42, 48, 13, 0.52);

  // Core glow pulse (cached halo).
  const corePulse = 0.5 + 0.5 * Math.sin(state.worldTime * 2);
  drawRadialGlow(
    ctx,
    { radius: 60, inner: 'rgba(125, 249, 255, 0.4)', outer: 'rgba(125, 249, 255, 0)' },
    m.pos.x,
    m.pos.y - 6,
    0.12 + corePulse * 0.06,
  );

  // Idle bob (slow breathing) plus a 2-frame idle "breath" cycle that drifts
  // chest/head highlights once per ~0.6s so the wooden mannequin reads as
  // alive even when standing still. Throw uses a 2-phase animation: first
  // ~60% of the throw window is the windup pose (right arm raised back),
  // last ~40% is the release pose (right arm extended), and the whole sprite
  // lunges toward the throw direction in world space.
  const bob = Math.round(Math.sin(state.worldTime * 2.4) * 1);
  const lunge = m.throwAnim > 0
    ? { x: Math.round(m.throwDir.x * 2), y: Math.round(m.throwDir.y * 2) }
    : { x: 0, y: 0 };
  let sprite: BakedSprite;
  if (m.throwAnim > 0) {
    // Throw window lasts THROW_ANIM_DURATION (see mannequin.ts). Windup for
    // the first portion, release for the rest. Using throwAnim as a count-
    // down: high values = early in the throw (windup), low values = late
    // (release).
    const THROW_RELEASE_FRACTION = 0.4;
    const windupCutoff = 0.22 * THROW_RELEASE_FRACTION;
    sprite = m.throwAnim > windupCutoff ? s.mannequinThrowWindup : s.mannequinThrowRelease;
  } else {
    // Two-frame idle loop. ~1.65 Hz alternation reads as a slow breath that
    // pairs naturally with the bob amplitude above.
    const idleFramePeriod = 0.6;
    sprite = Math.floor(state.worldTime / idleFramePeriod) % 2 === 0
      ? s.mannequin
      : s.mannequinIdleAlt;
  }
  const drawX = m.pos.x + lunge.x;
  const drawY = m.pos.y + bob + lunge.y;

  if (m.damageFlash > 0) {
    drawSprite(ctx, sprite, drawX, drawY, HERO_SCALE);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.7, m.damageFlash * 1.5);
    ctx.fillStyle = COLORS.fireC;
    ctx.fillRect(
      drawX - sprite.anchor.x * HERO_SCALE,
      drawY - sprite.anchor.y * HERO_SCALE,
      sprite.width * HERO_SCALE,
      sprite.height * HERO_SCALE,
    );
    ctx.restore();
  } else {
    drawSprite(ctx, sprite, drawX, drawY, HERO_SCALE);
  }

  // Translucent blue shield bubble — shown whenever the mannequin has any
  // active barrier (Alch-Dome / boss-wave shield via tempShield, or the
  // crafted "stone shield" potion via potionShieldHp). Drawn last so the
  // dome sits visually on top of the hero sprite.
  drawMannequinShieldBubble(ctx, state, drawX, drawY);
}

/** Translucent blue bubble visualising the mannequin's barrier. The bubble
 *  pulses gently with `worldTime` and gets a brighter rim so it reads as a
 *  proper magical dome instead of a flat circle. */
function drawMannequinShieldBubble(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cx: number,
  cy: number,
): void {
  const hasTemp = state.tempShieldTime > 0;
  const hasPotion = state.potionShieldHp > 0;
  if (!hasTemp && !hasPotion) return;

  // Sized to wrap the 1.5×-scaled mannequin (was 46/cy-4 at HERO_SCALE 3).
  const baseR = 69;
  const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 3);
  const radius = baseR + pulse * 2;
  const ox = cx;
  const oy = cy - 6; // centre on the mannequin's torso

  ctx.save();
  // Outer glow halo.
  const glow = ctx.createRadialGradient(ox, oy, radius * 0.55, ox, oy, radius * 1.15);
  glow.addColorStop(0, 'rgba(125, 200, 255, 0.0)');
  glow.addColorStop(0.7, 'rgba(125, 200, 255, 0.18)');
  glow.addColorStop(1, 'rgba(125, 200, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ox, oy, radius * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  // Translucent body of the bubble.
  const body = ctx.createRadialGradient(ox - radius * 0.25, oy - radius * 0.3, radius * 0.1, ox, oy, radius);
  body.addColorStop(0, 'rgba(220, 240, 255, 0.32)');
  body.addColorStop(0.55, 'rgba(125, 200, 255, 0.18)');
  body.addColorStop(1, 'rgba(80, 160, 255, 0.10)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(ox, oy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Bright rim.
  ctx.strokeStyle = `rgba(170, 220, 255, ${0.55 + pulse * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ox, oy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Specular highlight.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(
    ox - radius * 0.35,
    oy - radius * 0.5,
    radius * 0.22,
    radius * 0.10,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  const difAura = difficultyAuraColor(state.difficulty);
  for (const e of state.enemies) {
    // Drop shadow
    drawShadow(ctx, e.pos.x, e.pos.y + e.kind.radius * 0.65, e.kind.radius * 0.85, e.kind.radius * 0.3);

    // Difficulty aura — a soft tinted ellipse under the enemy so buffed
    // dungeons read at a glance. Pulses slightly with worldTime.
    if (difAura) {
      const pulse = 0.75 + Math.sin(state.worldTime * 3 + e.id) * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = difAura;
      ctx.beginPath();
      ctx.ellipse(
        e.pos.x,
        e.pos.y + e.kind.radius * 0.65,
        e.kind.radius * 1.05,
        e.kind.radius * 0.45,
        0, 0, Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    // Shield glow for enemies that still have an unbroken one-hit shield.
    if (e.shieldCharges > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Elite glow: colored aura around the enemy based on elite mod type.
    if (e.elite) {
      const eliteDef = ELITE_MODS[e.elite];
      const pulse = 0.55 + Math.sin(state.worldTime * 4 + e.id * 1.7) * 0.2;
      // Ethereal: fade glow when phased out.
      const alpha = e.elite === 'ethereal' && e.etherealActive ? 0.15 : 0.4;
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.strokeStyle = eliteDef.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ethereal phase-out transparency.
    if (e.elite === 'ethereal' && e.etherealActive) {
      ctx.save();
      ctx.globalAlpha = 0.35;
    }

    // Choose sprite based on enemy kind.
    let sprite = s.slime;
    let bob = 0;
    if (e.kind.id === 'rat') {
      sprite = e.id % 3 === 0 ? s.crystalSpider : s.spider;
      bob = Math.round(Math.sin(state.worldTime * 18 + e.id) * 1);
    } else if (e.kind.id === 'flying_flask') {
      sprite = s.flyingFlask;
      bob = Math.round(Math.sin(state.worldTime * 10 + e.id) * 2);
    } else if (e.kind.id === 'shaman') {
      sprite = s.shaman;
      bob = Math.round(Math.sin(state.worldTime * 3 + e.id) * 1);
    } else if (e.kind.id === 'boss_rat_king') {
      sprite = s.ratKing;
      bob = Math.round(Math.sin(state.worldTime * 2 + e.id) * 1);
    } else if (e.kind.id === 'sapper') {
      sprite = s.sapper;
      // Jitter hard if the fuse is burning down, otherwise a slight waddle.
      bob = e.sapperFuse > 0
        ? Math.round(Math.sin(state.worldTime * 40 + e.id) * 2)
        : Math.round(Math.sin(state.worldTime * 6 + e.id) * 1);
    } else if (e.kind.id === 'boss_homunculus') {
      sprite = s.homunculus;
      bob = Math.round(Math.sin(state.worldTime * 2.5 + e.id) * 1);
    } else if (e.kind.id === 'miniboss_slime' || e.kind.isBoss) {
      sprite = s.slimeBoss;
      bob = Math.round(Math.sin(state.worldTime * 1.8 + e.id) * 1);
    } else if (e.kind.id === 'golem') {
      sprite = s.golem;
      bob = Math.round(Math.sin(state.worldTime * 2.5 + e.id) * 1);
    } else {
      bob = Math.round(Math.sin(state.worldTime * 4 + e.id) * 1);
    }

    // Boss visual distinction: pulsing red/purple glow + crown marker
    if (e.kind.isBoss) {
      const bPulse = 0.6 + Math.sin(state.worldTime * 3.5 + e.id) * 0.25;
      drawRadialGlow(
        ctx,
        {
          radius: 64,
          inner: 'rgba(255, 50, 50, 0.6)',
          mid: 'rgba(180, 40, 120, 0.3)',
          midStop: 0.5,
          outer: 'rgba(180, 40, 120, 0)',
        },
        e.pos.x,
        e.pos.y,
        0.35 * bPulse,
        e.kind.radius * 2.2,
      );

      // Crown symbol above boss
      ctx.save();
      ctx.font = `${Math.round(e.kind.radius * 0.7)}px serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      ctx.fillText('👑', e.pos.x, e.pos.y - e.kind.radius - 6 + bob);
      ctx.restore();
    }

    drawSprite(ctx, sprite, e.pos.x, e.pos.y + bob, SPRITE_SCALE);

    // Close ethereal phase-out transparency.
    if (e.elite === 'ethereal' && e.etherealActive) {
      ctx.restore();
    }

    // White hit flash + impact particles
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(0.85, e.hitFlash * 4);
      ctx.fillStyle = COLORS.whiteSoft;
      ctx.fillRect(
        e.pos.x - sprite.anchor.x * SPRITE_SCALE,
        e.pos.y + bob - sprite.anchor.y * SPRITE_SCALE,
        sprite.width * SPRITE_SCALE,
        sprite.height * SPRITE_SCALE,
      );
      ctx.restore();

      // Spawn impact sparks on fresh hit
      if (e.hitFlash > 0.18) {
        spawnBurst(e.pos.x, e.pos.y, 4, ['#fff', '#ffd166', '#ff8c3a'], 60, 0.3, 2, 80);
      }
    }

    // Status overlays with enhanced VFX
    if (e.status.burnTime > 0) {
      // Fire particles rising
      ctx.fillStyle = COLORS.fireA;
      ctx.fillRect(e.pos.x - 1, e.pos.y - e.kind.radius - 6, 2, 2);
      ctx.fillStyle = COLORS.fireB;
      ctx.fillRect(e.pos.x - 2, e.pos.y - e.kind.radius - 4, 4, 2);
      if (Math.random() < 0.4) {
        spawnTrail(e.pos.x + (Math.random() - 0.5) * 8, e.pos.y - e.kind.radius, FIRE_COLORS[Math.floor(Math.random() * 3)]!, 1.5);
      }
      // Under-glow (cached halo).
      drawRadialGlow(
        ctx,
        { radius: 32, inner: 'rgba(255, 140, 58, 0.4)', outer: 'rgba(255, 140, 58, 0)' },
        e.pos.x,
        e.pos.y,
        0.15,
        e.kind.radius * 2,
      );
    }
    if (e.status.slowTime > 0) {
      ctx.strokeStyle = `rgba(189, 246, 255, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      // Frost shimmer (cached halo).
      drawRadialGlow(
        ctx,
        { radius: 24, inner: 'rgba(125, 249, 255, 0.3)', outer: 'rgba(125, 249, 255, 0)' },
        e.pos.x,
        e.pos.y,
        0.1,
        e.kind.radius * 1.5,
      );
    }
    if (e.status.armorBreakTime > 0) {
      ctx.strokeStyle = `rgba(210, 245, 90, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HP bar (+ optional bonus shield bar above it for cursed-extra shielded
    // enemies). The shield bar shrinks left-to-right as it gets soaked.
    if (e.hp < e.maxHp || e.extraShield > 0) {
      const w = Math.max(20, e.kind.radius * 2.4);
      const x = Math.round(e.pos.x - w / 2);
      const y = Math.round(e.pos.y - e.kind.radius - 10);
      ctx.fillStyle = '#0d0a14';
      ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = COLORS.stoneDark;
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = e.kind.isBoss ? COLORS.fireC : COLORS.fireB;
      ctx.fillRect(x, y, Math.round((e.hp / e.maxHp) * w), 4);
      ctx.fillStyle = e.kind.isBoss ? COLORS.fireA : COLORS.fireA;
      ctx.fillRect(x, y, Math.round((e.hp / e.maxHp) * w), 1);

      if (e.extraShield > 0 && e.extraShieldMax > 0) {
        const shieldFrac = e.extraShield / e.extraShieldMax;
        const sy = y - 4;
        ctx.fillStyle = '#0d0a14';
        ctx.fillRect(x - 1, sy - 1, w + 2, 4);
        ctx.fillStyle = 'rgba(125, 200, 255, 0.85)';
        ctx.fillRect(x, sy, Math.round(shieldFrac * w), 2);
        ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
        ctx.fillRect(x, sy, Math.round(shieldFrac * w), 1);
      }

      // Elite badge above HP bar.
      if (e.elite) {
        const eliteDef = ELITE_MODS[e.elite];
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = eliteDef.color;
        ctx.fillText(eliteDef.badge, e.pos.x, y - 3);
      }
    } else if (e.elite) {
      // Even at full HP, show the badge so elites are identifiable.
      const eliteDef = ELITE_MODS[e.elite];
      const y = Math.round(e.pos.y - e.kind.radius - 6);
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = eliteDef.color;
      ctx.fillText(eliteDef.badge, e.pos.x, y);
    }
  }
}

/** Render short-lived chain-lightning segments left by Эфирная катушка.
 *  Each bolt is drawn as a jagged zig-zag whose alpha fades out with `time`.
 *  Higher-hop segments are drawn thinner / dimmer to match the damage falloff. */
function drawChainBolts(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.chainBolts.length === 0) return;
  ctx.save();
  for (const cb of state.chainBolts) {
    const t = Math.max(0, cb.time / cb.maxTime);
    const alpha = Math.pow(t, 0.7);
    const dx = cb.to.x - cb.from.x;
    const dy = cb.to.y - cb.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // Build a short zig-zag of 6 jitter points along the segment.
    const SEGMENTS = 6;
    const jitter = 6 - cb.hop * 1.5;
    ctx.beginPath();
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const j = (i === 0 || i === SEGMENTS) ? 0 : (Math.random() * 2 - 1) * jitter;
      const x = cb.from.x + dx * u + nx * j;
      const y = cb.from.y + dy * u + ny * j;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Outer glow.
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(167, 139, 250, ${0.35 * alpha})`;
    ctx.lineWidth = Math.max(1, 5 - cb.hop);
    ctx.stroke();
    // Bright core.
    ctx.strokeStyle = `rgba(230, 220, 255, ${0.85 * alpha})`;
    ctx.lineWidth = Math.max(1, 2 - cb.hop * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  const trailColorMap: Record<string, string[]> = {
    fire: FIRE_COLORS,
    mercury: MERCURY_COLORS,
    acid: ACID_COLORS,
    aether: AETHER_COLORS,
    frost: FROST_COLORS,
    poison: POISON_COLORS,
  };
  for (const p of state.projectiles) {
    const trailColors = trailColorMap[p.element] ?? AETHER_COLORS;

    if (p.kind === 'potion') {
      // Arc height (z) is a visual-only offset so the potion appears airborne.
      const z = p.arc?.height ?? 0;
      const drawX = p.pos.x;
      const drawY = p.pos.y - z;

      // Ground shadow: opaque dark ellipse that stays on the floor and
      // shrinks as the potion rises. No glow — shadows don't emit light.
      if (z > 0.5) {
        ctx.save();
        const shrink = Math.max(0.35, 1 - z / 180);
        ctx.globalAlpha = 0.55 * shrink;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(p.pos.x, p.pos.y + 2, 7 * shrink, 3 * shrink, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particle trail follows the AIRBORNE position so the glow traces the
      // arc in the air rather than piling up on the floor (which would look
      // like a glowing shadow).
      spawnTrail(drawX, drawY, trailColors[Math.floor(Math.random() * trailColors.length)]!, 1.5);

      // Soft glow tail — also airborne, and slightly smaller so it reads as
      // "trailing vapour" rather than another shadow.
      const trailGlow: Record<string, string> = {
        fire: 'rgba(255, 140, 58, 0.35)',
        mercury: 'rgba(201, 201, 216, 0.3)',
        acid: 'rgba(210, 245, 90, 0.3)',
        aether: 'rgba(167, 139, 250, 0.35)',
        frost: 'rgba(125, 211, 252, 0.35)',
        poison: 'rgba(155, 227, 107, 0.35)',
      };
      ctx.save();
      ctx.fillStyle = trailGlow[p.element] ?? 'rgba(125, 249, 255, 0.3)';
      const tx = p.arc ? (p.arc.target.x - p.arc.start.x) : p.vel.x;
      const ty = p.arc ? (p.arc.target.y - p.arc.start.y) : p.vel.y;
      ctx.fillRect(Math.round(drawX - 3 - tx * 0.006), Math.round(drawY - 3 - ty * 0.006), 6, 6);
      ctx.restore();

      let sprite = s.potionBottle;
      if (p.element === 'fire') sprite = s.potionBottleFire;
      else if (p.element === 'mercury') sprite = s.potionBottleMercury;
      else if (p.element === 'acid') sprite = s.potionBottleAcid;
      drawSprite(ctx, sprite, drawX, drawY, SPRITE_SCALE);
    } else {
      // Tower projectiles stay on the ground plane, trail can go there too.
      spawnTrail(p.pos.x, p.pos.y, trailColors[Math.floor(Math.random() * trailColors.length)]!, 1.5);
      const angle = Math.atan2(p.vel.y, p.vel.x);
      ctx.save();
      const flashColor = p.element === 'acid' ? 'rgba(210, 245, 90, 0.4)' :
                          p.element === 'mercury' ? 'rgba(189, 246, 255, 0.4)' :
                          'rgba(255, 209, 102, 0.4)';
      ctx.fillStyle = flashColor;
      ctx.fillRect(Math.round(p.pos.x - 2), Math.round(p.pos.y - 2), 4, 4);
      ctx.restore();

      if (p.element === 'mercury' || p.element === 'acid') {
        const projSprite = p.element === 'acid' ? s.acidDrop : s.potionBottleMercury;
        drawSpriteRotated(ctx, projSprite, p.pos.x, p.pos.y, angle, SPRITE_SCALE);
      } else {
        drawSpriteRotated(ctx, s.needle, p.pos.x, p.pos.y, angle, SPRITE_SCALE);
      }
    }
  }
}

function drawFirePools(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const fp of state.firePools) {
    drawFirePool(ctx, fp.pos.x, fp.pos.y, fp.radius, fp.time, state.worldTime);
    // Spark particles from fire
    if (Math.random() < 0.3) {
      spawnTrail(
        fp.pos.x + (Math.random() - 0.5) * fp.radius,
        fp.pos.y + (Math.random() - 0.5) * fp.radius,
        FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]!,
        2,
      );
    }
  }
}

function drawGoldPickups(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  for (const g of state.goldPickups) {
    // tiny shadow
    drawShadow(ctx, g.pos.x, g.pos.y + 4, 5, 1.5, 0.35);
    // bob
    const bob = Math.round(Math.sin(state.worldTime * 6 + g.id) * 1);
    drawSprite(ctx, s.coin, g.pos.x, g.pos.y + bob, 2);
    // sparkle on alternating frames
    if (((state.worldTime * 4) | 0) % 3 === g.id % 3) {
      ctx.fillStyle = COLORS.whiteSoft;
      ctx.fillRect(Math.round(g.pos.x + 5), Math.round(g.pos.y + bob - 5), 1, 1);
      ctx.fillRect(Math.round(g.pos.x + 6), Math.round(g.pos.y + bob - 4), 1, 1);
    }
  }
}

function drawReactionPools(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const rp of state.reactionPools) {
    const fadeIn = Math.min(1, (rp.maxTime - rp.time) / 0.3);
    const fadeOut = Math.min(1, rp.time / 0.5);
    const alpha = fadeIn * fadeOut * 0.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    const flicker = 0.5 + 0.5 * Math.sin(state.worldTime * 8);
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 6);
    let fill = 'rgba(125, 249, 255, 0.25)';
    let inner = 'rgba(125, 249, 255, 0.15)';
    let stroke: string | null = null;
    switch (rp.kind) {
      case 'caustic_vapor':
        fill = `rgba(210, 245, 90, ${0.3 + flicker * 0.15})`;
        inner = `rgba(156, 204, 46, ${0.2 + flicker * 0.1})`;
        break;
      case 'time_rift':
        fill = `rgba(125, 249, 255, ${0.15 + pulse * 0.1})`;
        inner = `rgba(189, 246, 255, ${0.2 + pulse * 0.1})`;
        stroke = `rgba(189, 246, 255, ${0.4 + pulse * 0.2})`;
        break;
      case 'spark_cascade':
        // Brief electric flash — tinted purple with a hot core.
        fill = `rgba(167, 139, 250, ${0.25 + flicker * 0.2})`;
        inner = `rgba(220, 200, 255, ${0.4 + flicker * 0.15})`;
        break;
      case 'brittle_frost':
        fill = `rgba(125, 211, 252, ${0.25 + pulse * 0.1})`;
        inner = `rgba(180, 230, 255, ${0.3 + pulse * 0.1})`;
        stroke = `rgba(180, 230, 255, 0.4)`;
        break;
      case 'glass_shatter':
        // Single bright flash that shrinks rapidly.
        fill = `rgba(192, 232, 255, ${0.35 + pulse * 0.2})`;
        inner = `rgba(255, 255, 255, ${0.3})`;
        break;
      case 'mutagen_burst':
        fill = `rgba(155, 227, 107, ${0.3 + flicker * 0.1})`;
        inner = `rgba(220, 255, 160, ${0.2 + flicker * 0.1})`;
        break;
      case 'flash_steam':
        fill = `rgba(244, 162, 97, ${0.25 + flicker * 0.15})`;
        inner = `rgba(255, 220, 180, ${0.3 + flicker * 0.1})`;
        break;
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(rp.pos.x, rp.pos.y, rp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(rp.pos.x, rp.pos.y, rp.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rp.pos.x, rp.pos.y, rp.radius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDynamicLighting(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Mannequin core glow (cached halo).
  const m = state.mannequin;
  drawRadialGlow(
    ctx,
    { radius: 80, inner: 'rgba(125, 249, 255, 0.06)', outer: 'rgba(125, 249, 255, 0)' },
    m.pos.x,
    m.pos.y,
    1,
  );

  // Fire pool lights — base alpha is folded into a single cached halo;
  // per-pool fade is applied via globalAlpha (no gradient re-allocation).
  for (const fp of state.firePools) {
    const fadeOut = Math.max(0, Math.min(1, fp.time / 0.5));
    if (fadeOut <= 0) continue;
    drawRadialGlow(
      ctx,
      { radius: 64, inner: 'rgba(255, 140, 58, 0.08)', outer: 'rgba(255, 140, 58, 0)' },
      fp.pos.x,
      fp.pos.y,
      fadeOut,
      fp.radius * 3,
    );
  }

  // Tower range glow (cached halo).
  for (const t of state.towers) {
    drawRadialGlow(
      ctx,
      { radius: 30, inner: 'rgba(125, 249, 255, 0.03)', outer: 'rgba(125, 249, 255, 0)' },
      t.pos.x,
      t.pos.y,
      1,
    );
  }

  ctx.restore();
}

function drawAimReticle(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'wave' && state.phase !== 'preparing') return;
  // Trajectory preview during prep + first ~6s of a wave so the player
  // can read the throw arc without it lingering forever during long
  // battles. Fades out so it doesn't dominate later. Skipped for the
  // very first 0.3s of a wave so the wave-start beat isn't crowded.
  const showPreview =
    state.phase === 'preparing'
    || (state.waveState.timeInWave > 0.3 && state.waveState.timeInWave < 6);
  if (showPreview) {
    const alpha =
      state.phase === 'preparing'
        ? 0.7
        : 0.7 * Math.max(0, 1 - (state.waveState.timeInWave - 0.3) / 5.7);
    drawTrajectoryPreview(ctx, state, alpha);
  }
  drawReticle(ctx, state.aim.x, state.aim.y);
}

function drawTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
): void {
  // Mirror `throwPotion`'s arc parameters so the preview matches what the
  // next throw will actually do. Distance-driven peak height keeps the
  // shape consistent with the in-flight projectile.
  const m = state.mannequin;
  const start = m.pos;
  const target = state.aim;
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) return;
  const peak = Math.min(140, 40 + d * 0.18);
  const segments = 16;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#bdf6ff';
  // Punctured line: tiny squares at every other segment so it reads as a
  // dotted parabola without a per-segment lineDash setup. Squares scale
  // down toward the landing point so the player's eye is led to the aim.
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = start.x + dx * t;
    // sin-shaped arc, identical to throwPotion's `Math.sin(t * PI) * peakHeight`.
    const arcDrop = Math.sin(t * Math.PI) * peak;
    const y = start.y + dy * t - arcDrop;
    if (i % 2 === 1) {
      const sz = Math.max(2, Math.round(4 - (i / segments) * 2.5));
      ctx.fillRect(Math.round(x) - sz / 2, Math.round(y) - sz / 2, sz, sz);
    }
  }
  // Landing marker: a small flat ellipse at the aim point so the player's
  // eye can attach to "where it'll land".
  ctx.strokeStyle = '#bdf6ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(target.x, target.y, 8, 8 * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOverloadVfx(ctx: CanvasRenderingContext2D): void {
  const eff = getActiveEffect();
  if (!eff) return;
  const alpha = Math.max(0, 1 - eff.age / 0.45);

  // Screen flash on initial overload
  if (eff.age < 0.1) {
    ctx.save();
    ctx.globalAlpha = (0.1 - eff.age) * 3;
    ctx.fillStyle = 'rgba(189, 246, 255, 0.15)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  for (let i = 0; i < eff.lightningChain.length - 1; i++) {
    const a = eff.lightningChain[i]!;
    const b = eff.lightningChain[i + 1]!;
    drawZigzagBolt(ctx, a.x, a.y, b.x, b.y, alpha, eff.age * 100 + i);
  }
  // Flash dot at endpoints with glow
  for (const p of eff.lightningChain) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.whiteSoft;
    ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6);
    ctx.restore();
    // Point glow (cached halo).
    drawRadialGlow(
      ctx,
      { radius: 20, inner: 'rgba(189, 246, 255, 0.5)', outer: 'rgba(189, 246, 255, 0)' },
      p.x,
      p.y,
      alpha * 0.3,
    );
    // Spawn spark particles
    if (alpha > 0.5 && Math.random() < 0.6) {
      spawnBurst(p.x, p.y, 2, AETHER_COLORS, 40, 0.2, 1.5, 50);
    }
  }
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.floatingTexts) {
    const ageNorm = Math.max(0, Math.min(1, 1 - t.life / t.maxLife));
    const alpha = Math.max(0, t.life / t.maxLife);
    // Scale-pop envelope: overshoot to 1.35× in the first 12% of life,
    // settle back to 1.0 by 30%. Reads as "snap into existence" without
    // the float losing its readable size for the rest of its lifetime.
    let scale: number;
    if (ageNorm < 0.12) {
      const k = ageNorm / 0.12;
      scale = 0.6 + k * 0.75; // 0.6 → 1.35
    } else if (ageNorm < 0.30) {
      const k = (ageNorm - 0.12) / 0.18;
      scale = 1.35 - k * 0.35; // 1.35 → 1.0
    } else {
      scale = 1.0;
    }
    drawPixelFloatingText(ctx, t.text, t.pos.x, t.pos.y, t.color, alpha, {
      scale,
      kind: t.kind,
    });
  }
}

// Ambient dust/sparkle particles (drawn in screen space, not affected by iso)
interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const ambientParticles: AmbientParticle[] = [];
const AMBIENT_PARTICLE_CAP = 80;
let lastAmbientSpawn = 0;
let lastAmbientTime = -1;

function drawAmbientParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  const t = state.worldTime;
  const dt = lastAmbientTime < 0 ? 1 / 60 : Math.min(1 / 20, Math.max(0, t - lastAmbientTime));
  lastAmbientTime = t;

  // Spawn new particles periodically. Capped so we never accumulate a huge
  // backlog if the tab was unfocused (worldTime stops, but spawn cadence is
  // still time-based so the next visible frame would dump dozens of dust
  // motes at once).
  if (t - lastAmbientSpawn > 0.08 && ambientParticles.length < AMBIENT_PARTICLE_CAP) {
    lastAmbientSpawn = t;
    const biomePal = getActiveBiomePalette();
    const colors = biomePal.ambientColors;
    ambientParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 12 - 4,
      life: 2 + Math.random() * 3,
      maxLife: 2 + Math.random() * 3,
      size: 1 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    });
  }

  // Update and draw. Single save/restore pair around the whole batch — the
  // previous version saved/restored per particle which costs more than the
  // actual fillRect for a mote-sized sprite.
  ctx.save();
  let lastAlpha = -1;
  let lastColor = '';
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const p = ambientParticles[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      // Swap-remove: O(1) compared to splice-shift through the tail.
      ambientParticles[i] = ambientParticles[ambientParticles.length - 1]!;
      ambientParticles.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const alpha = Math.min(1, p.life / p.maxLife) * Math.min(1, (p.maxLife - p.life) / 0.5);
    if (alpha !== lastAlpha) {
      ctx.globalAlpha = alpha;
      lastAlpha = alpha;
    }
    if (p.color !== lastColor) {
      ctx.fillStyle = p.color;
      lastColor = p.color;
    }
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.restore();

  // Bloom pass — soft additive halo around bright emissive pixels.
  // Runs after the world layers but before the cinematic vignette so the
  // vignette can still darken the corners on top of the bloom (otherwise
  // the bloom would be partially shadowed by the vignette and look weak
  // at the edges of the screen).
  applyBloom(ctx, ctx.canvas, 0.32, 5, 130);

  // Vignette overlay for cinematic depth (cached canvas keyed by size).
  ctx.drawImage(getVignette(width, height, 0.5), 0, 0);

  // Mannequin damage screen-edge flash. Drawn after the cinematic vignette
  // so the red tint sits clearly on top of the dark fall-off and reads as
  // a separate "ow" effect rather than darkening the corners further.
  // A single cached red vignette is reused — alpha is varied per-frame
  // via globalAlpha so the cache size stays bounded.
  const flash = getScreenFlash();
  if (flash.alpha > 0.01) {
    const { width: cw, height: ch } = getViewportSize();
    ctx.save();
    ctx.globalAlpha = Math.min(1, flash.alpha);
    ctx.drawImage(getColoredVignette(cw, ch, 0.85, flash.rgb), 0, 0);
    ctx.restore();
  }
}

// Export camera config for input system. Maps world coordinates onto canvas
// pixels via a single uniform scale that fits the world height (`height`)
// into the canvas height. World width matches canvas aspect (see
// `setArenaSize`), so the same scale also maps world (0..world.w) onto
// canvas (0..canvas.w) with no horizontal letterboxing.
export function getRenderCamera(_width: number, height: number): Camera {
  const { height: canvasH } = getViewportSize();
  const scale = canvasH / height;
  return { cx: 0, cy: 0, scale };
}
