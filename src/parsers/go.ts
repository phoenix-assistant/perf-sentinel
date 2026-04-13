import type { BenchmarkResult } from '../utils/types.js';

/**
 * Go testing.B text output parser.
 * Example line: BenchmarkFoo-8   1000000   1234 ns/op
 */
export function parseGoBenchmark(output: string): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const lineRe = /^(Benchmark\S+)\s+\d+\s+([\d.]+)\s+(\S+)/gm;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(output)) !== null) {
    const rawName = m[1].replace(/-\d+$/, ''); // strip goroutine count
    results.push({
      name: rawName,
      value: parseFloat(m[2]),
      unit: m[3],
    });
  }

  return results;
}
