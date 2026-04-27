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

const SPRITE_SCALE = 2;

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

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
  drawOverloadVfx(ctx);
  drawAimReticle(ctx, state);
  drawFloatingTexts(ctx, state);
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
  for (const rp of state.runePoints) {
    if (rp.towerId !== null) continue; // tower will be drawn over the rune
    const isActive = rp.active;
    const isSelected = state.activeRunePoint === rp.id;

    // Chalk pentagram glyph: a soft circle + 5-point star.
    ctx.save();
    ctx.translate(rp.pos.x, rp.pos.y);

    const baseAlpha = isActive ? 0.55 : 0.18;
    ctx.strokeStyle = isActive ? COLORS.aetherB : COLORS.stoneHi;
    ctx.fillStyle = isActive
      ? `rgba(125, 249, 255, ${0.10 + 0.06 * Math.sin(state.worldTime * 3)})`
      : 'rgba(160, 160, 180, 0.05)';
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = Math.cos(a) * 14;
      const y = Math.sin(a) * 14;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = 1;
    if (isSelected) {
      ctx.strokeStyle = COLORS.brassHi;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTowers(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  for (const t of state.towers) {
    // Range indicator when shop is open on this rune
    if (state.activeRunePoint === t.runePointId) {
      ctx.save();
      ctx.strokeStyle = `rgba(125, 249, 255, 0.18)`;
      ctx.fillStyle = `rgba(125, 249, 255, 0.04)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.kind.range * state.modifiers.towerRangeMult, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow under base.
    drawShadow(ctx, t.pos.x, t.pos.y + 16, 18, 5, 0.4);

    // Base sprite
    let base = s.towerNeedler;
    let barrel = s.towerNeedlerBarrel;
    if (t.kind.id === 'mortar') { base = s.towerMortar; barrel = s.towerMortarBarrel; }
    else if (t.kind.id === 'mercury_sprayer') { base = s.towerMercury; barrel = s.towerMercuryBarrel; }
    else if (t.kind.id === 'acid_injector') { base = s.towerAcid; barrel = s.towerAcidBarrel; }
    drawSprite(ctx, base, t.pos.x, t.pos.y, SPRITE_SCALE);

    // Rotating barrel sprite
    drawSpriteRotated(ctx, barrel, t.pos.x, t.pos.y - 4, t.aimAngle, SPRITE_SCALE);

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

  // Soft loot magnet ring
  const lootR = m.baseLootRadius * state.modifiers.lootRadiusMult;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.10)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(m.pos.x, m.pos.y, lootR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Drop shadow
  drawShadow(ctx, m.pos.x, m.pos.y + 18, 20, 6, 0.5);

  // Idle bob
  const bob = Math.round(Math.sin(state.worldTime * 2.4) * 1);

  if (m.damageFlash > 0) {
    // Tint by drawing a red overlay on top of the sprite.
    drawSprite(ctx, s.mannequin, m.pos.x, m.pos.y + bob, SPRITE_SCALE);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.7, m.damageFlash * 1.5);
    ctx.fillStyle = COLORS.fireC;
    ctx.fillRect(
      m.pos.x - s.mannequin.anchor.x * SPRITE_SCALE,
      m.pos.y + bob - s.mannequin.anchor.y * SPRITE_SCALE,
      s.mannequin.width * SPRITE_SCALE,
      s.mannequin.height * SPRITE_SCALE,
    );
    ctx.restore();
  } else {
    drawSprite(ctx, s.mannequin, m.pos.x, m.pos.y + bob, SPRITE_SCALE);
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  const s = getSprites();
  for (const e of state.enemies) {
    // Drop shadow
    drawShadow(ctx, e.pos.x, e.pos.y + e.kind.radius * 0.65, e.kind.radius * 0.85, e.kind.radius * 0.3);

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

    // White hit flash
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
    }

    // Status overlays
    if (e.status.burnTime > 0) {
      // small pixel flame puff above
      ctx.fillStyle = COLORS.fireA;
      ctx.fillRect(e.pos.x - 1, e.pos.y - e.kind.radius - 6, 2, 2);
      ctx.fillStyle = COLORS.fireB;
      ctx.fillRect(e.pos.x - 2, e.pos.y - e.kind.radius - 4, 4, 2);
    }
    if (e.status.slowTime > 0) {
      ctx.strokeStyle = `rgba(189, 246, 255, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.status.armorBreakTime > 0) {
      ctx.strokeStyle = `rgba(210, 245, 90, 0.5)`;
      ctx.lineWidth = 1;
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
  for (const p of state.projectiles) {
    if (p.kind === 'potion') {
      const trailColors: Record<string, string> = {
        fire: 'rgba(255, 140, 58, 0.25)',
        mercury: 'rgba(201, 201, 216, 0.25)',
        acid: 'rgba(210, 245, 90, 0.25)',
      };
      ctx.fillStyle = trailColors[p.element] ?? 'rgba(125, 249, 255, 0.25)';
      ctx.fillRect(
        Math.round(p.pos.x - 3 - p.vel.x * 0.02),
        Math.round(p.pos.y - 3 - p.vel.y * 0.02),
        6,
        6,
      );
      let sprite = s.potionBottle;
      if (p.element === 'fire') sprite = s.potionBottleFire;
      else if (p.element === 'mercury') sprite = s.potionBottleMercury;
      else if (p.element === 'acid') sprite = s.potionBottleAcid;
      drawSprite(ctx, sprite, p.pos.x, p.pos.y, SPRITE_SCALE);
    } else {
      const angle = Math.atan2(p.vel.y, p.vel.x);
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

function drawAimReticle(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'wave' && state.phase !== 'preparing') return;
  drawReticle(ctx, state.aim.x, state.aim.y);
}

function drawOverloadVfx(ctx: CanvasRenderingContext2D): void {
  const eff = getActiveEffect();
  if (!eff) return;
  const alpha = Math.max(0, 1 - eff.age / 0.45);
  for (let i = 0; i < eff.lightningChain.length - 1; i++) {
    const a = eff.lightningChain[i]!;
    const b = eff.lightningChain[i + 1]!;
    drawZigzagBolt(ctx, a.x, a.y, b.x, b.y, alpha, eff.age * 100 + i);
  }
  // Flash dot at endpoints
  ctx.fillStyle = `rgba(189, 246, 255, ${alpha})`;
  for (const p of eff.lightningChain) {
    ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
  }
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.floatingTexts) {
    const alpha = Math.max(0, t.life / 0.8);
    drawPixelFloatingText(ctx, t.text, t.pos.x, t.pos.y, t.color, alpha);
  }
}

