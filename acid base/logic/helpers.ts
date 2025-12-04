import config from "../config.json";

export function interpolateRGB(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

export function litmusAcidBaseRatio(pH: number, pKa: number) {
  const ratio = Math.pow(10, pH - pKa);
  const acid = 1 / (1 + ratio);
  const base = ratio / (1 + ratio);
  return { acid, base };
}

/**
 * Find two nearest pH nodes in the universal indicator table and interpolate.
 */
export function interpolateUniversalColor(pH: number): number[] {
  const map = config.indicators.universal.color_map;

  let low = map[0];
  let high = map[map.length - 1];

  for (let i = 0; i < map.length - 1; i++) {
    if (pH >= map[i].pH && pH <= map[i + 1].pH) {
      low = map[i];
      high = map[i + 1];
      break;
    }
  }

  const t = (pH - low.pH) / (high.pH - low.pH);
  return interpolateRGB(low.rgb, high.rgb, t);
}
