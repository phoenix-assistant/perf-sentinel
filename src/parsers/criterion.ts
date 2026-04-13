import type { BenchmarkResult } from '../utils/types.js';

/**
 * criterion.rs JSON format (target/criterion/<name>/new/estimates.json).
 * Accepts either a single estimates.json or a directory of them.
 */
export function parseCriterion(json: unknown, name = 'benchmark'): BenchmarkResult[] {
  const data = json as Record<string, unknown>;

  // Single estimates.json
  if (data['mean'] && typeof data['mean'] === 'object') {
    const meanObj = data['mean'] as Record<string, unknown>;
    const valueNs = Number(meanObj['point_estimate'] ?? 0);
    return [
      {
        name,
        value: valueNs / 1_000_000, // ns -> ms
        unit: 'ms',
      },
    ];
  }

  throw new Error('Not a criterion.rs estimates JSON');
}
