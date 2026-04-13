/**
 * IQR-based outlier removal.
 * Removes values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
 */
export function removeOutliers(data: number[]): number[] {
  if (data.length < 4) return data;
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return data.filter((v) => v >= lo && v <= hi);
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
