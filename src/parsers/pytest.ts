import type { BenchmarkResult } from '../utils/types.js';

/**
 * pytest-benchmark JSON format.
 * Looks for .benchmarks/*.json or a passed file.
 */
export function parsePytestBenchmark(json: unknown): BenchmarkResult[] {
  const data = json as Record<string, unknown>;
  const benchmarks = data['benchmarks'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(benchmarks)) throw new Error('Not a pytest-benchmark JSON');

  return benchmarks.map((b) => {
    const stats = b['stats'] as Record<string, unknown>;
    return {
      name: String(b['name'] ?? b['fullname'] ?? 'unknown'),
      value: Number(stats?.['mean'] ?? stats?.['median'] ?? b['mean'] ?? 0) * 1000, // seconds -> ms
      unit: 'ms',
      iterations: Number(stats?.['rounds'] ?? 1),
    };
  });
}
