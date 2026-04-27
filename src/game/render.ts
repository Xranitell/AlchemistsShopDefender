import type { GameState } from './state';
import { TOWERS } from '../data/towers';
import { getActiveEffect } from './overload';

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.arena;
  ctx.clearRect(0, 0, width, height);

  drawArenaBackground(ctx, state);
  drawEntrances(ctx, state);
  drawFirePools(ctx, state);
  drawRunePoints(ctx, state);
  drawGoldPickups(ctx, state);
  drawEnemies(ctx, state);
  drawTowers(ctx, state);
  drawMannequin(ctx, state);
  drawProjectiles(ctx, state);
  drawOverloadVfx(ctx);
  drawAimReticle(ctx, state);
  drawFloatingTexts(ctx, state);
}

function drawArenaBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, center } = state.arena;
  const grad = ctx.createRadialGradient(center.x, center.y, 60, center.x, center.y, 540);
  grad.addColorStop(0, '#1f1936');
  grad.addColorStop(1, '#0d0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Concentric arena rings.
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let r = 80; r < 360; r += 40) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEntrances(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const e of state.entrances) {
    const radius = 22;
    if (e.active) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(state.worldTime * 4));
      ctx.fillStyle = `rgba(255, 106, 61, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6a3d';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.18)';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRunePoints(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const rp of state.runePoints) {
    if (!rp.active && rp.towerId === null) {
      ctx.strokeStyle = 'rgba(154, 147, 179, 0.3)';
      ctx.fillStyle = 'rgba(154, 147, 179, 0.08)';
    } else if (rp.towerId !== null) {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.45)';
      ctx.fillStyle = 'rgba(125, 249, 255, 0.10)';
    } else {
      ctx.strokeStyle = '#7df9ff';
      ctx.fillStyle = 'rgba(125, 249, 255, 0.16)';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rp.pos.x, rp.pos.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hint at active rune point ring (selectable).
    if (state.activeRunePoint === rp.id) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rp.pos.x, rp.pos.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawTowers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.towers) {
    // Range circle on hover (simple: when active rune is the tower's rune).
    if (state.activeRunePoint === t.runePointId) {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.kind.range * state.modifiers.towerRangeMult, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Body
    ctx.fillStyle = TOWERS[t.kind.id]!.color;
    ctx.strokeStyle = '#0d0a14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Barrel.
    const len = 18;
    ctx.strokeStyle = '#e8e3f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t.pos.x, t.pos.y);
    ctx.lineTo(t.pos.x + Math.cos(t.aimAngle) * len, t.pos.y + Math.sin(t.aimAngle) * len);
    ctx.stroke();
    // Level pips.
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(t.pos.x - 10 + i * 8, t.pos.y + 22, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMannequin(ctx: CanvasRenderingContext2D, state: GameState): void {
  const m = state.mannequin;
  // Body.
  ctx.fillStyle = m.damageFlash > 0 ? '#ff6a3d' : '#c084fc';
  ctx.strokeStyle = '#0d0a14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.pos.x, m.pos.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eye glow.
  ctx.fillStyle = '#7df9ff';
  ctx.beginPath();
  ctx.arc(m.pos.x, m.pos.y - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Loot magnet ring (subtle).
  const lootR = m.baseLootRadius * state.modifiers.lootRadiusMult;
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.10)';
  ctx.beginPath();
  ctx.arc(m.pos.x, m.pos.y, lootR, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const e of state.enemies) {
    // Body.
    if (e.hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = e.kind.color;
    }
    ctx.strokeStyle = e.kind.isBoss ? '#ff6a3d' : '#0d0a14';
    ctx.lineWidth = e.kind.isBoss ? 3 : 2;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, e.kind.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Status overlays.
    if (e.status.burnTime > 0) {
      ctx.strokeStyle = 'rgba(255, 106, 61, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.status.slowTime > 0) {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.kind.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar.
    if (e.hp < e.maxHp) {
      const w = Math.max(20, e.kind.radius * 2.4);
      const x = e.pos.x - w / 2;
      const y = e.pos.y - e.kind.radius - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = '#ff6a3d';
      ctx.fillRect(x, y, (e.hp / e.maxHp) * w, 4);
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.projectiles) {
    if (p.kind === 'potion') {
      ctx.fillStyle = p.element === 'fire' ? '#ff8c5a' : '#7df9ff';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFirePools(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const fp of state.firePools) {
    const alpha = Math.min(0.55, fp.time / 3 * 0.55);
    const grad = ctx.createRadialGradient(fp.pos.x, fp.pos.y, 4, fp.pos.x, fp.pos.y, fp.radius);
    grad.addColorStop(0, `rgba(255, 184, 107, ${alpha + 0.15})`);
    grad.addColorStop(1, `rgba(255, 106, 61, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fp.pos.x, fp.pos.y, fp.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoldPickups(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const g of state.goldPickups) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(g.pos.x, g.pos.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAimReticle(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'wave' && state.phase !== 'preparing') return;
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(state.aim.x, state.aim.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(state.aim.x - 18, state.aim.y);
  ctx.lineTo(state.aim.x - 8, state.aim.y);
  ctx.moveTo(state.aim.x + 8, state.aim.y);
  ctx.lineTo(state.aim.x + 18, state.aim.y);
  ctx.moveTo(state.aim.x, state.aim.y - 18);
  ctx.lineTo(state.aim.x, state.aim.y - 8);
  ctx.moveTo(state.aim.x, state.aim.y + 8);
  ctx.lineTo(state.aim.x, state.aim.y + 18);
  ctx.stroke();
}

function drawOverloadVfx(ctx: CanvasRenderingContext2D): void {
  const eff = getActiveEffect();
  if (!eff) return;
  const alpha = 1 - eff.age / 0.45;
  ctx.strokeStyle = `rgba(125, 249, 255, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < eff.lightningChain.length - 1; i++) {
    const a = eff.lightningChain[i]!;
    const b = eff.lightningChain[i + 1]!;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.font = 'bold 14px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  for (const t of state.floatingTexts) {
    ctx.fillStyle = t.color;
    ctx.globalAlpha = Math.max(0, t.life / 0.8);
    ctx.fillText(t.text, t.pos.x, t.pos.y);
  }
  ctx.globalAlpha = 1;
}
