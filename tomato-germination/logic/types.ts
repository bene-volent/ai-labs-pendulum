// experiments/biology/tomato/logic/types.ts
// Shared TypeScript interfaces for tomato experiment (inputs, outputs, training rows)

export type PhenologyStage =
  | "seed"
  | "germination"
  | "seedling"
  | "vegetative"
  | "flowering"
  | "fruit_set"
  | "fruit_development"
  | "ripening";

export interface TomatoParams {
  // Environment (daily-averaged scalar controls — frontend may allow daily arrays later)
  avgTempC: number;         // °C
  soilMoisturePct: number;  // 0..100
  sunlightHours: number;    // 0..14
  soilN: number;            // 0..100 (nutrient proxy)
  pestPressure: number;     // 0..10
  days?: number;            // simulation length (default 90)
  variety?: string;         // optional string
  randomSeed?: number;      // optional deterministic seed
}

export interface TomatoDayState {
  day: number;
  avgTempC: number;
  soilMoisturePct: number;
  sunlightHours: number;
  soilN: number;
  pestPressure: number;

  GDD_today: number;
  GDD_cum: number;

  stage: PhenologyStage;
  germinatedPct: number;      // 0..100
  heightCm: number;
  leafCount: number;
  flowering: boolean;
  fruitCount: number;
  healthIndex: number;        // 0..1
}

export interface TomatoRunSummary {
  runId: string;
  params: TomatoParams;
  timeSeries: TomatoDayState[];
}

export interface SyntheticRow {
  runId: string;
  avgTempC: number;
  soilMoisturePct: number;
  sunlightHours: number;
  soilN: number;
  pestPressure: number;
  targetDay: number;
  heightCm: number;
  leafCount: number;
  stage: PhenologyStage;
  fruitCount: number;
}

export interface TrainSample {
  avgTempC: number;
  soilMoisturePct: number;
  sunlightHours: number;
  soilN: number;
  pestPressure: number;
  targetDay: number;
  heightCm: number;
}
