import { dist } from '../engine/math';
import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_COST, TOWER_UPGRADE_DAMAGE_MULT, TOWER_UPGRADE_RATE_MULT } from '../data/towers';
import type { GameState, Tower, Enemy } from './state';
import { newId, spawnFloatingText } from './state';
import { fireTowerProjectile } from './projectile';

export function buyTower(state: GameState, runePointId: number, towerKindId: string): boolean {
  const rp = state.runePoints.find((r) => r.id === runePointId);
  if (!rp || !rp.active || rp.towerId !== null) return false;
  const kind = TOWERS[towerKindId];
  if (!kind) return false;
  const isFirst = state.towers.length === 0;
  const discount = isFirst ? state.metaTowerDiscount : 0;
  const cost = Math.max(0, kind.cost - discount);
  if (state.gold < cost) return false;
  state.gold -= cost;
  const tower: Tower = {
    id: newId(state),
    kind,
    pos: { ...rp.pos },
    runePointId,
    level: isFirst ? state.metaTowerStartLevel : 1,
    fireTimer: 0,
    aimAngle: 0,
    shotCount: 0,
  };
  state.towers.push(tower);
  rp.towerId = tower.id;
  spawnFloatingText(state, kind.name, rp.pos, '#7df9ff');
  return true;
}

export function upgradeTower(state: GameState, towerId: number): boolean {
  const t = state.towers.find((x) => x.id === towerId);
  if (!t) return false;
  if (t.level >= TOWER_MAX_LEVEL) return false;
  if (state.gold < TOWER_UPGRADE_COST) return false;
  state.gold -= TOWER_UPGRADE_COST;
  t.level += 1;
  spawnFloatingText(state, `Lv ${t.level}`, t.pos, '#7df9ff');
  return true;
}

export function towerStats(state: GameState, t: Tower) {
  const damage = t.kind.damage *
    Math.pow(TOWER_UPGRADE_DAMAGE_MULT, t.level - 1) *
    state.modifiers.towerDamageMult;
  const rate = t.kind.fireRate *
    Math.pow(TOWER_UPGRADE_RATE_MULT, t.level - 1) *
    state.modifiers.towerFireRateMult;
  const range = t.kind.range * state.modifiers.towerRangeMult;
  return { damage, rate, range };
}

export function updateTowers(state: GameState, dt: number): void {
  for (const t of state.towers) {
    const stats = towerStats(state, t);
    t.fireTimer -= dt;
    if (t.fireTimer > 0) continue;

    // Find target = nearest enemy within range (closest to mannequin tiebreak).
    let target: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of state.enemies) {
      const d = dist(e.pos, t.pos);
      if (d > stats.range) continue;
      // Prefer closest to mannequin so towers protect the centre.
      const dToCenter = dist(e.pos, state.mannequin.pos);
      if (dToCenter < bestScore) { bestScore = dToCenter; target = e; }
    }
    if (!target) continue;

    t.aimAngle = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    t.fireTimer = 1 / stats.rate;
    t.shotCount += 1;
    fireTowerProjectile(
      state,
      t.pos,
      target,
      stats.damage,
      t.kind.splashRadius,
      t.kind.projectileSpeed,
      t.kind.element,
    );
    // Synchronized Volley: every 4th shot fires twice.
    if (state.modifiers.towerSyncVolley && t.shotCount % 4 === 0) {
      fireTowerProjectile(
        state,
        t.pos,
        target,
        stats.damage,
        t.kind.splashRadius,
        t.kind.projectileSpeed,
        t.kind.element,
      );
    }
  }
}
