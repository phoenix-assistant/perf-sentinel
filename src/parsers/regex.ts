import type { BenchmarkResult } from '../utils/types.js';

/**
 * Custom regex parser.
 * Pattern must have 3 capture groups: (name) (value) (unit)
 */
export function parseRegex(output: string, pattern: string): BenchmarkResult[] {
  const re = new RegExp(pattern, 'gm');
  const results: BenchmarkResult[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(output)) !== null) {
    if (m.length < 4) throw new Error('Pattern must have 3 capture groups: name, value, unit');
    results.push({
      name: m[1],
      value: parseFloat(m[2]),
      unit: m[3],
    });
  }

  return results;
}
