import type { PettittResult } from '../utils/types.js';

/**
 * Pettitt change-point test (non-parametric).
 * Detects a single change point in a time series.
 * p ≈ 2 * exp(-6K² / (n³ + n²))
 */
export function pettittTest(series: number[]): PettittResult {
  const n = series.length;
  if (n < 4) return { changePoint: 0, p: 1, significant: false };

  // Compute U_t for t = 1..n-1
  const U: number[] = new Array(n).fill(0);
  for (let t = 1; t < n; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      for (let j = t; j < n; j++) {
        sum += Math.sign(series[j] - series[i]);
      }
    }
    U[t] = sum;
  }

  // K = max |U_t|
  let maxK = 0;
  let changePoint = 0;
  for (let t = 1; t < n; t++) {
    const absU = Math.abs(U[t]);
    if (absU > maxK) {
      maxK = absU;
      changePoint = t;
    }
  }

  const K = maxK;
  const p = 2 * Math.exp((-6 * K * K) / (n * n * n + n * n));

  return {
    changePoint,
    p: Math.min(1, Math.max(0, p)),
    significant: p < 0.05,
  };
}
