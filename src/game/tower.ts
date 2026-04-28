import { dist } from '../engine/math';
import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_MULT, TOWER_UPGRADE_RATE_MULT, towerUpgradeCost } from '../data/towers';
import type { GameState, TargetingMode, Tower, Enemy } from './state';
import { newId, spawnFloatingText } from './state';
import { fireTowerProjectile } from './projectile';

export const TARGETING_MODES: TargetingMode[] = ['nearest', 'strongest', 'fastest', 'debuffed', 'first'];

export function targetingModeLabel(m: TargetingMode): string {
  switch (m) {
    case 'nearest': return 'Ближайший';
    case 'strongest': return 'Сильнейший';
    case 'fastest': return 'Быстрейший';
    case 'debuffed': return 'Под дебаффом';
    case 'first': return 'Первый по маршруту';
  }
}

export function cycleTargetingMode(t: Tower): void {
  const i = TARGETING_MODES.indexOf(t.targetingMode);
  t.targetingMode = TARGETING_MODES[(i + 1) % TARGETING_MODES.length]!;
}

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
    targetingMode: 'nearest',
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
  const cost = towerUpgradeCost(t.level);
  if (state.gold < cost) return false;
  state.gold -= cost;
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

function pickTowerTarget(state: GameState, t: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestScore = -Infinity;
  for (const e of state.enemies) {
    const d = dist(e.pos, t.pos);
    if (d > range) continue;
    let score = 0;
    switch (t.targetingMode) {
      case 'nearest':
        // "nearest to mannequin" — higher score = closer to mannequin.
        score = -dist(e.pos, state.mannequin.pos);
        break;
      case 'strongest':
        // Highest current HP wins.
        score = e.hp;
        break;
      case 'fastest':
        // Highest base speed (ignore slow factor so stacking slows doesn't
        // thrash targeting).
        score = e.kind.speed;
        break;
      case 'debuffed':
        // Any enemy with an active debuff gets a big bonus; within debuffed
        // enemies, prefer the nearest to mannequin.
        {
          const hasDebuff = e.status.burnTime > 0
            || e.status.slowTime > 0
            || e.status.armorBreakTime > 0
            || e.status.aetherMarkTime > 0;
          score = (hasDebuff ? 10000 : 0) - dist(e.pos, state.mannequin.pos);
        }
        break;
      case 'first':
        // "First along the path" = closest to mannequin (most progress).
        score = -dist(e.pos, state.mannequin.pos);
        break;
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

export function updateTowers(state: GameState, dt: number): void {
  for (const t of state.towers) {
    const stats = towerStats(state, t);
    t.fireTimer -= dt;
    if (t.fireTimer > 0) continue;

    const target = pickTowerTarget(state, t, stats.range);
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
