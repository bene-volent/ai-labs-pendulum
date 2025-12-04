// experiments/biology/tomato/logic/helpers.ts
// Utility math and biological helpers used by sim.ts and ai.ts

import { PhenologyStage } from "./types";

/* -------------------------
   Simple deterministic RNG
   ------------------------- */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------
   GDD: Growing Degree Days
   ------------------------- */
export const T_BASE = 10.0; // base temp for tomato (°C)

export function dailyGDD(Tavg: number, Tbase = T_BASE): number {
  return Math.max(0, Tavg - Tbase);
}

/* -------------------------
   Environmental effect curves
   Returns multipliers ~0..1.5 (some >1 allowed)
   ------------------------- */
export function moistureMultiplier(m: number): number {
  // center near 60% moisture
  const x = m - 60;
  return 0.5 + 1.0 / (1 + Math.exp(-0.08 * x)); // ~0.5..1.5
}

export function lightMultiplier(hours: number): number {
  // linear-ish up to 12h; normalize to ~0.4..1.4
  const eff = hours / 12;
  return Math.max(0.35, Math.min(1.4, eff));
}

export function nutrientMultiplier(n: number): number {
  return 0.6 + (Math.max(0, Math.min(100, n)) / 100) * 0.8; // 0.6..1.4
}

export function pestMultiplier(p: number): number {
  // p: 0..10 -> return multiplicative factor <=1
  return Math.max(0.6, 1 - (p / 10) * 0.4); // 1 -> 0.6 at p=10
}

/* -------------------------
   Mapping biomass -> height/leaves
   ------------------------- */
export function biomassToHeightCm(biomass: number, maxHeight = 150): number {
  // biomass roughly in 0..1; use saturating curve
  return maxHeight * (1 - Math.exp(-4 * biomass));
}

export function biomassToLeafCount(biomass: number, maxLeaves = 40): number {
  return Math.round(maxLeaves * (1 - Math.exp(-3 * biomass)));
}

/* -------------------------
   Stage mapping by cumulative GDD
   ------------------------- */
export function stageFromGDD(GDDcum: number, germinated: boolean): PhenologyStage {
  if (!germinated) return "germination";
  if (GDDcum < 50) return "seedling";
  if (GDDcum < 200) return "vegetative";
  if (GDDcum < 400) return "flowering";
  if (GDDcum < 700) return "fruit_set";
  if (GDDcum < 1000) return "fruit_development";
  return "ripening";
}
