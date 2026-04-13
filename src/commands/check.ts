import { getDb, getAllBenchmarkNames, getBaselineResults, getLatestRunResults } from '../db/index.js';
import { mannWhitneyU } from '../stats/mann-whitney.js';
import { bootstrapCI } from '../stats/bootstrap.js';
import { removeOutliers } from '../stats/outliers.js';
import type { CheckResult } from '../utils/types.js';

export interface CheckOptions {
  threshold: number;
  significance: number;
  baselineRuns: number;
  dbDir?: string;
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function checkCommand(opts: CheckOptions): Promise<CheckResult[]> {
  const db = getDb(opts.dbDir);

  const currentResults = getLatestRunResults(db);
  if (currentResults.length === 0) {
    console.error('❌ No results found. Run benchmarks first with `perf-sentinel run`.');
    process.exit(2);
  }

  const benchmarkNames = [...new Set(currentResults.map((r) => r.benchmark_name))];
  const checkResults: CheckResult[] = [];
  let hasRegression = false;

  for (const name of benchmarkNames) {
    const current = currentResults.filter((r) => r.benchmark_name === name).map((r) => r.value);
    const baselineRaw = getBaselineResults(db, name, opts.baselineRuns);

    if (baselineRaw.length < 3) {
      console.warn(`⚠️  Insufficient baseline samples for ${name} (${baselineRaw.length}). Skipping.`);
      continue;
    }

    const baseline = removeOutliers(baselineRaw.map((r) => r.value));
    const cleanCurrent = removeOutliers(current);

    if (cleanCurrent.length === 0) {
      console.warn(`⚠️  All current values for ${name} were outliers. Skipping.`);
      continue;
    }

    // Check for zero variance
    const baselineVariance = baseline.every((v) => v === baseline[0]);
    if (baselineVariance) {
      console.warn(`⚠️  Zero variance in baseline for ${name}.`);
    }

    const bMean = mean(baseline);
    const cMean = mean(cleanCurrent);
    const percentChange = bMean === 0 ? 0 : ((cMean - bMean) / bMean) * 100;

    const { u, p } = mannWhitneyU(cleanCurrent, baseline);
    const ci = bootstrapCI(baseline, cleanCurrent);

    const unit = baselineRaw[0]?.unit ?? 'ms';
    const regressed = p < opts.significance && percentChange > opts.threshold;

    if (regressed) hasRegression = true;

    checkResults.push({
      benchmark: name,
      baselineValues: baseline,
      currentValues: cleanCurrent,
      baselineMean: bMean,
      currentMean: cMean,
      percentChange,
      u,
      p,
      ci,
      regressed,
      unit,
    });
  }

  // Print results
  console.log('\n📊 Performance Check Results\n');
  for (const r of checkResults) {
    const sign = r.percentChange >= 0 ? '+' : '';
    const arrow = r.regressed ? '⚠️ ' : '✅ ';
    const ciStr = `${r.ci.lower.toFixed(1)}% to ${r.ci.upper.toFixed(1)}%`;
    if (r.regressed) {
      console.log(
        `${arrow}${r.benchmark} regressed ${sign}${r.percentChange.toFixed(1)}% (p=${r.p.toFixed(4)}) [95% CI: ${ciStr}]`
      );
    } else if (r.percentChange < -opts.threshold && r.p < opts.significance) {
      console.log(
        `✨ ${r.benchmark} improved ${Math.abs(r.percentChange).toFixed(1)}% (p=${r.p.toFixed(4)})`
      );
    } else {
      console.log(
        `${arrow}${r.benchmark}: no significant change (${sign}${r.percentChange.toFixed(1)}%, p=${r.p.toFixed(4)})`
      );
    }
  }

  if (checkResults.length === 0) {
    console.log('✅ No benchmarks to check.');
  } else if (!hasRegression) {
    console.log('\n✅ No significant regressions detected.');
  } else {
    console.log('\n❌ Performance regression(s) detected!');
    process.exit(1);
  }

  return checkResults;
}
