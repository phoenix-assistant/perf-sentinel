import { getDb, getAllBenchmarkNames, getBenchmarkHistory } from '../db/index.js';
import { pettittTest } from '../stats/pettitt.js';
import { asciiChart, generateSvgChart } from '../utils/format.js';
import { writeFileSync } from 'fs';

export interface ReportOptions {
  format: 'table' | 'markdown' | 'json' | 'svg';
  benchmark?: string;
  last?: number;
  dbDir?: string;
  output?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function reportCommand(opts: ReportOptions): Promise<void> {
  const db = getDb(opts.dbDir);
  const names = opts.benchmark ? [opts.benchmark] : getAllBenchmarkNames(db);

  if (names.length === 0) {
    console.log('No benchmarks found. Run benchmarks first.');
    return;
  }

  const stats = names.map((name) => {
    const history = getBenchmarkHistory(db, name, opts.last);
    const values = history.map((r) => r.value);
    const sorted = [...values].sort((a, b) => a - b);
    const unit = history[0]?.unit ?? 'ms';
    const pettitt = values.length >= 4 ? pettittTest(values) : null;

    return {
      name,
      mean: mean(values),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      unit,
      count: values.length,
      values,
      pettitt,
    };
  });

  if (opts.format === 'json') {
    const out = JSON.stringify(stats.map(({ values: _, ...rest }) => rest), null, 2);
    if (opts.output) writeFileSync(opts.output, out);
    else console.log(out);
    return;
  }

  if (opts.format === 'svg') {
    for (const s of stats) {
      const svg = generateSvgChart(s.name, s.values);
      const path = opts.output ?? `${s.name.replace(/\W+/g, '_')}.svg`;
      writeFileSync(path, svg);
      console.log(`📊 SVG written to ${path}`);
    }
    return;
  }

  if (opts.format === 'markdown') {
    let md = '# Performance Report\n\n';
    md += '| Benchmark | Mean | p50 | p95 | p99 | Unit | Samples |\n';
    md += '|-----------|------|-----|-----|-----|------|--------|\n';
    for (const s of stats) {
      md += `| ${s.name} | ${s.mean.toFixed(2)} | ${s.p50.toFixed(2)} | ${s.p95.toFixed(2)} | ${s.p99.toFixed(2)} | ${s.unit} | ${s.count} |\n`;
    }
    md += '\n';
    for (const s of stats) {
      if (s.pettitt?.significant) {
        md += `> ⚠️ **${s.name}**: Change point detected at sample ${s.pettitt.changePoint} (p=${s.pettitt.p.toFixed(4)})\n\n`;
      }
    }
    if (opts.output) writeFileSync(opts.output, md);
    else console.log(md);
    return;
  }

  // Default: table + ASCII charts
  console.log('\n📊 Performance Report\n');
  console.log('Benchmark'.padEnd(40) + 'Mean'.padEnd(12) + 'p50'.padEnd(12) + 'p95'.padEnd(12) + 'p99'.padEnd(12) + 'Unit'.padEnd(8) + 'Samples');
  console.log('-'.repeat(100));
  for (const s of stats) {
    console.log(
      s.name.padEnd(40) +
        s.mean.toFixed(2).padEnd(12) +
        s.p50.toFixed(2).padEnd(12) +
        s.p95.toFixed(2).padEnd(12) +
        s.p99.toFixed(2).padEnd(12) +
        s.unit.padEnd(8) +
        s.count
    );
  }

  for (const s of stats) {
    if (s.values.length > 1) {
      console.log(`\n📈 ${s.name} over time:`);
      console.log(asciiChart(s.values));
    }
    if (s.pettitt?.significant) {
      console.log(`⚠️  Change point detected at sample ${s.pettitt.changePoint} (p=${s.pettitt.p.toFixed(4)})`);
    }
  }
}
