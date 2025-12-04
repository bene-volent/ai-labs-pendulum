import * as tf from "@tensorflow/tfjs";
import { TrainingDataPoint, ModelPrediction } from "./types";

export async function trainModel(dataset: TrainingDataPoint[], logDir: string) {
  const xs = tf.tensor2d(dataset.map(d => [d.pH, d.pathLengthCm]));
  const ys = tf.tensor2d(dataset.map(d => [d.r / 255, d.g / 255, d.b / 255]));

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [2] }));
  model.add(tf.layers.dense({ units: 32, activation: "relu" }));
  model.add(tf.layers.dense({ units: 3, activation: "sigmoid" }));

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: "meanSquaredError",
    metrics: ["accuracy"]
  });

  const tb = tf.callbacks.tensorBoard(logDir, {
    updateFreq: "batch",
    histogramFreq: 1
  });

  await model.fit(xs, ys, {
    epochs: 40,
    batchSize: 8,
    validationSplit: 0.2,
    callbacks: [tb]
  });

  await model.save("localstorage://acid-base-model");

  xs.dispose();
  ys.dispose();

  return model;
}

export async function loadModel(): Promise<tf.LayersModel | null> {
  try {
    return await tf.loadLayersModel("localstorage://acid-base-model");
  } catch {
    return null;
  }
}

export async function predictWithModel(model: tf.LayersModel, pH: number, pathLengthCm: number): Promise<ModelPrediction> {
  const input = tf.tensor2d([[pH, pathLengthCm]]);
  const output = model.predict(input) as tf.Tensor;

  const [r, g, b] = (await output.array())[0];

  input.dispose();
  output.dispose();

  return { r: r * 255, g: g * 255, b: b * 255 };
}
