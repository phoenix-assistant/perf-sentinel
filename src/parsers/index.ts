import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { BenchmarkResult } from '../utils/types.js';
import { parsePytestBenchmark } from './pytest.js';
import { parseCriterion } from './criterion.js';
import { parseJmh } from './jmh.js';
import { parseGoBenchmark } from './go.js';
import { parseGenericJson } from './json.js';
import { parseRegex } from './regex.js';

export type ParserType = 'auto' | 'pytest' | 'criterion' | 'jmh' | 'go' | 'json' | 'regex';

export interface ParseOptions {
  parser: ParserType;
  pattern?: string;
  output: string; // raw stdout/stderr from benchmark command
}

export function parseOutput(opts: ParseOptions): BenchmarkResult[] {
  const { parser, output, pattern } = opts;

  if (parser === 'regex') {
    if (!pattern) throw new Error('--pattern required for regex parser');
    return parseRegex(output, pattern);
  }

  if (parser === 'go') {
    return parseGoBenchmark(output);
  }

  // For JSON-based parsers, try to parse JSON from output
  let json: unknown;
  try {
    // Try to extract JSON from output (may have surrounding text)
    const jsonMatch = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      json = JSON.parse(jsonMatch[0]);
    } else {
      json = JSON.parse(output);
    }
  } catch {
    // Not JSON, try Go format as fallback in auto mode
    if (parser === 'auto') {
      const goResults = parseGoBenchmark(output);
      if (goResults.length > 0) return goResults;
      throw new Error('Could not detect benchmark format. Use --parser to specify.');
    }
    throw new Error(`Failed to parse JSON output for ${parser} format`);
  }

  switch (parser) {
    case 'pytest':
      return parsePytestBenchmark(json);
    case 'criterion':
      return parseCriterion(json);
    case 'jmh':
      return parseJmh(json);
    case 'json':
      return parseGenericJson(json);
    case 'auto':
      return autoDetect(json);
    default:
      throw new Error(`Unknown parser: ${parser}`);
  }
}

function autoDetect(json: unknown): BenchmarkResult[] {
  // Try pytest-benchmark
  if (
    typeof json === 'object' &&
    json !== null &&
    'benchmarks' in json &&
    Array.isArray((json as Record<string, unknown>)['benchmarks'])
  ) {
    return parsePytestBenchmark(json);
  }

  // Try JMH (array with benchmark field)
  if (
    Array.isArray(json) &&
    json.length > 0 &&
    typeof json[0] === 'object' &&
    'benchmark' in (json[0] as Record<string, unknown>)
  ) {
    return parseJmh(json);
  }

  // Try criterion
  if (
    typeof json === 'object' &&
    json !== null &&
    'mean' in json &&
    typeof (json as Record<string, unknown>)['mean'] === 'object'
  ) {
    return parseCriterion(json);
  }

  // Try generic JSON
  return parseGenericJson(json);
}

/**
 * Try to find benchmark files in known locations and parse them.
 */
export function findAndParseFiles(parser: ParserType): BenchmarkResult[] | null {
  if (parser === 'pytest' || parser === 'auto') {
    try {
      const dir = '.benchmarks';
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      if (files.length > 0) {
        const content = readFileSync(join(dir, files[0]), 'utf8');
        return parsePytestBenchmark(JSON.parse(content));
      }
    } catch {
      // not found
    }
  }

  if (parser === 'criterion' || parser === 'auto') {
    try {
      const criterionDir = 'target/criterion';
      const benchNames = readdirSync(criterionDir);
      const results: BenchmarkResult[] = [];
      for (const name of benchNames) {
        try {
          const estimatesPath = join(criterionDir, name, 'new', 'estimates.json');
          const content = readFileSync(estimatesPath, 'utf8');
          results.push(...parseCriterion(JSON.parse(content), name));
        } catch {
          // skip
        }
      }
      if (results.length > 0) return results;
    } catch {
      // not found
    }
  }

  return null;
}
