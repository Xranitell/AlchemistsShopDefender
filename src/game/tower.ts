import { dist } from '../engine/math';
import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_MULT, TOWER_UPGRADE_RATE_MULT, towerUpgradeCost, WATCH_TOWER_AURA, ETHER_COIL_CHAIN } from '../data/towers';
import type { GameState, TargetingMode, Tower, Enemy } from './state';
import { newId, spawnFloatingText } from './state';
import { fireTowerProjectile, applyDamageToEnemy } from './projectile';

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
  // Archmaster legendary: +25% cost on every new tower.
  const archmaster = state.modifiers.archmasterActive;
  const baseCost = Math.max(0, kind.cost - discount);
  const cost = archmaster ? Math.ceil(baseCost * 1.25) : baseCost;
  if (state.gold < cost) return false;
  state.gold -= cost;
  const baseLevel = isFirst ? state.metaTowerStartLevel : 1;
  // Archmaster legendary: every new tower spawns at least at level 2.
  const startLevel = archmaster ? Math.max(baseLevel, 2) : baseLevel;
  const tower: Tower = {
    id: newId(state),
    kind,
    pos: { ...rp.pos },
    runePointId,
    level: startLevel,
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
  let damage = t.kind.damage *
    Math.pow(TOWER_UPGRADE_DAMAGE_MULT, t.level - 1) *
    state.modifiers.towerDamageMult;
  let baseRate = t.kind.fireRate *
    Math.pow(TOWER_UPGRADE_RATE_MULT, t.level - 1) *
    state.modifiers.towerFireRateMult;
  let baseRange = t.kind.range * state.modifiers.towerRangeMult;

  // GDD §7.4: rune-point kind buffs the tower placed on it.
  const rp = state.runePoints.find((r) => r.id === t.runePointId);
  if (rp) {
    const bonus = runeKindMultipliers(rp, state.worldTime);
    damage *= bonus.damage;
    baseRate *= bonus.rate;
    baseRange *= bonus.range;
  }

  // Сторожевой фонарь aura: each watch tower whose range covers `t` adds its
  // multipliers. Aura towers don't buff themselves and don't stack with copies
  // of themselves on the same rune (only one tower per rune anyway).
  let rateMult = 1;
  let rangeMult = 1;
  for (const other of state.towers) {
    if (other.id === t.id) continue;
    if (other.kind.behavior !== 'aura') continue;
    const auraRange = other.kind.range * state.modifiers.towerRangeMult;
    if (dist(other.pos, t.pos) > auraRange) continue;
    rateMult *= WATCH_TOWER_AURA.fireRateMult;
    rangeMult *= WATCH_TOWER_AURA.rangeMult;
  }
  return { damage, rate: baseRate * rateMult, range: baseRange * rangeMult };
}

/** Lookup the multipliers granted by a rune point's kind. The `unstable`
 *  kind cycles three buffs every `UNSTABLE_PERIOD` seconds. Other kinds
 *  return a fixed multiplier triple. */
export function runeKindMultipliers(
  rp: { kind: import('./state').RunePointKind; unstablePhase: number },
  worldTime: number,
): { damage: number; rate: number; range: number } {
  switch (rp.kind) {
    case 'reinforced':
      return { damage: 1.20, rate: 1.0, range: 1.0 };
    case 'resonant':
      // Range buff so reaction-prone elemental towers reach further; the
      // reaction damage bonus is handled in reactions.ts.
      return { damage: 1.0, rate: 1.0, range: 1.10 };
    case 'defensive':
      // Defensive runes trade attack for area control: slightly slower but
      // bigger range so towers cover more of the path.
      return { damage: 1.0, rate: 0.95, range: 1.20 };
    case 'unstable': {
      // 3 buffs of 4s each → 12s cycle. Each window favours one stat.
      const period = 12;
      const t = ((worldTime + rp.unstablePhase) % period + period) % period;
      if (t < 4) return { damage: 1.40, rate: 1.0, range: 1.0 };
      if (t < 8) return { damage: 1.0, rate: 1.40, range: 1.0 };
      return { damage: 1.0, rate: 1.0, range: 1.30 };
    }
    case 'normal':
    default:
      return { damage: 1, rate: 1, range: 1 };
  }
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
            || e.status.aetherMarkTime > 0
            || e.status.frostMarkTime > 0
            || e.status.poisonTime > 0;
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
  // Tick chain bolts (visual-only, damage already applied at spawn).
  for (let i = state.chainBolts.length - 1; i >= 0; i--) {
    const cb = state.chainBolts[i]!;
    cb.time -= dt;
    if (cb.time <= 0) state.chainBolts.splice(i, 1);
  }

  for (const t of state.towers) {
    // Aura towers (Сторожевой фонарь) never fire, but they keep ticking the
    // fire timer so the visual idle-rotation can still use it.
    if (t.kind.behavior === 'aura') {
      t.fireTimer = Math.max(0, t.fireTimer - dt);
      // Slow idle rotation of the lantern.
      t.aimAngle = (t.aimAngle + dt * 0.6) % (Math.PI * 2);
      continue;
    }

    const stats = towerStats(state, t);
    t.fireTimer -= dt;
    if (t.fireTimer > 0) continue;

    const target = pickTowerTarget(state, t, stats.range);
    if (!target) continue;

    t.aimAngle = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    t.fireTimer = 1 / Math.max(0.0001, stats.rate);
    t.shotCount += 1;

    if (t.kind.behavior === 'chain') {
      fireChainLightning(state, t, target, stats.damage);
      // Synchronized Volley still applies — re-zap the same primary chain.
      if (state.modifiers.towerSyncVolley && t.shotCount % 4 === 0) {
        fireChainLightning(state, t, target, stats.damage);
      }
      continue;
    }

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

/** Эфирная катушка primary attack. Chains from `tower` → `primary` → up to
 *  `ETHER_COIL_CHAIN.hops` additional enemies, dealing decreasing damage with
 *  each hop. Each hop is independently selected so the bolt picks the closest
 *  unhit enemy at every step. Visual segments are pushed to `state.chainBolts`. */
function fireChainLightning(
  state: GameState,
  tower: Tower,
  primary: Enemy,
  baseDamage: number,
): void {
  const hit = new Set<number>();
  hit.add(primary.id);
  // Primary hit
  applyDamageToEnemy(state, primary, baseDamage, tower.kind.element);
  pushBolt(state, tower.pos, primary.pos, 0);

  let current: Enemy = primary;
  let dmg = baseDamage;
  for (let h = 0; h < ETHER_COIL_CHAIN.hops; h++) {
    dmg *= ETHER_COIL_CHAIN.falloff;
    let next: Enemy | null = null;
    let nextD = ETHER_COIL_CHAIN.range;
    for (const e of state.enemies) {
      if (hit.has(e.id)) continue;
      const d = dist(e.pos, current.pos);
      if (d <= nextD) { nextD = d; next = e; }
    }
    if (!next) break;
    hit.add(next.id);
    applyDamageToEnemy(state, next, dmg, tower.kind.element);
    pushBolt(state, current.pos, next.pos, h + 1);
    current = next;
  }
}

function pushBolt(state: GameState, from: { x: number; y: number }, to: { x: number; y: number }, hop: number): void {
  state.chainBolts.push({
    id: newId(state),
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    time: 0.18,
    maxTime: 0.18,
    hop,
  });
}
