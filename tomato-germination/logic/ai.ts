// experiments/biology/tomato/logic/ai.ts
// TensorFlow.js training & predict utilities for tomato experiment

import * as tf from "@tensorflow/tfjs";
import * as tfvis from "@tensorflow/tfjs-vis";
import { SyntheticRow } from "./types";

let tomatoModel: tf.LayersModel | null = null;

/* -------------------------
   create or reset model
   ------------------------- */
export function createTomatoModel(inputDim = 5) {
  tomatoModel = tf.sequential();
  tomatoModel.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [inputDim] }));
  tomatoModel.add(tf.layers.dense({ units: 24, activation: "relu" }));
  tomatoModel.add(tf.layers.dense({ units: 12, activation: "relu" }));
  tomatoModel.add(tf.layers.dense({ units: 1 })); // height_cm output

  tomatoModel.compile({
    optimizer: tf.train.adam(0.005),
    loss: "meanSquaredError",
    metrics: ["mse", "mae"],
  });

  return tomatoModel;
}

/* -------------------------
   Normalize helper (simple min-max optional)
   We will normalize by mean/std (standardization)
   ------------------------- */
function computeMeanStd(rows: SyntheticRow[]) {
  const keys: (keyof SyntheticRow)[] = ["avgTempC", "soilMoisturePct", "sunlightHours", "soilN", "pestPressure"];
  const mean: Record<string, number> = {};
  const std: Record<string, number> = {};
  keys.forEach(k => {
    const vals = rows.map(r => (r as any)[k] as number);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const s = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    mean[k] = m;
    std[k] = s || 1;
  });
  return { mean, std };
}

function normalizeRows(rows: SyntheticRow[], mean: any, std: any) {
  const xs = rows.map(r => [
    ((r.avgTempC - mean.avgTempC) / std.avgTempC),
    ((r.soilMoisturePct - mean.soilMoisturePct) / std.soilMoisturePct),
    ((r.sunlightHours - mean.sunlightHours) / std.sunlightHours),
    ((r.soilN - mean.soilN) / std.soilN),
    ((r.pestPressure - mean.pestPressure) / std.pestPressure),
  ]);
  const ys = rows.map(r => [r.heightCm]);
  return { xs, ys };
}

/* -------------------------
   Train model in-browser
   teacherRows: synthetic base dataset (many rows)
   userRows: optional array collected by student (5..20)
   options: epochs, batchSize
   ------------------------- */
export async function trainTomatoModel(
  teacherRows: SyntheticRow[],
  userRows: SyntheticRow[] = [],
  options?: { epochs?: number; batchSize?: number }
) {
  if (!tomatoModel) createTomatoModel();

  const rows = [...teacherRows, ...userRows];
  const { mean, std } = computeMeanStd(rows);
  const norm = normalizeRows(rows, mean, std);

  const xs = tf.tensor2d(norm.xs);
  const ys = tf.tensor2d(norm.ys);

  const epochs = options?.epochs ?? 40;
  const batchSize = options?.batchSize ?? 16;

  const surface = { name: "Tomato Training", tab: "Training" };

  const history = await tomatoModel!.fit(xs, ys, {
    epochs,
    batchSize,
    shuffle: true,
    callbacks: tfvis.show.fitCallbacks(surface, ["loss", "mse", "mae"], { callbacks: ["onEpochEnd"] }),
  });

  xs.dispose();
  ys.dispose();

  // return normalization params so frontend can use them for predictions
  return { history, normalization: { mean, std } };
}

/* -------------------------
   Predict helper
   Input: raw input features; normalization params required (returned from train)
   ------------------------- */
export function predictTomatoHeight(input: {
  avgTempC: number;
  soilMoisturePct: number;
  sunlightHours: number;
  soilN: number;
  pestPressure: number;
}, normalization: { mean: any; std: any }) {
  if (!tomatoModel) throw new Error("Model not initialized. Train or create model first.");

  const x = tf.tensor2d([[
    (input.avgTempC - normalization.mean.avgTempC) / normalization.std.avgTempC,
    (input.soilMoisturePct - normalization.mean.soilMoisturePct) / normalization.std.soilMoisturePct,
    (input.sunlightHours - normalization.mean.sunlightHours) / normalization.std.sunlightHours,
    (input.soilN - normalization.mean.soilN) / normalization.std.soilN,
    (input.pestPressure - normalization.mean.pestPressure) / normalization.std.pestPressure,
  ]]);

  const pred = tomatoModel.predict(x) as tf.Tensor;
  const val = pred.dataSync()[0];
  x.dispose();
  pred.dispose();
  return val;
}

/* -------------------------
   Utility metrics for evaluation (frontend can call)
   ------------------------- */
export function computeRMSE(yTrue: number[], yPred: number[]) {
  const n = yTrue.length;
  const mse = yTrue.reduce((acc, y, i) => acc + (y - yPred[i]) ** 2, 0) / n;
  return Math.sqrt(mse);
}

export function computeR2(yTrue: number[], yPred: number[]) {
  const mean = yTrue.reduce((a, b) => a + b, 0) / yTrue.length;
  const ssTot = yTrue.reduce((a, b) => a + (b - mean) ** 2, 0);
  const ssRes = yTrue.reduce((a, b, i) => a + (b - yPred[i]) ** 2, 0);
  return 1 - ssRes / ssTot;
}

/* -------------------------
   Model persistence helpers (optional)
   - save to IndexedDB
   ------------------------- */
export async function saveModelIndexedDB(name = "tomato-model") {
  if (!tomatoModel) throw new Error("No model to save");
  await tomatoModel.save(`indexeddb://${name}`);
}

export async function loadModelIndexedDB(name = "tomato-model") {
  tomatoModel = await tf.loadLayersModel(`indexeddb://${name}`);
  return tomatoModel;
}
