// experiments/biology/tomato/logic/sim.ts
// Tomato phenology simulator (90-day default). Exports simulateTomato and dataset generator.

import {
  TomatoParams,
  TomatoDayState,
  TomatoRunSummary,
  SyntheticRow,
} from "./types";
import {
  mulberry32,
  dailyGDD,
  moistureMultiplier,
  lightMultiplier,
  nutrientMultiplier,
  pestMultiplier,
  biomassToHeightCm,
  biomassToLeafCount,
  stageFromGDD,
} from "./helpers";

/* -------------------------
   Default constants
   ------------------------- */
const DEFAULT_DAYS = 90;
const DEFAULT_SEEDS = 10;

/* -------------------------
   simulateTomato(params)
   - daily timestep
   - GDD-driven stage transitions
   - biomass logistic-like growth modulated by environment multipliers
   - returns array of TomatoDayState for each day (day 1..N)
   ------------------------- */
export function simulateTomato(params: TomatoParams): TomatoDayState[] {
  const rng = mulberry32(params.randomSeed ?? Date.now() % 1e9);
  const days = Math.max(1, Math.floor(params.days ?? DEFAULT_DAYS));
  const avgTempC = params.avgTempC;
  const soilMoisturePct = params.soilMoisturePct;
  const sunlightHours = params.sunlightHours;
  const soilN = params.soilN;
  const pestPressure = params.pestPressure;
  const initialSeeds = params.initialSeedCount ?? DEFAULT_SEEDS;

  let GDDcum = 0;
  let biomass = 0.002 + rng() * 0.003; // small initial biomass
  let germinatedPct = 0;
  let germinated = false;
  let floweringFlag = false;
  let fruitCount = 0;

  const series: TomatoDayState[] = [];

  // varietyFactor introduces slight run-to-run variability
  const varietyFactor = 1 + (rng() - 0.5) * 0.12; // ±6%

  for (let day = 1; day <= days; day++) {
    // DAILY ENVIRONMENT (currently constant values; frontend could extend to daily arrays)
    const T = avgTempC;
    const moisture = soilMoisturePct;
    const light = sunlightHours;
    const N = soilN;
    const pest = pestPressure;

    const GDDtoday = dailyGDD(T);
    GDDcum += GDDtoday;

    // Germination accumulation (requires minimal conditions)
    if (!germinated) {
      // daily germination increment increases under good temp & moisture
      const tempFactor = 1 / (1 + Math.exp(-0.28 * (T - 22))); // centered near 22°C
      const moistureFactor = 1 / (1 + Math.exp(-0.08 * (moisture - 55)));
      const dailyGerm = 0.02 * tempFactor * moistureFactor * (1 - pest * 0.02) * (0.8 + rng() * 0.6);
      germinatedPct = Math.min(100, germinatedPct + dailyGerm * 100);
      if (germinatedPct >= 5) germinated = true; // once small portion germinated, consider germinated
    }

    // environment multipliers
    const mEff = moistureMultiplier(moisture);
    const lEff = lightMultiplier(light);
    const nEff = nutrientMultiplier(N);
    const pEff = pestMultiplier(pest);

    // effective GDD-like driver for biomass
    const effectiveGDD = GDDtoday * mEff * lEff * nEff * pEff * varietyFactor;

    // biomass growth: logistic incremental growth scaled by effectiveGDD
    const rBase = 0.018 * varietyFactor; // baseline daily growth coefficient
    const growthFactor = rBase * (1 + effectiveGDD / (5 + effectiveGDD));
    biomass = Math.max(0.0001, biomass + growthFactor * biomass * (1 - biomass));

    // occasional pest damage random events
    if (rng() < Math.min(0.01 * pest, 0.15)) {
      biomass *= (0.85 - 0.15 * rng());
    }

    // Stage detection from cumulative GDD and germination
    const stage = stageFromGDD(GDDcum, germinated);

    // Flowering and fruit dynamics
    if (stage === "flowering" && !floweringFlag) {
      floweringFlag = true;
    }
    if (stage === "fruit_set") {
      // number of new fruits depends on biomass and effectiveGDD
      const newFruits = Math.round(Math.max(0, biomass * 10 * (effectiveGDD / (1 + effectiveGDD)) * (0.7 + rng() * 0.8)));
      fruitCount += newFruits;
    }
    if (stage === "fruit_development" || stage === "ripening") {
      // pests reduce fruit count slightly
      fruitCount = Math.max(0, Math.round(fruitCount * (1 - pest * 0.01)));
    }

    // convert biomass to height and leaves
    const heightCm = biomassToHeightCm(biomass);
    const leafCount = biomassToLeafCount(biomass);

    // health index (0..1)
    const healthIndex = Math.max(0, Math.min(1, 0.55 * mEff + 0.2 * lEff + 0.25 * nEff - 0.03 * pest));

    series.push({
      day,
      avgTempC: T,
      soilMoisturePct: moisture,
      sunlightHours: light,
      soilN: N,
      pestPressure: pest,
      GDD_today: GDDtoday,
      GDD_cum: Math.round(GDDcum * 10) / 10,
      stage,
      germinatedPct: Math.round(germinatedPct * 10) / 10,
      heightCm: Math.round(heightCm * 10) / 10,
      leafCount,
      flowering: floweringFlag,
      fruitCount,
      healthIndex: Math.round(healthIndex * 100) / 100,
    });
  }

  return series;
}

/* -------------------------
   generateSyntheticTomatoDataset(spec,n,seed)
   - builds teacher dataset summarised at targetDay
   - returns SyntheticRow[] for training
   ------------------------- */
export interface SyntheticSpec {
  targetDay: number; // e.g., 60
  ranges?: {
    avgTempC?: [number, number];
    soilMoisturePct?: [number, number];
    sunlightHours?: [number, number];
    soilN?: [number, number];
    pestPressure?: [number, number];
  };
}

export function generateSyntheticTomatoDataset(spec: SyntheticSpec, n = 1000, seed = 42): SyntheticRow[] {
  const rng = mulberry32(seed);
  const rows: SyntheticRow[] = [];

  const r = spec.ranges ?? {};
  const randBetween = (min: number, max: number) => min + (max - min) * rng();

  for (let i = 0; i < n; i++) {
    const avgTempC = randBetween(r.avgTempC?.[0] ?? 12, r.avgTempC?.[1] ?? 32);
    const soilMoisturePct = randBetween(r.soilMoisturePct?.[0] ?? 25, r.soilMoisturePct?.[1] ?? 85);
    const sunlightHours = randBetween(r.sunlightHours?.[0] ?? 4, r.sunlightHours?.[1] ?? 12);
    const soilN = Math.round(randBetween(r.soilN?.[0] ?? 20, r.soilN?.[1] ?? 90));
    const pestPressure = Math.round(randBetween(r.pestPressure?.[0] ?? 0, r.pestPressure?.[1] ?? 5));

    const runParams: TomatoParams = {
      avgTempC,
      soilMoisturePct,
      sunlightHours,
      soilN,
      pestPressure,
      days: Math.max(spec.targetDay, 90),
      randomSeed: Math.floor(rng() * 1e9),
    };

    const ts = simulateTomato(runParams);
    const targetIdx = Math.min(spec.targetDay - 1, ts.length - 1);
    const target = ts[targetIdx];

    rows.push({
      runId: `synth_${i}`,
      avgTempC,
      soilMoisturePct,
      sunlightHours,
      soilN,
      pestPressure,
      targetDay: spec.targetDay,
      heightCm: target.heightCm,
      leafCount: target.leafCount,
      stage: target.stage,
      fruitCount: target.fruitCount ?? 0,
    });
  }

  return rows;
}

/* -------------------------
   small helper to format teacher/user rows into TrainSample[]
   ------------------------- */
export function toTrainSamples(rows: SyntheticRow[]) {
  return rows.map(r => ({
    avgTempC: r.avgTempC,
    soilMoisturePct: r.soilMoisturePct,
    sunlightHours: r.sunlightHours,
    soilN: r.soilN,
    pestPressure: r.pestPressure,
    targetDay: r.targetDay,
    heightCm: r.heightCm,
  }));
}
