const SAVE_KEY = 'asd_meta_v1';

export interface MetaSave {
  blueEssence: number;
  ancientEssence: number;
  purchased: string[];
  bestWave: number;
  totalRuns: number;
}

export function newMetaSave(): MetaSave {
  return {
    blueEssence: 0,
    ancientEssence: 0,
    purchased: [],
    bestWave: 0,
    totalRuns: 0,
  };
}

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newMetaSave();
    const data = JSON.parse(raw) as Partial<MetaSave>;
    return {
      blueEssence: data.blueEssence ?? 0,
      ancientEssence: data.ancientEssence ?? 0,
      purchased: Array.isArray(data.purchased) ? data.purchased : [],
      bestWave: data.bestWave ?? 0,
      totalRuns: data.totalRuns ?? 0,
    };
  } catch {
    return newMetaSave();
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function resetMeta(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
