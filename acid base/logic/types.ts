export type IndicatorType = "litmus" | "universal";

export interface SimInputs {
  runId: string;
  indicator: IndicatorType;
  pH: number;
  pathLengthCm: number;
}

export interface SimOutputs {
  r: number;
  g: number;
  b: number;
  runId: string;
  indicator: IndicatorType;
  pH: number;
  pathLengthCm: number;
}

export interface TrainingDataPoint {
  pH: number;
  pathLengthCm: number;
  r: number;
  g: number;
  b: number;
}

export interface ModelPrediction {
  r: number;
  g: number;
  b: number;
}
