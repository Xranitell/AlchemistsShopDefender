import type { GameState, Tower, Enemy } from './state';
import { getActiveEffect } from './overload';
import { getSprites } from '../render/sprites';
import { drawSprite, drawSpriteRotated, type BakedSprite } from '../render/sprite';
import {
  drawAnimFrame,
  isSheetReady,
  paintAnimFrameTint,
  type AnimRow,
} from '../render/animatedSprite';
import {
  ENEMY_ANIMS,
  MANNEQUIN_IDLE_ANIM,
  MANNEQUIN_THROW_ANIM,
  enemyAnimFps,
} from '../render/creatureAnims';
import { drawActiveDoor, getRoomBackdrop, setBiome, getActiveBiomePalette } from '../render/room';
import { getDais, drawAbilitySlotsOverlay } from '../render/dais';
import {
  drawTurret,
  getTurretFootprint,
  PAINTED_TURRET_LIFT_Y,
  PAINTED_TURRET_SCALE,
  isPaintedTurretSheetReady,
} from '../render/turretSheet';
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
import { getAurasBuffing, isAuraProvidingBuffs } from './tower';

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
// Painted turret sprite scale. Source frames are ~280 × 370 px; at 0.25
// they render ~70 × 92 on screen — about 0.55 m wide given the new 1 m
// floor tile (TILE_W = 128 px), which keeps the painted pedestals
// proportional to the rune-circle / mannequin and roughly matches the
// previous 30-px-wide pixel-art tower silhouette in visual weight.
/** Default render scale for painted turret stands. Re-exported from
 *  `turretSheet` so the firing pipeline (in `tower.ts`) reads the same
 *  value when computing the muzzle Y offset. */
const TOWER_PAINTED_SCALE = PAINTED_TURRET_SCALE;
const RIM_RED = 'rgba(202, 37, 43, 0.72)';

let lastRenderTime = -1;

/** Derive the canvas's HiDPI multiplier (backing-store px : CSS px).
 *  We read it directly from the canvas rather than importing the
 *  viewport manager so this module stays free of UI-layer deps. */
function getCanvasDpr(ctx: CanvasRenderingContext2D): number {
  const c = ctx.canvas;
  // `clientWidth` is the CSS-pixel size of the canvas element; `c.width`
  // is the backing-store size. Their ratio is the DPR multiplier
  // applied by syncArenaToViewport in main.ts (capped at MAX_DPR).
  // `clientWidth` is 0 for detached canvases — fall back to 1.
  if (c.clientWidth > 0 && c.width > 0) {
    return c.width / c.clientWidth;
  }
  return 1;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  const { width: canvasW, height: canvasH } = getViewportSize();
  // Reset to the HiDPI-aware base transform every frame. The canvas
  // backing store is sized to CSS-px × dpr (see syncArenaToViewport in
  // main.ts), and rendering math throughout this module assumes the
  // logical units match CSS pixels — so we re-pin the transform to
  // (dpr,0,0,dpr,0,0) before any drawing. Cheap (single matrix set);
  // also paves over any accidental transform drift from upstream code.
  const dpr = getCanvasDpr(ctx);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  // Floor decals for every tower (range rings, drop shadows, lantern
  // halos, EMP rings, level pips) are drawn first so they sit
  // underneath every body. The combined pass that follows interleaves
  // tower bodies and enemy sprites by feet-Y so an enemy in front of a
  // tower visually overlaps it, while an enemy behind it gets covered
  // by the pedestal.
  drawTowerFloors(ctx, state);
  drawSortedEntities(ctx, state);
  drawMannequin(ctx, state);
  drawMortarTargetReticles(ctx, state);
  drawPotionBlasts(ctx, state);
  drawProjectiles(ctx, state);
  drawChainBolts(ctx, state);
  drawDeathMarks(ctx, state);
  drawMeteorImpacts(ctx, state);
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

/** Floor decals for one tower: range indicator, drop shadow, base glow,
 *  the lantern buff halo (if active), the EMP / disabled ring, and the
 *  level pips beneath the pedestal. Drawn before any tower body or
 *  enemy sprite so floor effects always sit underneath everything else
 *  in the scene. The body sprite is drawn separately by
 *  `drawTowerBody`, which is interleaved with enemy sprites by the
 *  combined depth-sort pass in `drawSortedEntities`. */
function drawTowerFloor(ctx: CanvasRenderingContext2D, state: GameState, t: Tower): void {
  const painted = getTurretFootprint(t.kind.id, TOWER_PAINTED_SCALE);
  const willPaint = isPaintedTurretSheetReady();
  // Painted turret base — used by level pips, which want to land just
  // under the body silhouette. Floor decals (shadow, halo, range
  // indicator, EMP ring) intentionally anchor at `t.pos.y` instead so
  // they visually sit *under the legs* of the painted stand at the
  // rune-point centre, matching the chalk-circle the player tapped to
  // summon the tower. Anchoring decals at the painted base pushed them
  // past the front edge of the chalk circle and they read as floating
  // detached from the tower silhouette (see screenshot in PR #208).
  const baseY = willPaint ? t.pos.y - PAINTED_TURRET_LIFT_Y : t.pos.y;
  const floorY = t.pos.y;

  // Range indicator when shop is open on this rune — iso-plane ellipse so
  // it visually lies on the floor.
  if (state.activeRunePoint === t.runePointId) {
    const R = t.kind.range * state.modifiers.towerRangeMult;
    ctx.save();
    ctx.strokeStyle = `rgba(125, 249, 255, 0.18)`;
    ctx.fillStyle = `rgba(125, 249, 255, 0.04)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(t.pos.x, floorY, R, R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Drop shadow. Anchors at the rune centre (`t.pos.y`) so the shadow
  // sits directly under the legs of the painted stand instead of
  // dropping past the chalk-circle's front edge.
  const shadowW = willPaint ? painted.width * 0.50 : painted.width * 0.42;
  const shadowH = willPaint ? 9 : 7;
  const shadowAlpha = willPaint ? 0.32 : 0.42;
  const shadowY = floorY + (willPaint ? 4 : 6);
  drawShadow(ctx, t.pos.x, shadowY, shadowW, shadowH, shadowAlpha);

  // Base glow (cached halo to avoid per-frame gradient allocation).
  drawRadialGlow(
    ctx,
    { radius: 28, inner: 'rgba(125, 249, 255, 0.3)', outer: 'rgba(125, 249, 255, 0)' },
    t.pos.x,
    floorY,
    0.08,
  );

  // Сторожевой фонарь buff indicator (floor part). The body part —
  // bloom + fireflies — is drawn in `drawTowerBody`. Layers drawn here:
  //   1. Outer expanding "ping" ring — slow, ramps and fades.
  //   2. Bright floor halo at the lantern colour.
  //   3. Inner radial gradient spotlight under the tower.
  // Painted on every tower currently being buffed by a lantern and
  // *also* on the lantern itself while it is providing buffs, so the
  // aura source reads as actively working on its own pedestal.
  const showAuraHalo =
    t.kind.behavior === 'aura'
      ? isAuraProvidingBuffs(state, t.id)
      : getAurasBuffing(state, t.id).length > 0;
  if (showAuraHalo) {
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 2.4 + t.id);
    const haloR = Math.max(30, painted.width * 0.55);
    ctx.save();

    const ringPhase = (state.worldTime * 0.9 + t.id * 0.13) % 1;
    const ringR = haloR * (1.0 + ringPhase * 0.8);
    const ringAlpha = 0.42 * (1 - ringPhase);
    ctx.strokeStyle = `rgba(255, 218, 130, ${ringAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(t.pos.x, floorY + 4, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 209, 102, ${0.55 + pulse * 0.30})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(t.pos.x, floorY + 4, haloR, haloR * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    const halox = t.pos.x;
    const haloy = floorY + 4;
    const haloFill = ctx.createRadialGradient(halox, haloy, 0, halox, haloy, haloR);
    haloFill.addColorStop(0, `rgba(255, 230, 163, ${0.32 + pulse * 0.18})`);
    haloFill.addColorStop(0.6, `rgba(255, 209, 102, ${0.16 + pulse * 0.10})`);
    haloFill.addColorStop(1, `rgba(255, 209, 102, 0)`);
    ctx.fillStyle = haloFill;
    ctx.beginPath();
    ctx.ellipse(halox, haloy, haloR, haloR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // EMP / stun overlay (floor part). The static sparks rotating around
  // the body are drawn in `drawTowerBody`. The flickering cyan ellipse
  // sits flat on the floor as a "tower offline" indicator.
  if (t.disabledTimer > 0) {
    const blink = (Math.floor(state.worldTime * 16) % 2) === 0 ? 1 : 0.55;
    ctx.save();
    ctx.strokeStyle = `rgba(125, 249, 255, ${0.55 * blink})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(t.pos.x, floorY + 4, 26, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Level pips: small brass dots beneath the pedestal base, on the
  // floor. Painted pedestals are dropped past the rune centre, so pips
  // shift down by the same amount and land just under the cast
  // shadow; the pixel-art fallback keeps its tighter offset.
  const pipY = Math.round(baseY + (willPaint ? 2 : 29));
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = COLORS.brassHi;
    ctx.fillRect(t.pos.x - 10 + i * 8, pipY, 4, 4);
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(t.pos.x - 10 + i * 8, pipY + 4, 4, 1);
  }
}

/** Tower body + body-mounted UI for one tower: the painted pedestal +
 *  machinery (or pixel-art fallback), per-tower body sparkles (ether
 *  coil arcs, lantern flame, buff bloom + fireflies), and the muzzle
 *  flash on recent fire. Drawn from `drawSortedEntities` so the body
 *  is correctly z-ordered against enemy sprites: enemies that are in
 *  front of the tower (closer to the camera in iso-projection) draw on
 *  top, enemies behind it draw underneath. Floor decals are handled by
 *  the prior `drawTowerFloor` pass. */
function drawTowerBody(ctx: CanvasRenderingContext2D, state: GameState, t: Tower): void {
  const s = getSprites();
  const painted = getTurretFootprint(t.kind.id, TOWER_PAINTED_SCALE);
  const willPaint = isPaintedTurretSheetReady();
  const liftY = willPaint ? PAINTED_TURRET_LIFT_Y : 0;

  // Mirror the painted stand so non-aura turrets visually face *away*
  // from the mannequin (per design request, May 2026). The painted
  // sprites are drawn with their business-end / barrel pointing LEFT
  // by default, so:
  //   - stands on the LEFT of the mannequin stay un-flipped → barrel
  //     keeps pointing left, i.e. away from the centre.
  //   - stands on the RIGHT of the mannequin get flipped → barrel
  //     now points right, i.e. away from the centre.
  // Aura towers (Сторожевой фонарь) are symmetric and idle-rotate via
  // `aimAngle`, so we leave them un-flipped on both sides.
  const facesAwayLeft =
    t.kind.behavior !== 'aura' && t.pos.x > state.mannequin.pos.x;
  const usingPainted = drawTurret(
    ctx,
    t.pos.x,
    t.pos.y - liftY,
    t.kind.id,
    { scale: TOWER_PAINTED_SCALE, flipX: facesAwayLeft },
  );
  if (!usingPainted) {
    let base: BakedSprite = s.towerNeedler;
    let barrel: BakedSprite = s.towerNeedlerBarrel;
    if (t.kind.id === 'mortar') { base = s.towerMortar; barrel = s.towerMortarBarrel; }
    else if (t.kind.id === 'mercury_sprayer') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'acid_injector') { base = s.towerAcid; barrel = s.towerAcidBarrel; }
    else if (t.kind.id === 'ether_coil') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'watch_tower') { base = s.towerNeedler; barrel = s.towerNeedlerBarrel; }
    drawSprite(ctx, base, t.pos.x, t.pos.y, TOWER_SCALE);
    drawSpriteRotated(ctx, barrel, t.pos.x, t.pos.y - 6, t.aimAngle, TOWER_SCALE);
  }

  // Painted-mode "tower top" anchor — the painted stand is drawn
  // bottom-anchored at (pos.x, pos.y - liftY), so the machinery on
  // top lands at roughly y - liftY - painted.height. Procedural
  // sparkles / flames / muzzle flashes that sit on top of the small
  // pixel-art sprite are lifted by the same amount when painted; the
  // baked-fallback frames keep the original offsets.
  const topY = usingPainted ? t.pos.y - liftY - painted.height + 12 : t.pos.y - 6;
  const muzzleReach = usingPainted ? Math.max(28, painted.width * 0.55) : 24;

  // Эфирная катушка: pulsing arcane sparkle above the pixel-art
  // fallback coil. Painted Tesla coil already paints its own
  // electricity, so we skip this in painted mode.
  if (t.kind.id === 'ether_coil' && !usingPainted) {
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 6);
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(Math.round(t.pos.x - 2), Math.round(t.pos.y - 26 - pulse * 4), 4, 4);
    ctx.fillRect(Math.round(t.pos.x - 1), Math.round(t.pos.y - 32 - pulse * 4), 2, 4);
    ctx.restore();
  }

  // Сторожевой фонарь fallback flame on top of the small pixel-art
  // lantern. The painted lantern already carries its own flame in the
  // sheet so it's skipped in painted mode.
  if (t.kind.id === 'watch_tower' && !usingPainted) {
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 1.5);
    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(Math.round(t.pos.x - 2), Math.round(t.pos.y - 30 - pulse * 2), 4, 5);
    ctx.fillStyle = '#ffe6a3';
    ctx.fillRect(Math.round(t.pos.x - 1), Math.round(t.pos.y - 32 - pulse * 2), 2, 3);
    ctx.restore();
  }

  // Сторожевой фонарь buff indicator (body part). Floor halos are
  // drawn in `drawTowerFloor`; the body parts here are the warm bloom
  // over the painted body and the orbiting fireflies / rising sparks.
  // Painted on every tower currently being buffed by a lantern and
  // *also* on the lantern itself while it is providing buffs, so the
  // aura source carries the same warm bloom that buffed turrets do.
  const showAuraBody =
    t.kind.behavior === 'aura'
      ? isAuraProvidingBuffs(state, t.id)
      : getAurasBuffing(state, t.id).length > 0;
  if (usingPainted && showAuraBody) {
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 2.4 + t.id);
    const haloR = Math.max(30, painted.width * 0.55);
    const bodyY = t.pos.y - liftY - painted.height * 0.5;
    ctx.save();

    // Warm radial bloom over the painted body — drawn with `lighter`
    // blend so the painted pixels themselves take on a gold tint
    // while the buff is active.
    const bloomR = Math.max(painted.width, painted.height) * 0.7;
    const bloomAlpha = 0.30 + pulse * 0.25;
    const bloom = ctx.createRadialGradient(t.pos.x, bodyY, 0, t.pos.x, bodyY, bloomR);
    bloom.addColorStop(0, `rgba(255, 230, 163, ${bloomAlpha})`);
    bloom.addColorStop(0.55, `rgba(255, 200, 100, ${bloomAlpha * 0.45})`);
    bloom.addColorStop(1, `rgba(255, 200, 100, 0)`);
    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(t.pos.x, bodyY, bloomR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = prevComp;

    // Four orbiting "fireflies" so motion reads as a swarm.
    const orbitR = haloR * 0.55;
    const ang = state.worldTime * 1.6 + t.id;
    ctx.fillStyle = '#ffe6a3';
    ctx.globalAlpha = 0.9;
    for (let k = 0; k < 4; k++) {
      const a = ang + (k * Math.PI) / 2;
      const fx = Math.round(t.pos.x + Math.cos(a) * orbitR);
      const fy = Math.round(bodyY + Math.sin(a) * orbitR * 0.5);
      ctx.fillRect(fx - 1, fy - 1, 3, 3);
    }

    // Two rising sparks above the tower so the buff reads from any
    // viewing distance.
    const sparkPhase = (state.worldTime * 0.7 + t.id * 0.21) % 1;
    const sparkY = bodyY - painted.height * 0.4 - sparkPhase * 24;
    const sparkAlpha = 0.85 * (1 - sparkPhase);
    ctx.globalAlpha = sparkAlpha;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(Math.round(t.pos.x - 6), Math.round(sparkY), 2, 2);
    ctx.fillRect(Math.round(t.pos.x + 4), Math.round(sparkY + 4), 2, 2);

    ctx.restore();
  }

  // EMP body sparks rotating around the upper body. The flickering
  // floor ellipse is drawn in `drawTowerFloor`.
  if (t.disabledTimer > 0) {
    const blink = (Math.floor(state.worldTime * 16) % 2) === 0 ? 1 : 0.55;
    ctx.save();
    ctx.fillStyle = `rgba(125, 249, 255, ${0.7 * blink})`;
    const spinAng = state.worldTime * 6 + t.id;
    for (let k = 0; k < 3; k++) {
      const a = spinAng + (k * Math.PI * 2) / 3;
      const sx = Math.round(t.pos.x + Math.cos(a) * 22);
      const sy = Math.round(t.pos.y - 22 + Math.sin(a) * 6);
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    ctx.restore();
  }

  // Muzzle flash when recently fired.
  if (t.fireTimer < 0.08 && t.kind.behavior !== 'aura' && t.disabledTimer <= 0) {
    const flashX = t.pos.x + Math.cos(t.aimAngle) * muzzleReach;
    const flashY = topY + Math.sin(t.aimAngle) * muzzleReach;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = t.kind.id === 'acid_injector' ? '#d2f55a' :
                     t.kind.id === 'mercury_sprayer' ? '#7df9ff' :
                     t.kind.id === 'ether_coil' ? '#a78bfa' :
                     t.kind.id === 'mortar' ? '#ff8c3a' : '#ffd166';
    ctx.fillRect(Math.round(flashX - 3), Math.round(flashY - 3), 6, 6);
    ctx.restore();
  }
}

/** Loop helper: invokes `drawTowerFloor` for every tower so all floor
 *  decals are flushed before the depth-sorted body pass. */
function drawTowerFloors(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.towers) drawTowerFloor(ctx, state, t);
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

  // Drop shadow — sit it directly under the painted mannequin's feet
  // (the sprite anchor is at `m.pos.y`, so an offset would float the
  // shadow below the floor). Width/height scale with the painted idle
  // frame so the shadow stays in proportion as the sprite scale changes.
  const mannequinFeetY = m.pos.y;
  const mannequinShadowW = Math.round(MANNEQUIN_IDLE_ANIM.sh * MANNEQUIN_IDLE_ANIM.scale * 0.32);
  const mannequinShadowH = Math.max(6, Math.round(mannequinShadowW * 0.28));
  drawShadow(ctx, m.pos.x, mannequinFeetY, mannequinShadowW, mannequinShadowH, 0.52);

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

  // Choose the active pose. Prefer the painted mannequin sheet when it
  // has finished loading; otherwise fall back to the baked pixel-art
  // poses. The painted sheet now has TWO 4-frame rows: idle (subtle
  // breathing loop) and throw (grip → raise → extend → follow-through).
  const useAnim = isSheetReady(MANNEQUIN_IDLE_ANIM.sheet);
  let bakedSprite: BakedSprite;
  let animRow = MANNEQUIN_IDLE_ANIM;
  let animFrame: number;
  // Same throw-window decomposition the baked path used: 60% wind-up
  // followed by 40% release. We reuse it to pick the baked fallback
  // sprite AND to map the painted throw row's 4 frames over the throw
  // duration (frames 0–1 during wind-up, frames 2–3 during release).
  const THROW_DURATION = 0.44;
  const THROW_RELEASE_FRACTION = 0.4;
  const windupCutoff = THROW_DURATION * THROW_RELEASE_FRACTION;
  if (m.throwAnim > 0) {
    // throwAnim counts DOWN from THROW_DURATION → 0; convert to a
    // forward 0..1 progress so frame index moves forward with time.
    const progress = Math.min(1, Math.max(0, 1 - m.throwAnim / THROW_DURATION));
    if (m.throwAnim > windupCutoff) {
      bakedSprite = s.mannequinThrowWindup;
    } else {
      bakedSprite = s.mannequinThrowRelease;
    }
    animRow = MANNEQUIN_THROW_ANIM;
    animFrame = Math.min(3, Math.floor(progress * 4));
  } else {
    // Idle: loop the 4 painted breathing frames at ~3.3 fps so a full
    // cycle is ~1.2s, slow enough to read as breath without distracting.
    const idleFps = 3.3;
    animFrame = Math.floor(state.worldTime * idleFps) % 4;
    // Baked fallback only has 2 idle poses; pair frames 0/1 with the
    // base idle and 2/3 with the alt idle so the 2-pose flip still
    // breathes when the sheet hasn't loaded.
    bakedSprite = animFrame >= 2 ? s.mannequinIdleAlt : s.mannequin;
  }
  const drawX = m.pos.x + lunge.x;
  const drawY = m.pos.y + bob + lunge.y;
  // Mirror the painted mannequin to face the most recent throw direction
  // so a left-side throw reads as the alchemist actually turning before
  // releasing. The painted sheet faces right by default; a small deadband
  // around throwDir.x ≈ 0 keeps a straight-up throw from flipping.
  const mannequinFlipX = m.throwDir.x < -0.01;

  if (useAnim) {
    drawAnimFrame(ctx, animRow, animFrame, drawX, drawY, { flipX: mannequinFlipX });
    if (m.damageFlash > 0) {
      // Tint via offscreen mask so the salmon overlay clips to the
      // mannequin's painted pixels — a `source-atop fillRect` on the
      // main canvas would also tint the floor inside the source rect
      // (the floor is opaque) and read as a salmon rectangle behind
      // the mannequin.
      paintAnimFrameTint(
        ctx,
        animRow,
        animFrame,
        drawX,
        drawY,
        COLORS.fireC,
        Math.min(0.7, m.damageFlash * 1.5),
        { flipX: mannequinFlipX },
      );
    }
  } else if (m.damageFlash > 0) {
    drawSprite(ctx, bakedSprite, drawX, drawY, HERO_SCALE);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.7, m.damageFlash * 1.5);
    ctx.fillStyle = COLORS.fireC;
    ctx.fillRect(
      drawX - bakedSprite.anchor.x * HERO_SCALE,
      drawY - bakedSprite.anchor.y * HERO_SCALE,
      bakedSprite.width * HERO_SCALE,
      bakedSprite.height * HERO_SCALE,
    );
    ctx.restore();
  } else {
    drawSprite(ctx, bakedSprite, drawX, drawY, HERO_SCALE);
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

/** Render a single enemy's body + status overlays + HP bar. The
 *  per-frame state (sprite atlas, difficulty aura colour, mannequin x
 *  for facing) is hoisted into the caller (`drawSortedEntities`) and
 *  passed in so the function stays cheap to invoke per-entity inside
 *  the depth-sorted loop. */
function drawSingleEnemy(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  e: Enemy,
  s: ReturnType<typeof getSprites>,
  difAura: string | null,
  targetX: number,
): void {
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

  // Choose baked-sprite fallback + matching animation row by enemy kind.
  // The sheet-based row drives the 4-frame walk cycle when its image is
  // ready; until then we drop back to the baked pixel-art `sprite`.
  let sprite = s.slime;
  let anim: AnimRow | undefined = ENEMY_ANIMS[e.kind.id];
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
    // Boss kinds without a dedicated row (e.g. future bosses) reuse the
    // miniboss slime row; if even that's missing the fallback path is fine.
    if (!anim) anim = ENEMY_ANIMS['miniboss_slime'];
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

  // Animation FPS scales with the enemy's base speed so a sprinter's walk
  // cycle plays faster than a stomper's. The sapper's "armed" state spikes
  // the rate to read as panicked sparking. A small per-enemy phase offset
  // (`e.id * 0.137`) keeps clusters of the same kind from marching in
  // perfect lock-step.
  let fps = enemyAnimFps(e.kind.speed);
  if (e.kind.id === 'sapper' && e.sapperFuse > 0) fps *= 2.2;
  const frameIndex = Math.floor(state.worldTime * fps + e.id * 0.137);

  // Painted sprites are anchored at the frame's body-mass centre + bottom,
  // so we draw them onto the SHADOW centre (e.pos.y + r*0.65) — that puts
  // the creature's feet on the ellipse instead of floating above it.
  // The baked-pixel-art fallback already bakes its own shadow row into the
  // sprite, so it stays drawn at e.pos.y when the sheet hasn't loaded.
  const groundY = e.pos.y + e.kind.radius * 0.65;
  // Flip when the mannequin is to the enemy's left. A 4 px deadband stops
  // jitter for enemies passing directly over the mannequin centre line.
  const flipX = targetX < e.pos.x - 4;
  const drewAnim = anim
    ? drawAnimFrame(ctx, anim, frameIndex, e.pos.x, groundY + bob, { flipX })
    : false;
  if (!drewAnim) {
    drawSprite(ctx, sprite, e.pos.x, e.pos.y + bob, SPRITE_SCALE);
  }

  // Close ethereal phase-out transparency.
  if (e.elite === 'ethereal' && e.etherealActive) {
    ctx.restore();
  }

  // White hit flash + impact particles
  if (e.hitFlash > 0) {
    const flashAlpha = Math.min(0.85, e.hitFlash * 4);
    if (drewAnim && anim) {
      // Painted sprites need an offscreen-mask tint — see
      // paintAnimFrameTint comment for why source-atop on the main
      // canvas would leak across the floor.
      paintAnimFrameTint(
        ctx,
        anim,
        frameIndex,
        e.pos.x,
        groundY + bob,
        COLORS.whiteSoft,
        flashAlpha,
        { flipX },
      );
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = COLORS.whiteSoft;
      ctx.fillRect(
        e.pos.x - sprite.anchor.x * SPRITE_SCALE,
        e.pos.y + bob - sprite.anchor.y * SPRITE_SCALE,
        sprite.width * SPRITE_SCALE,
        sprite.height * SPRITE_SCALE,
      );
      ctx.restore();
    }

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

/** Combined depth-sorted pass for tower bodies and enemy sprites.
 *  Builds an interleaved list of both, sorted by feet-Y (the painter's-
 *  algorithm convention used elsewhere in this renderer), then draws
 *  each entity's body in order. Tower bodies use `drawTowerBody`;
 *  enemies use `drawSingleEnemy`. Floor decals (drop shadows, range
 *  rings, lantern halos, EMP rings, etc.) for towers are drawn earlier
 *  by `drawTowerFloors`, before this pass, so the floor effects always
 *  sit underneath everything else.
 *
 *  Tower "feet" are at the painted pedestal base, shifted down from
 *  the summoned rune by PAINTED_TURRET_LIFT_Y. Enemy "feet" are at
 *  `pos.y + radius * 0.65` (matches `drawShadow`). Equal-y entities
 *  tie-break on spawn id so depth doesn't flicker between frames. */
function drawSortedEntities(ctx: CanvasRenderingContext2D, state: GameState): void {
  type Item = { feetY: number; tieId: number; tower?: Tower; enemy?: Enemy };
  const items: Item[] = [];
  for (const t of state.towers) {
    const feetY = isPaintedTurretSheetReady() ? t.pos.y - PAINTED_TURRET_LIFT_Y : t.pos.y;
    items.push({ feetY, tieId: t.id, tower: t });
  }
  for (const e of state.enemies) {
    items.push({ feetY: e.pos.y + e.kind.radius * 0.65, tieId: e.id, enemy: e });
  }
  items.sort((a, b) => {
    if (a.feetY !== b.feetY) return a.feetY - b.feetY;
    return a.tieId - b.tieId;
  });

  // Per-frame setup hoisted out of the per-enemy loop.
  const s = getSprites();
  const difAura = difficultyAuraColor(state.difficulty);
  const targetX = state.mannequin.pos.x;

  for (const item of items) {
    if (item.tower) drawTowerBody(ctx, state, item.tower);
    else if (item.enemy) drawSingleEnemy(ctx, state, item.enemy, s, difAura, targetX);
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

/** Render the 0.5-second vial-impact shockwaves. Each blast traces
 *  the *exact* splash radius the area-damage check used so the player
 *  can read which enemies got caught in the blast. Drawn flat on the
 *  iso-floor (rx = radius, ry = radius * 0.5) under the projectile /
 *  particle pass so the brighter explosion sparks layer over it. */
function drawPotionBlasts(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.potionBlasts.length === 0) return;
  ctx.save();
  const prevComp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const b of state.potionBlasts) {
    // 1 → 0 envelope. The radius eases out from 60% to 100% over the
    // first ~70% of the lifetime so the ring "snaps" to its real size
    // quickly, then holds while it fades.
    const t = Math.max(0, Math.min(1, b.time / b.maxTime));
    const elapsed = 1 - t;
    const grow = Math.min(1, elapsed / 0.35);
    const r = b.radius * (0.6 + 0.4 * grow);
    const rx = r;
    const ry = r * 0.5;
    const fade = t * t;
    const tint = potionBlastTint(b.element);
    const innerAlpha = (b.echo ? 0.18 : 0.32) * fade;
    const ringAlpha = (b.echo ? 0.45 : 0.85) * fade;
    // Filled gradient disc — darker centre, transparent edge — so the
    // splash zone reads as a "dust cloud" rather than just an outline.
    const gradient = ctx.createRadialGradient(b.pos.x, b.pos.y, 0, b.pos.x, b.pos.y, rx);
    gradient.addColorStop(0, `rgba(${tint}, ${innerAlpha})`);
    gradient.addColorStop(0.7, `rgba(${tint}, ${innerAlpha * 0.5})`);
    gradient.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(b.pos.x, b.pos.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright outer ring at the actual splash radius.
    ctx.strokeStyle = `rgba(${tint}, ${ringAlpha})`;
    ctx.lineWidth = (b.echo ? 1.5 : 2.2) * fade + 0.5;
    ctx.beginPath();
    ctx.ellipse(b.pos.x, b.pos.y, b.radius, b.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = prevComp;
  ctx.restore();
}

/** Death Mark Overload: pulsing red ring around marked enemies. The ring
 *  contracts as the fuse runs out, so the player sees the detonation
 *  approaching even mid-combat. */
function drawDeathMarks(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.deathMarks.length === 0) return;
  ctx.save();
  for (const dm of state.deathMarks) {
    const fuse = Math.max(0, dm.delay);
    // 1 at spawn → 0 at detonation
    const t = Math.min(1, fuse / 2);
    const pulse = 0.5 + 0.5 * Math.sin(dm.age * 12);
    const baseR = 22 + 10 * pulse;
    const r = baseR * (0.6 + 0.4 * t);
    ctx.strokeStyle = `rgba(255, 80, 110, ${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(dm.pos.x, dm.pos.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner shrinking marker so the player can read time-to-boom.
    ctx.strokeStyle = `rgba(255, 200, 220, ${0.5 * pulse})`;
    ctx.lineWidth = 1.4;
    const ir = r * (0.35 + 0.25 * (1 - t));
    ctx.beginPath();
    ctx.ellipse(dm.pos.x, dm.pos.y, ir, ir * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Meteor Shower Overload: streak of fire descending from above the
 *  impact point. After the meteor lands `MeteorImpact` is removed by
 *  `tickMeteorImpacts`; the impact ring itself is rendered via the
 *  shockwave / scorch decal layer triggered inside `applyDamageToEnemy`'s
 *  fire branch, so this only needs to draw the in-flight streak. */
function drawMeteorImpacts(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.meteorImpacts.length === 0) return;
  ctx.save();
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const m of state.meteorImpacts) {
    const fuse = Math.max(0, m.delay);
    // Estimate the meteor's vertical position above its impact point.
    // We don't have a proper "meteor entity" — just a queued impact —
    // so render a comet streak whose tail length grows with `fuse` and
    // whose tip closes in on the target as the fuse runs out.
    const fall = Math.min(1, fuse / 0.6);
    const tipY = m.pos.y - 360 * fall;
    const tailLen = 60 + 200 * fall;
    const grad = ctx.createLinearGradient(m.pos.x, tipY - tailLen, m.pos.x, tipY);
    grad.addColorStop(0, 'rgba(255, 90, 30, 0)');
    grad.addColorStop(0.6, 'rgba(255, 140, 60, 0.55)');
    grad.addColorStop(1, 'rgba(255, 220, 160, 0.95)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6 * (1 - fall * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.pos.x, tipY - tailLen);
    ctx.lineTo(m.pos.x, tipY);
    ctx.stroke();
    // Glowing target reticle on the ground until the meteor lands.
    const targetAlpha = 0.4 + 0.4 * Math.abs(Math.sin(m.total * 12 + fuse * 18));
    ctx.strokeStyle = `rgba(255, 130, 70, ${targetAlpha})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(m.pos.x, m.pos.y, m.radius, m.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = prev;
  ctx.restore();
}

function drawMortarTargetReticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  for (const p of state.projectiles) {
    if (p.kind !== 'tower' || !p.arc) continue;
    const t = Math.min(1, Math.max(0, p.arc.t));
    const x = p.arc.target.x;
    const y = p.arc.target.y;
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 12 + p.id);
    const warn = 0.45 + 0.35 * t;
    const r = 28 - 8 * t + pulse * 2;
    const bracket = 8;
    const splashR = Math.max(16, p.splashRadius);

    ctx.globalAlpha = 0.2 + warn * 0.45;
    ctx.fillStyle = 'rgba(255, 91, 58, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y, splashR, splashR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.5 + warn * 0.35;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, splashR, splashR * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.75 + warn * 0.25;
    ctx.strokeStyle = COLORS.fireA;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.5 + bracket);
    ctx.lineTo(x - r, y - r * 0.5);
    ctx.lineTo(x - r + bracket, y - r * 0.5);
    ctx.moveTo(x + r - bracket, y - r * 0.5);
    ctx.lineTo(x + r, y - r * 0.5);
    ctx.lineTo(x + r, y - r * 0.5 + bracket);
    ctx.moveTo(x + r, y + r * 0.5 - bracket);
    ctx.lineTo(x + r, y + r * 0.5);
    ctx.lineTo(x + r - bracket, y + r * 0.5);
    ctx.moveTo(x - r + bracket, y + r * 0.5);
    ctx.lineTo(x - r, y + r * 0.5);
    ctx.lineTo(x - r, y + r * 0.5 - bracket);
    ctx.stroke();

    ctx.fillStyle = COLORS.whiteSoft;
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  ctx.restore();
}

/** RGB triplet (without alpha) for the vial-impact ring/glow tint
 *  per element. Picked to match the existing `deathRingColor` palette
 *  so reaction effects share a visual language across the renderer. */
function potionBlastTint(element: import('./state').PotionBlast['element']): string {
  switch (element) {
    case 'fire': return '255, 180, 90';
    case 'mercury': return '220, 230, 255';
    case 'acid': return '210, 245, 90';
    case 'aether': return '189, 246, 255';
    case 'frost': return '189, 246, 255';
    case 'poison': return '155, 227, 107';
    default: return '245, 232, 255';
  }
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

    if (p.kind === 'potion' || (p.kind === 'tower' && p.arc)) {
      // Arc height (z) is a visual-only offset so the projectile reads
      // as airborne. Both thrown vials and mortar shells take this
      // path — only the sprite / size differs.
      const z = p.arc?.height ?? 0;
      const drawX = p.pos.x;
      const drawY = p.pos.y - z;

      // Mortar shells are large iron spheres; thrown vials are small
      // bottles. The shadow / trail scale with the projectile silhouette
      // so the player can read incoming siege fire at a glance.
      const isMortar = p.kind === 'tower';

      // Ground shadow: opaque dark ellipse that stays on the floor and
      // shrinks as the projectile rises. No glow — shadows don't emit
      // light. Mortar shells get a markedly bigger shadow because the
      // ball itself is much bigger.
      if (z > 0.5) {
        ctx.save();
        const shrink = Math.max(0.35, 1 - z / 180);
        ctx.globalAlpha = 0.55 * shrink;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        const sx = isMortar ? 14 : 7;
        const sy = isMortar ? 5 : 3;
        ctx.ellipse(p.pos.x, p.pos.y + 2, sx * shrink, sy * shrink, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particle trail follows the AIRBORNE position so the glow traces the
      // arc in the air rather than piling up on the floor (which would look
      // like a glowing shadow).
      spawnTrail(drawX, drawY, trailColors[Math.floor(Math.random() * trailColors.length)]!, isMortar ? 2.5 : 1.5);

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
      const tailSize = isMortar ? 8 : 6;
      ctx.fillRect(Math.round(drawX - tailSize / 2 - tx * 0.006), Math.round(drawY - tailSize / 2 - ty * 0.006), tailSize, tailSize);
      ctx.restore();

      if (isMortar) {
        // Big iron-ball mortar shell — drawn directly as a layered
        // gradient circle so we don't need a new sprite asset. The
        // wisp on top sells the lit fuse / heat-haze readability.
        ctx.save();
        // Outer dark shell
        ctx.fillStyle = '#1f1410';
        ctx.beginPath();
        ctx.arc(drawX, drawY, 10, 0, Math.PI * 2);
        ctx.fill();
        // Mid tone
        ctx.fillStyle = '#3a2a22';
        ctx.beginPath();
        ctx.arc(drawX, drawY, 8, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = '#6f4632';
        ctx.beginPath();
        ctx.arc(drawX - 2.2, drawY - 2.4, 3, 0, Math.PI * 2);
        ctx.fill();
        // Specular spark
        ctx.fillStyle = 'rgba(255, 220, 170, 0.8)';
        ctx.beginPath();
        ctx.arc(drawX - 3, drawY - 3.2, 1.4, 0, Math.PI * 2);
        ctx.fill();
        // Burning fuse glow at the top of the ball
        const flicker = 0.7 + 0.3 * Math.sin(state.worldTime * 30 + p.id);
        ctx.fillStyle = `rgba(255, 168, 76, ${0.55 * flicker})`;
        ctx.beginPath();
        ctx.arc(drawX, drawY - 11, 3.2 * flicker, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        let sprite = s.potionBottle;
        if (p.element === 'fire') sprite = s.potionBottleFire;
        else if (p.element === 'mercury') sprite = s.potionBottleMercury;
        else if (p.element === 'acid') sprite = s.potionBottleAcid;
        drawSprite(ctx, sprite, drawX, drawY, SPRITE_SCALE);
      }
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

  // Screen flash on initial overload. Fill the visible viewport in
  // CSS-pixel space — `ctx.canvas.{width,height}` are backing-store
  // dimensions (CSS × dpr) and would over-fill on HiDPI canvases now
  // that the renderer pre-applies an (dpr,0,0,dpr) base transform.
  if (eff.age < 0.1) {
    const { width: vpW, height: vpH } = getViewportSize();
    ctx.save();
    ctx.globalAlpha = (0.1 - eff.age) * 3;
    ctx.fillStyle = 'rgba(189, 246, 255, 0.15)';
    ctx.fillRect(0, 0, vpW, vpH);
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
//
// On phone-sized viewports an extra `MOBILE_ZOOM` factor is applied
// uniformly. With cx=cy=0 the scale is anchored at the world origin
// (top-left), so a >1 zoom would push the mannequin (= world centre)
// off the canvas centre toward the bottom-right. We compensate with a
// `offsetX/Y` shift that pulls the scaled image back so the mannequin
// — and the rune ring around it — stays pinned to the canvas
// midpoint. Net effect: the dais / runes / combat ring read larger
// on a small screen while the floor's outer (mostly-empty) margins
// are cropped equally on every side.
const MOBILE_ZOOM = 1.18;
export function getRenderCamera(_width: number, height: number): Camera {
  const { width: canvasW, height: canvasH } = getViewportSize();
  const baseScale = canvasH / height;
  const isMobile = canvasW < 1100 || canvasH < 620;
  if (!isMobile) {
    return { cx: 0, cy: 0, scale: baseScale };
  }
  const scale = baseScale * MOBILE_ZOOM;
  // Recenter: world centre maps to canvas centre at base scale; the
  // extra MOBILE_ZOOM blows that point off-centre by
  // `canvasDim/2 * (MOBILE_ZOOM - 1)` toward the bottom-right. Pulling
  // the rendered image back by exactly that vector restores centring.
  const offsetX = -canvasW * 0.5 * (MOBILE_ZOOM - 1);
  const offsetY = -canvasH * 0.5 * (MOBILE_ZOOM - 1);
  return { cx: 0, cy: 0, scale, offsetX, offsetY };
}
