export type AgeGroup = 7 | 9;

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type CognitivePillar =
  | 'system'
  | 'inhibitory'
  | 'memory'
  | 'spatial3d'
  | 'sandbox';

export type GameScreenState = 'title' | 'map' | 'playing' | 'paused' | 'victory';

export type MedalShape =
  | 'prism'
  | 'compass'
  | 'crescent'
  | 'comet'
  | 'astrolabe'
  | 'nexus'
  | 'tesseract'
  | 'nova';

export interface StageDescriptor {
  stage: StageNumber;
  pillar: CognitivePillar;
  medalShape: MedalShape;
  accentHex: string;
}

export interface AgeProgress {
  highestUnlocked: StageNumber;
  earnedMedals: StageNumber[];
}

export interface AllProgress {
  7: AgeProgress;
  9: AgeProgress;
  muted: boolean;
}
