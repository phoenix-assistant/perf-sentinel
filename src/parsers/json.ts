import type { BenchmarkResult } from '../utils/types.js';

/**
 * Generic JSON parser.
 * Accepts: { name, value, unit, iterations? } or array of same.
 */
export function parseGenericJson(json: unknown): BenchmarkResult[] {
  const items = Array.isArray(json) ? json : [json];

  return (items as Array<Record<string, unknown>>).map((item) => {
    if (typeof item['name'] !== 'string' || typeof item['value'] !== 'number') {
      throw new Error('Generic JSON must have { name: string, value: number, unit?: string }');
    }
    return {
      name: item['name'],
      value: item['value'],
      unit: String(item['unit'] ?? 'ms'),
      iterations: item['iterations'] != null ? Number(item['iterations']) : undefined,
    };
  });
}
