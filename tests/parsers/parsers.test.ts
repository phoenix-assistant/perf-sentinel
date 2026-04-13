import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parsePytestBenchmark } from '../../src/parsers/pytest.js';
import { parseCriterion } from '../../src/parsers/criterion.js';
import { parseJmh } from '../../src/parsers/jmh.js';
import { parseGoBenchmark } from '../../src/parsers/go.js';
import { parseGenericJson } from '../../src/parsers/json.js';
import { parseRegex } from '../../src/parsers/regex.js';

describe('pytest-benchmark parser', () => {
  it('parses fixture file', () => {
    const json = JSON.parse(readFileSync('tests/fixtures/pytest-benchmark.json', 'utf8'));
    const results = parsePytestBenchmark(json);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('test_endpoint_latency');
    expect(results[0].value).toBeCloseTo(2, 0); // 0.002s * 1000 = 2ms
    expect(results[0].unit).toBe('ms');
  });

  it('throws on non-pytest JSON', () => {
    expect(() => parsePytestBenchmark({ foo: 'bar' })).toThrow();
  });
});

describe('criterion.rs parser', () => {
  it('parses fixture file', () => {
    const json = JSON.parse(readFileSync('tests/fixtures/criterion.json', 'utf8'));
    const results = parseCriterion(json, 'my_bench');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('my_bench');
    expect(results[0].value).toBeCloseTo(1.25, 1); // 1250000 ns -> 1.25ms
    expect(results[0].unit).toBe('ms');
  });
});

describe('JMH parser', () => {
  it('parses fixture file', () => {
    const json = JSON.parse(readFileSync('tests/fixtures/jmh.json', 'utf8'));
    const results = parseJmh(json);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('com.example.MyBenchmark.testMethod');
    expect(results[0].value).toBeCloseTo(1234.5, 0);
    expect(results[0].unit).toBe('ns/op');
  });
});

describe('Go testing.B parser', () => {
  it('parses standard Go benchmark output', () => {
    const output = `
goos: linux
goarch: amd64
BenchmarkFoo-8   1000000   1234 ns/op
BenchmarkBar-4   500000    2567 ns/op
BenchmarkBaz     100        100 ms/op
PASS
`;
    const results = parseGoBenchmark(output);
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe('BenchmarkFoo');
    expect(results[0].value).toBe(1234);
    expect(results[0].unit).toBe('ns/op');
    expect(results[1].name).toBe('BenchmarkBar');
  });

  it('returns empty array for non-benchmark output', () => {
    const results = parseGoBenchmark('PASS\nok mypackage 0.5s');
    expect(results).toHaveLength(0);
  });
});

describe('Generic JSON parser', () => {
  it('parses single object', () => {
    const json = { name: 'my_bench', value: 42.5, unit: 'ms' };
    const results = parseGenericJson(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('my_bench');
    expect(results[0].value).toBe(42.5);
  });

  it('parses array', () => {
    const json = [
      { name: 'bench1', value: 10, unit: 'ms' },
      { name: 'bench2', value: 20, unit: 'ns' },
    ];
    const results = parseGenericJson(json);
    expect(results).toHaveLength(2);
  });

  it('throws on missing name or value', () => {
    expect(() => parseGenericJson({ foo: 'bar' })).toThrow();
  });
});

describe('Regex parser', () => {
  it('parses custom output with regex', () => {
    const output = 'latency: 12.5 ms\nthroughput: 9876 ops';
    const results = parseRegex(output, '(\\w+): ([\\d.]+) (\\w+)');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('latency');
    expect(results[0].value).toBe(12.5);
    expect(results[0].unit).toBe('ms');
  });
});
