import type { BootstrapCI } from '../utils/types.js';

function mean(data: number[]): number {
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function sample(data: number[], rng: () => number): number[] {
  return Array.from({ length: data.length }, () => data[Math.floor(rng() * data.length)]);
}

/** Simple LCG RNG for deterministic tests */
function makeLCG(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Bootstrap confidence intervals for percent difference (current vs baseline).
 * Returns 95% CI and median.
 */
export function bootstrapCI(
  baseline: number[],
  current: number[],
  iterations = 10000
): BootstrapCI {
  if (baseline.length === 0 || current.length === 0) {
    return { lower: 0, upper: 0, median: 0 };
  }

  const rng = makeLCG(42);
  const diffs: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const b = sample(baseline, rng);
    const c = sample(current, rng);
    const bMean = mean(b);
    if (bMean === 0) continue;
    diffs.push(((mean(c) - bMean) / bMean) * 100);
  }

  diffs.sort((a, b) => a - b);

  const lo = Math.floor(0.025 * diffs.length);
  const hi = Math.floor(0.975 * diffs.length);
  const mid = Math.floor(0.5 * diffs.length);

  return {
    lower: diffs[lo] ?? 0,
    upper: diffs[hi] ?? 0,
    median: diffs[mid] ?? 0,
  };
}
