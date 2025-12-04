import config from "../config.json";
import { SimInputs, SimOutputs } from "./types";
import { interpolateRGB, litmusAcidBaseRatio, interpolateUniversalColor } from "./helpers";

export function runSimulation(inputs: SimInputs): SimOutputs {
  const { runId, indicator, pH, pathLengthCm } = inputs;

  let rgb: number[];

  if (indicator === "litmus") {
    const { acid, base } = litmusAcidBaseRatio(pH, config.indicators.litmus.pKa);
    rgb = interpolateRGB(
      config.indicators.litmus.acid_color,
      config.indicators.litmus.base_color,
      base
    );
  } else {
    rgb = interpolateUniversalColor(pH);
  }

  // Add small noise for realism
  const ns = config.noise_sigma;
  rgb = rgb.map(v => Math.min(255, Math.max(0, v + (Math.random() * ns - ns / 2))));

  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    runId,
    indicator,
    pH,
    pathLengthCm
  };
}
