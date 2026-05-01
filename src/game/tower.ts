
import { TOWERS, TOWER_MAX_LEVEL, TOWER_UPGRADE_DAMAGE_MULT, TOWER_UPGRADE_RATE_MULT, towerUpgradeCost, WATCH_TOWER_AURA, ETHER_COIL_CHAIN, towerName } from '../data/towers';
import type { GameState, TargetingMode, Tower, Enemy } from './state';
import { newId, spawnFloatingText } from './state';
import { fireTowerProjectile, applyDamageToEnemy } from './projectile';
import { tutorial } from '../ui/tutorial';
import { t } from '../i18n';
import {
  towerFireRateMultiplier,
  towerRangeMultiplier,
  towerDamageMultiplier,
} from './potions';

export const TARGETING_MODES: TargetingMode[] = ['nearest', 'strongest', 'fastest', 'debuffed', 'first'];

export function targetingModeLabel(m: TargetingMode): string {
  return t(`ui.tower.targeting.${m}`);
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
  // Archmaster legendary: +25% cost on every new tower. Cursed Cards may
  // additionally raise `towerCostMult` (e.g. Acid Tips Pact).
  const archmaster = state.modifiers.archmasterActive;
  const baseCost = Math.max(0, kind.cost - discount);
  const archmasterMult = archmaster ? 1.25 : 1;
  const cost = Math.ceil(baseCost * archmasterMult * state.modifiers.towerCostMult);
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
  invalidateTowerCaches();
  spawnFloatingText(state, towerName(kind), rp.pos, '#7df9ff');
  tutorial.notify('towerPlaced');
  return true;
}

export function sellTower(state: GameState, towerId: number): boolean {
  const idx = state.towers.findIndex((x) => x.id === towerId);
  if (idx < 0) return false;
  const tower = state.towers[idx]!;
  const rp = state.runePoints.find((r) => r.id === tower.runePointId);
  const baseCost = tower.kind.cost;
  let totalInvested = baseCost;
  for (let lvl = 1; lvl < tower.level; lvl++) {
    totalInvested += towerUpgradeCost(lvl);
  }
  const refund = Math.floor(totalInvested * 0.5);
  state.gold += refund;
  state.towers.splice(idx, 1);
  if (rp) rp.towerId = null;
  invalidateTowerCaches();
  spawnFloatingText(state, `+${refund}g`, tower.pos, '#ffd166');
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
  tutorial.notify('towerUpgraded');
  return true;
}

/** Per-frame cache: rune-point lookup keyed by `state.runePoints` reference
 *  and a count of aura towers, so we can skip the inner aura loop entirely
 *  when no Сторожевой фонарь is on the field. */
let cachedRunePoints: GameState['runePoints'] | null = null;
let cachedRuneById: Map<number, GameState['runePoints'][number]> | null = null;
let cachedAuraCount = -1;
let cachedTowers: GameState['towers'] | null = null;

export function invalidateTowerCaches(): void {
  cachedRunePoints = null;
  cachedRuneById = null;
  cachedAuraCount = -1;
  cachedTowers = null;
}

function getRuneById(state: GameState, id: number): GameState['runePoints'][number] | undefined {
  if (cachedRunePoints !== state.runePoints || !cachedRuneById) {
    cachedRunePoints = state.runePoints;
    cachedRuneById = new Map();
    for (const rp of state.runePoints) cachedRuneById.set(rp.id, rp);
  }
  return cachedRuneById.get(id);
}

function getAuraCount(state: GameState): number {
  if (cachedTowers !== state.towers || cachedAuraCount < 0) {
    cachedTowers = state.towers;
    let n = 0;
    for (const t of state.towers) if (t.kind.behavior === 'aura') n++;
    cachedAuraCount = n;
  }
  return cachedAuraCount;
}

export function towerStats(state: GameState, t: Tower) {
  let damage = t.kind.damage *
    Math.pow(TOWER_UPGRADE_DAMAGE_MULT, t.level - 1) *
    state.modifiers.towerDamageMult *
    towerDamageMultiplier(state);
  let baseRate = t.kind.fireRate *
    Math.pow(TOWER_UPGRADE_RATE_MULT, t.level - 1) *
    state.modifiers.towerFireRateMult *
    towerFireRateMultiplier(state);
  let baseRange = t.kind.range * state.modifiers.towerRangeMult * towerRangeMultiplier(state);

  // GDD §7.4: rune-point kind buffs the tower placed on it.
  const rp = getRuneById(state, t.runePointId);
  if (rp) {
    const bonus = runeKindMultipliers(rp, state.worldTime);
    damage *= bonus.damage;
    baseRate *= bonus.rate;
    baseRange *= bonus.range;
  }

  // Сторожевой фонарь aura: each watch tower whose range covers `t` adds its
  // multipliers. Aura towers don't buff themselves and don't stack with copies
  // of themselves on the same rune (only one tower per rune anyway). We skip
  // the loop entirely when there are no aura towers — the common case.
  let rateMult = 1;
  let rangeMult = 1;
  if (getAuraCount(state) > 0) {
    const rangeMod = state.modifiers.towerRangeMult * towerRangeMultiplier(state);
    for (const other of state.towers) {
      if (other.id === t.id) continue;
      if (other.kind.behavior !== 'aura') continue;
      const auraRange = other.kind.range * rangeMod;
      const dx = other.pos.x - t.pos.x;
      const dy = other.pos.y - t.pos.y;
      if (dx * dx + dy * dy > auraRange * auraRange) continue;
      rateMult *= WATCH_TOWER_AURA.fireRateMult;
      rangeMult *= WATCH_TOWER_AURA.rangeMult;
    }
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
  const range2 = range * range;
  const mode = t.targetingMode;
  const mx = state.mannequin.pos.x;
  const my = state.mannequin.pos.y;
  for (const e of state.enemies) {
    const dx = e.pos.x - t.pos.x;
    const dy = e.pos.y - t.pos.y;
    if (dx * dx + dy * dy > range2) continue;
    let score = 0;
    switch (mode) {
      case 'nearest':
      case 'first':
        // "nearest to mannequin" / "first along path" — higher score = closer
        // to mannequin. We compare by squared distance (monotonic) so we can
        // skip the per-enemy sqrt; the relative ordering is preserved.
        {
          const dmx = e.pos.x - mx;
          const dmy = e.pos.y - my;
          score = -(dmx * dmx + dmy * dmy);
        }
        break;
      case 'strongest':
        score = e.hp;
        break;
      case 'fastest':
        score = e.kind.speed;
        break;
      case 'debuffed': {
        const hasDebuff = e.status.burnTime > 0
          || e.status.slowTime > 0
          || e.status.armorBreakTime > 0
          || e.status.aetherMarkTime > 0
          || e.status.frostMarkTime > 0
          || e.status.poisonTime > 0;
        const dmx = e.pos.x - mx;
        const dmy = e.pos.y - my;
        score = (hasDebuff ? 10000 : 0) - (dmx * dmx + dmy * dmy);
        break;
      }
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
    let nextD2 = ETHER_COIL_CHAIN.range * ETHER_COIL_CHAIN.range;
    for (const e of state.enemies) {
      if (hit.has(e.id)) continue;
      const dx = e.pos.x - current.pos.x;
      const dy = e.pos.y - current.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= nextD2) { nextD2 = d2; next = e; }
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
