const SAVE_KEY = 'asd_meta_v2';

export interface MetaSave {
  blueEssence: number;
  ancientEssence: number;
  keys: number;
  purchased: string[];
  bestWave: number;
  totalRuns: number;
  // Daily rewards
  dailyDay: number;
  dailyLastClaim: string;
  // Battle pass
  bpLevel: number;
  bpXp: number;
  bpPremium: boolean;
  bpClaimedFree: number[];
  bpClaimedPremium: number[];
  // Extra rerolls from daily rewards
  bonusRerolls: number;
  // Crafting level (shop upgrades)
  craftingLevel: number;
}

export function newMetaSave(): MetaSave {
  return {
    blueEssence: 0,
    ancientEssence: 0,
    keys: 0,
    purchased: [],
    bestWave: 0,
    totalRuns: 0,
    dailyDay: 0,
    dailyLastClaim: '',
    bpLevel: 0,
    bpXp: 0,
    bpPremium: false,
    bpClaimedFree: [],
    bpClaimedPremium: [],
    bonusRerolls: 0,
    craftingLevel: 1,
  };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    // Also try migrating from v1
    const rawV1 = !raw ? localStorage.getItem('asd_meta_v1') : null;
    const source = raw ?? rawV1;
    if (!source) return newMetaSave();
    const data = JSON.parse(source) as Partial<MetaSave>;
    const result: MetaSave = {
      blueEssence: data.blueEssence ?? 0,
      ancientEssence: data.ancientEssence ?? 0,
      keys: data.keys ?? 0,
      purchased: Array.isArray(data.purchased) ? data.purchased : [],
      bestWave: data.bestWave ?? 0,
      totalRuns: data.totalRuns ?? 0,
      dailyDay: data.dailyDay ?? 0,
      dailyLastClaim: data.dailyLastClaim ?? '',
      bpLevel: data.bpLevel ?? 0,
      bpXp: data.bpXp ?? 0,
      bpPremium: data.bpPremium ?? false,
      bpClaimedFree: Array.isArray(data.bpClaimedFree) ? data.bpClaimedFree : [],
      bpClaimedPremium: Array.isArray(data.bpClaimedPremium) ? data.bpClaimedPremium : [],
      bonusRerolls: data.bonusRerolls ?? 0,
      craftingLevel: data.craftingLevel ?? 1,
    };
    // If migrated from v1, save as v2
    if (rawV1 && !raw) {
      saveMeta(result);
    }
    return result;
  } catch {
    return newMetaSave();
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
  } catch {
    // localStorage may be unavailable
  }
}

export function resetMeta(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('asd_meta_v1');
  } catch {
    // ignore
  }
}

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function canClaimDaily(meta: MetaSave): boolean {
  return meta.dailyLastClaim !== todayString();
}
