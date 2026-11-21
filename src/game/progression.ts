import { AgeGroup, AgeProgress, AllProgress, StageDescriptor, StageNumber } from './types';

export const TOTAL_STAGES = 28;

export const STAGE_DESCRIPTORS: StageDescriptor[] = [
  { stage: 1, pillar: 'system', medalShape: 'prism', accentHex: '#22EBFF' },
  { stage: 2, pillar: 'inhibitory', medalShape: 'compass', accentHex: '#FFD23F' },
  { stage: 3, pillar: 'memory', medalShape: 'crescent', accentHex: '#B378FF' },
  { stage: 4, pillar: 'sandbox', medalShape: 'comet', accentHex: '#2DF59A' },
  { stage: 5, pillar: 'system', medalShape: 'astrolabe', accentHex: '#FF4EC6' },
  { stage: 6, pillar: 'inhibitory', medalShape: 'nexus', accentHex: '#FF8A3D' },
  { stage: 7, pillar: 'spatial3d', medalShape: 'tesseract', accentHex: '#C77DFF' },
  { stage: 8, pillar: 'sandbox', medalShape: 'nova', accentHex: '#38F2B0' },
  { stage: 9, pillar: 'system', medalShape: 'spire', accentHex: '#22EBFF' },
  { stage: 10, pillar: 'inhibitory', medalShape: 'quasar', accentHex: '#FFD23F' },
  { stage: 11, pillar: 'memory', medalShape: 'vortex', accentHex: '#B378FF' },
  { stage: 12, pillar: 'spatial3d', medalShape: 'helix', accentHex: '#FF4EC6' },
  { stage: 13, pillar: 'sandbox', medalShape: 'monolith', accentHex: '#2DF59A' },
  { stage: 14, pillar: 'system', medalShape: 'eclipse', accentHex: '#48F0FF' },
  { stage: 15, pillar: 'inhibitory', medalShape: 'hypercube', accentHex: '#FF9E44' },
  { stage: 16, pillar: 'memory', medalShape: 'pulsar', accentHex: '#D08BFF' },
  { stage: 17, pillar: 'spatial3d', medalShape: 'zenith', accentHex: '#FF66D6' },
  { stage: 18, pillar: 'sandbox', medalShape: 'infinity', accentHex: '#2DF59A' },
  { stage: 19, pillar: 'system', medalShape: 'constellation', accentHex: '#22EBFF' },
  { stage: 20, pillar: 'inhibitory', medalShape: 'sentinel', accentHex: '#FFD23F' },
  { stage: 21, pillar: 'memory', medalShape: 'aurora', accentHex: '#B378FF' },
  { stage: 22, pillar: 'spatial3d', medalShape: 'crown', accentHex: '#FF4EC6' },
  { stage: 23, pillar: 'sandbox', medalShape: 'singularity', accentHex: '#2DF59A' },
  { stage: 24, pillar: 'system', medalShape: 'prism_array', accentHex: '#48F0FF' },
  { stage: 25, pillar: 'inhibitory', medalShape: 'chrono_lock', accentHex: '#FF9E44' },
  { stage: 26, pillar: 'memory', medalShape: 'nebula_web', accentHex: '#D08BFF' },
  { stage: 27, pillar: 'spatial3d', medalShape: 'celestial_orb', accentHex: '#FF66D6' },
  { stage: 28, pillar: 'sandbox', medalShape: 'supernova', accentHex: '#FFD23F' },
];

export const STORAGE_KEY = 'astral_mind_lab_progress_v1';

export function createInitialAgeProgress(): AgeProgress {
  return {
    highestUnlocked: 1,
    earnedMedals: [],
  };
}

export function createInitialProgress(): AllProgress {
  return {
    7: createInitialAgeProgress(),
    9: createInitialAgeProgress(),
    muted: false,
  };
}

export function completeStageInProgress(
  progress: AllProgress,
  age: AgeGroup,
  stage: StageNumber
): AllProgress {
  const current = progress[age];
  const earnedSet = new Set<StageNumber>(current.earnedMedals);
  earnedSet.add(stage);

  const nextUnlocked =
    stage >= current.highestUnlocked && stage < TOTAL_STAGES
      ? ((stage + 1) as StageNumber)
      : current.highestUnlocked;

  return {
    ...progress,
    [age]: {
      highestUnlocked: nextUnlocked,
      earnedMedals: Array.from(earnedSet).sort((a, b) => a - b) as StageNumber[],
    },
  };
}

export function isStageUnlocked(progress: AllProgress, age: AgeGroup, stage: StageNumber): boolean {
  return stage <= progress[age].highestUnlocked;
}

export function hasEarnedMedal(progress: AllProgress, age: AgeGroup, stage: StageNumber): boolean {
  return progress[age].earnedMedals.includes(stage);
}

export function loadProgress(storage?: Pick<Storage, 'getItem'>): AllProgress {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return createInitialProgress();
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<AllProgress> | null;
    if (!parsed || typeof parsed !== 'object') return createInitialProgress();
    const sanitizeAge = (rawAge?: Partial<AgeProgress>): AgeProgress => {
      const highest =
        typeof rawAge?.highestUnlocked === 'number' &&
        rawAge.highestUnlocked >= 1 &&
        rawAge.highestUnlocked <= TOTAL_STAGES
          ? (Math.floor(rawAge.highestUnlocked) as StageNumber)
          : 1;
      const medals = Array.isArray(rawAge?.earnedMedals)
        ? (Array.from(
            new Set(
              rawAge.earnedMedals.filter(
                (n): n is StageNumber =>
                  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TOTAL_STAGES
              )
            )
          ).sort((a, b) => a - b) as StageNumber[])
        : [];
      return { highestUnlocked: highest, earnedMedals: medals };
    };

    return {
      7: sanitizeAge(parsed[7]),
      9: sanitizeAge(parsed[9]),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(
  progress: AllProgress,
  storage?: Pick<Storage, 'setItem'>
): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return;
    target.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota or iframe SecurityError silently
  }
}
