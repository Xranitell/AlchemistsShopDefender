import type { GameState } from './state';
import { getActiveEffect } from './overload';
import { getSprites } from '../render/sprites';
import { drawSprite, drawSpriteRotated } from '../render/sprite';
import { drawActiveDoor, getRoomBackdrop } from '../render/room';
import { getDais, drawAbilitySlotsOverlay } from '../render/dais';
import {
  drawFirePool,
  drawPixelFloatingText,
  drawReticle,
  drawShadow,
  drawZigzagBolt,
} from '../render/effects';
import { COLORS } from '../render/palette';
import { applyIsoTransform, type Camera } from '../render/camera';
import { updateParticles, drawParticles, spawnTrail, spawnBurst, FIRE_COLORS, MERCURY_COLORS, ACID_COLORS, AETHER_COLORS } from '../render/particles';
import type { DifficultyMode } from '../data/difficulty';
import { DIFFICULTY_MODES } from '../data/difficulty';

function difficultyAuraColor(mode: DifficultyMode): string | null {
  if (mode === 'normal') return null;
  return DIFFICULTY_MODES[mode].color;
}

const SPRITE_SCALE = 2;

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  // Dark background fill (visible at corners due to rotation)
  ctx.fillStyle = '#0a0810';
  ctx.fillRect(0, 0, width, height);

  // Flat 2D camera (identity transform). Kept as save/restore so per-frame
  // world drawing can still freely mutate the canvas state.
  const camera: Camera = { cx: width / 2, cy: height / 2, scale: 1 };
  ctx.save();
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
  drawRunePoints(ctx, state);
  drawFirePools(ctx, state);
  drawReactionPools(ctx, state);
  drawGoldPickups(ctx, state);
  drawEnemies(ctx, state);
  drawTowers(ctx, state);
  drawMannequin(ctx, state);
  drawProjectiles(ctx, state);
  // Update and draw particle system
  updateParticles(1 / 60);
  drawParticles(ctx);
  drawOverloadVfx(ctx);
  drawAimReticle(ctx, state);
  drawFloatingTexts(ctx, state);
  // Dynamic lighting from fire pools
  drawDynamicLighting(ctx, state);

  // Restore from isometric transform
  ctx.restore();

  // Post-process: ambient particles drawn in screen space
  drawAmbientParticles(ctx, state);
}

function drawDoorOverlays(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  for (const e of state.entrances) {
    if (!e.active) continue;
    const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 4);
    drawActiveDoor(ctx, e.pos.x, e.pos.y, pulse, width, height);
  }
}

function drawRunePoints(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Iso-plane y-compression so the chalk circles read as painted on the
  // floor and not floating perpendicular to the camera.
  const YS = 0.5;

  for (const rp of state.runePoints) {
    if (rp.towerId !== null) continue; // tower will be drawn over the rune
    const isActive = rp.active;
    const isSelected = state.activeRunePoint === rp.id;

    ctx.save();
    ctx.translate(rp.pos.x, rp.pos.y);

    const baseAlpha = isActive ? 0.55 : 0.18;
    ctx.strokeStyle = isActive ? COLORS.aetherB : COLORS.stoneHi;
    ctx.fillStyle = isActive
      ? `rgba(125, 249, 255, ${0.10 + 0.06 * Math.sin(state.worldTime * 3)})`
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
    ctx.restore();
  }
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
    drawShadow(ctx, t.pos.x, t.pos.y + 16, 18, 5, 0.4);

    // Base glow
    ctx.save();
    ctx.globalAlpha = 0.08;
    const baseGlow = ctx.createRadialGradient(t.pos.x, t.pos.y, 0, t.pos.x, t.pos.y, 28);
    baseGlow.addColorStop(0, 'rgba(125, 249, 255, 0.3)');
    baseGlow.addColorStop(1, 'rgba(125, 249, 255, 0)');
    ctx.fillStyle = baseGlow;
    ctx.fillRect(t.pos.x - 28, t.pos.y - 28, 56, 56);
    ctx.restore();

    // Base sprite
    let base = s.towerNeedler;
    let barrel = s.towerNeedlerBarrel;
    if (t.kind.id === 'mortar') { base = s.towerMortar; barrel = s.towerMortarBarrel; }
    else if (t.kind.id === 'mercury_sprayer') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'acid_injector') { base = s.towerAcid; barrel = s.towerAcidBarrel; }
    drawSprite(ctx, base, t.pos.x, t.pos.y, SPRITE_SCALE);

    // Rotating barrel sprite
    drawSpriteRotated(ctx, barrel, t.pos.x, t.pos.y - 4, t.aimAngle, SPRITE_SCALE);

    // Muzzle flash when recently fired
    if (t.fireTimer < 0.08) {
      const flashX = t.pos.x + Math.cos(t.aimAngle) * 16;
      const flashY = t.pos.y - 4 + Math.sin(t.aimAngle) * 16;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = t.kind.id === 'acid_injector' ? '#d2f55a' :
                       t.kind.id === 'mercury_sprayer' ? '#7df9ff' :
                       t.kind.id === 'mortar' ? '#ff8c3a' : '#ffd166';
      ctx.fillRect(Math.round(flashX - 3), Math.round(flashY - 3), 6, 6);
      ctx.restore();
    }

    // Level pips: small brass dots beneath the base
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = COLORS.brassHi;
      ctx.fillRect(t.pos.x - 8 + i * 6, t.pos.y + 22, 3, 3);
      ctx.fillStyle = COLORS.brass;
      ctx.fillRect(t.pos.x - 8 + i * 6, t.pos.y + 25, 3, 1);
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

  // Drop shadow
  drawShadow(ctx, m.pos.x, m.pos.y + 18, 20, 6, 0.5);

  // Core glow pulse
  const corePulse = 0.5 + 0.5 * Math.sin(state.worldTime * 2);
  ctx.save();
  ctx.globalAlpha = 0.12 + corePulse * 0.06;
  const mannGlow = ctx.createRadialGradient(m.pos.x, m.pos.y - 4, 0, m.pos.x, m.pos.y - 4, 40);
  mannGlow.addColorStop(0, 'rgba(125, 249, 255, 0.4)');
  mannGlow.addColorStop(1, 'rgba(125, 249, 255, 0)');
  ctx.fillStyle = mannGlow;
  ctx.fillRect(m.pos.x - 40, m.pos.y - 44, 80, 80);
  ctx.restore();

  // Idle bob (slow breathing); throw window lunges forward one pixel toward
  // the aim direction to sell the motion without needing extra sprite frames.
  const bob = Math.round(Math.sin(state.worldTime * 2.4) * 1);
  const lunge = m.throwAnim > 0
    ? { x: Math.round(m.throwDir.x * 2), y: Math.round(m.throwDir.y * 2) }
    : { x: 0, y: 0 };
  const sprite = m.throwAnim > 0 ? s.mannequinThrow : s.mannequin;
  const drawX = m.pos.x + lunge.x;
  const drawY = m.pos.y + bob + lunge.y;

  if (m.damageFlash > 0) {
    drawSprite(ctx, sprite, drawX, drawY, SPRITE_SCALE);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.7, m.damageFlash * 1.5);
    ctx.fillStyle = COLORS.fireC;
    ctx.fillRect(
      drawX - sprite.anchor.x * SPRITE_SCALE,
      drawY - sprite.anchor.y * SPRITE_SCALE,
      sprite.width * SPRITE_SCALE,
      sprite.height * SPRITE_SCALE,
    );
    ctx.restore();
  } else {
    drawSprite(ctx, sprite, drawX, drawY, SPRITE_SCALE);
  }
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
    } else if (e.kind.id === 'miniboss_slime' || e.kind.isBoss) {
      sprite = s.slimeBoss;
      bob = Math.round(Math.sin(state.worldTime * 1.8 + e.id) * 1);
    } else if (e.kind.id === 'golem') {
      sprite = s.golem;
      bob = Math.round(Math.sin(state.worldTime * 2.5 + e.id) * 1);
    } else {
      bob = Math.round(Math.sin(state.worldTime * 4 + e.id) * 1);
    }

    drawSprite(ctx, sprite, e.pos.x, e.pos.y + bob, SPRITE_SCALE);

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
      // Under-glow
      ctx.save();
      ctx.globalAlpha = 0.15;
      const fireGlow = ctx.createRadialGradient(e.pos.x, e.pos.y, 0, e.pos.x, e.pos.y, e.kind.radius * 2);
      fireGlow.addColorStop(0, 'rgba(255, 140, 58, 0.4)');
      fireGlow.addColorStop(1, 'rgba(255, 140, 58, 0)');
      ctx.fillStyle = fireGlow;
      ctx.fillRect(e.pos.x - e.kind.radius * 2, e.pos.y - e.kind.radius * 2, e.kind.radius * 4, e.kind.radius * 4);
      ctx.restore();
    }
    if (e.status.slowTime > 0) {
      ctx.strokeStyle = `rgba(189, 246, 255, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      // Frost shimmer
      ctx.save();
      ctx.globalAlpha = 0.1;
      const frostGlow = ctx.createRadialGradient(e.pos.x, e.pos.y, 0, e.pos.x, e.pos.y, e.kind.radius * 1.5);
      frostGlow.addColorStop(0, 'rgba(125, 249, 255, 0.3)');
      frostGlow.addColorStop(1, 'rgba(125, 249, 255, 0)');
      ctx.fillStyle = frostGlow;
      ctx.fillRect(e.pos.x - e.kind.radius * 2, e.pos.y - e.kind.radius * 2, e.kind.radius * 4, e.kind.radius * 4);
      ctx.restore();
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

    // HP bar
    if (e.hp < e.maxHp) {
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
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  const trailColorMap: Record<string, string[]> = {
    fire: FIRE_COLORS,
    mercury: MERCURY_COLORS,
    acid: ACID_COLORS,
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
    if (rp.kind === 'caustic_vapor') {
      const flicker = 0.5 + 0.5 * Math.sin(state.worldTime * 8);
      ctx.fillStyle = `rgba(210, 245, 90, ${0.3 + flicker * 0.15})`;
      ctx.beginPath();
      ctx.arc(rp.pos.x, rp.pos.y, rp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(156, 204, 46, ${0.2 + flicker * 0.1})`;
      ctx.beginPath();
      ctx.arc(rp.pos.x, rp.pos.y, rp.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(state.worldTime * 6);
      ctx.fillStyle = `rgba(125, 249, 255, ${0.15 + pulse * 0.1})`;
      ctx.beginPath();
      ctx.arc(rp.pos.x, rp.pos.y, rp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(189, 246, 255, ${0.4 + pulse * 0.2})`;
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

  // Mannequin core glow
  const m = state.mannequin;
  const coreGlow = ctx.createRadialGradient(m.pos.x, m.pos.y, 0, m.pos.x, m.pos.y, 80);
  coreGlow.addColorStop(0, 'rgba(125, 249, 255, 0.06)');
  coreGlow.addColorStop(1, 'rgba(125, 249, 255, 0)');
  ctx.fillStyle = coreGlow;
  ctx.fillRect(m.pos.x - 80, m.pos.y - 80, 160, 160);

  // Fire pool lights
  for (const fp of state.firePools) {
    const fadeOut = Math.max(0, Math.min(1, fp.time / 0.5));
    const r = fp.radius * 3;
    const g = ctx.createRadialGradient(fp.pos.x, fp.pos.y, 0, fp.pos.x, fp.pos.y, r);
    g.addColorStop(0, `rgba(255, 140, 58, ${0.08 * fadeOut})`);
    g.addColorStop(1, 'rgba(255, 140, 58, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(fp.pos.x - r, fp.pos.y - r, r * 2, r * 2);
  }

  // Tower range glow (subtle)
  for (const t of state.towers) {
    const tg = ctx.createRadialGradient(t.pos.x, t.pos.y, 0, t.pos.x, t.pos.y, 30);
    tg.addColorStop(0, 'rgba(125, 249, 255, 0.03)');
    tg.addColorStop(1, 'rgba(125, 249, 255, 0)');
    ctx.fillStyle = tg;
    ctx.fillRect(t.pos.x - 30, t.pos.y - 30, 60, 60);
  }

  ctx.restore();
}

function drawAimReticle(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'wave' && state.phase !== 'preparing') return;
  drawReticle(ctx, state.aim.x, state.aim.y);
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
    ctx.fillRect(0, 0, 1280, 720);
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
    // Point glow
    ctx.globalAlpha = alpha * 0.3;
    const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20);
    pg.addColorStop(0, 'rgba(189, 246, 255, 0.5)');
    pg.addColorStop(1, 'rgba(189, 246, 255, 0)');
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
    ctx.restore();
    // Spawn spark particles
    if (alpha > 0.5 && Math.random() < 0.6) {
      spawnBurst(p.x, p.y, 2, AETHER_COLORS, 40, 0.2, 1.5, 50);
    }
  }
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.floatingTexts) {
    const alpha = Math.max(0, t.life / 0.8);
    drawPixelFloatingText(ctx, t.text, t.pos.x, t.pos.y, t.color, alpha);
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
let lastAmbientSpawn = 0;

function drawAmbientParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  const t = state.worldTime;

  // Spawn new particles periodically
  if (t - lastAmbientSpawn > 0.08) {
    lastAmbientSpawn = t;
    const colors = ['rgba(125, 249, 255, 0.3)', 'rgba(255, 209, 102, 0.25)', 'rgba(189, 246, 255, 0.2)'];
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

  // Update and draw
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const p = ambientParticles[i]!;
    p.life -= 0.016;
    if (p.life <= 0) {
      ambientParticles.splice(i, 1);
      continue;
    }
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    const alpha = Math.min(1, p.life / p.maxLife) * Math.min(1, (p.maxLife - p.life) / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.restore();
  }

  // Vignette overlay for cinematic depth
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.25,
    width / 2, height / 2, Math.max(width, height) * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// Export camera config for input system
export function getRenderCamera(width: number, height: number): Camera {
  return { cx: width / 2, cy: height / 2, scale: 1 };
}

