import type { BenchmarkResult } from '../utils/types.js';

/**
 * JMH (Java Microbenchmark Harness) JSON format.
 * Array of benchmark objects.
 */
export function parseJmh(json: unknown): BenchmarkResult[] {
  if (!Array.isArray(json)) throw new Error('Not a JMH JSON array');

  return (json as Array<Record<string, unknown>>).map((b) => {
    const primaryMetric = b['primaryMetric'] as Record<string, unknown> | undefined;
    const score = Number(primaryMetric?.['score'] ?? b['score'] ?? 0);
    const scoreUnit = String(primaryMetric?.['scoreUnit'] ?? b['scoreUnit'] ?? 'ops/s');

    return {
      name: String(b['benchmark'] ?? 'unknown'),
      value: score,
      unit: scoreUnit,
    };
  });
}
