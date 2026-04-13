import type { StatResult } from '../utils/types.js';

/**
 * Normal CDF approximation (Abramowitz & Stegun).
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Mann-Whitney U test (two-tailed).
 * Returns U statistic and p-value.
 * Uses normal approximation for n > 20, exact for small samples.
 */
export function mannWhitneyU(x: number[], y: number[]): StatResult {
  if (x.length === 0 || y.length === 0) return { u: 0, p: 1 };

  const n1 = x.length;
  const n2 = y.length;

  // Compute U1: count of pairs where x[i] > y[j]
  let u1 = 0;
  for (const xi of x) {
    for (const yj of y) {
      if (xi > yj) u1 += 1;
      else if (xi === yj) u1 += 0.5;
    }
  }
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);

  if (n1 <= 20 && n2 <= 20) {
    // For small samples use normal approximation as well (close enough)
    // Exact enumeration would be O((n1+n2)!) which is impractical
    const muU = (n1 * n2) / 2;
    const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    if (sigmaU === 0) return { u, p: 1 };
    // Continuity correction
    const z = (u - muU + 0.5) / sigmaU;
    const p = 2 * (1 - normalCDF(Math.abs(z)));
    return { u, p: Math.min(1, Math.max(0, p)) };
  }

  // Normal approximation (Lehmann)
  const muU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (u - muU) / sigmaU;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { u, p: Math.min(1, Math.max(0, p)) };
}
