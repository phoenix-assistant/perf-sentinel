import { runCommand } from './run.js';
import { checkCommand } from './check.js';
import { getDb, getAllBenchmarkNames, getBaselineResults, getLatestRunResults } from '../db/index.js';
import { mannWhitneyU } from '../stats/mann-whitney.js';
import { removeOutliers } from '../stats/outliers.js';
import { getCurrentCommit } from '../utils/git.js';

export interface CiOptions {
  threshold: number;
  significance: number;
  baselineRuns: number;
  dbDir?: string;
}

export async function ciRunAndCheck(command: string, opts: CiOptions): Promise<void> {
  await runCommand(command, {
    iterations: 1,
    parser: 'auto',
    dbDir: opts.dbDir,
  });

  await checkCommand({
    threshold: opts.threshold,
    significance: opts.significance,
    baselineRuns: opts.baselineRuns,
    dbDir: opts.dbDir,
  });
}

export async function ciComment(dbDir?: string): Promise<void> {
  const db = getDb(dbDir);
  const currentResults = getLatestRunResults(db);
  const sha = getCurrentCommit();

  let md = `## 🚀 Performance Results\n\n`;
  md += `> Commit: \`${sha.slice(0, 8)}\`\n\n`;
  md += `| Benchmark | Baseline | Current | Change | p-value | Status |\n`;
  md += `|-----------|----------|---------|--------|---------|--------|\n`;

  const names = [...new Set(currentResults.map((r) => r.benchmark_name))];
  let hasRegression = false;

  for (const name of names) {
    const current = removeOutliers(currentResults.filter((r) => r.benchmark_name === name).map((r) => r.value));
    const baselineRaw = getBaselineResults(db, name, 10);
    const baseline = removeOutliers(baselineRaw.map((r) => r.value));
    const unit = currentResults.find((r) => r.benchmark_name === name)?.unit ?? 'ms';

    if (baseline.length < 3) {
      md += `| ${name} | N/A | ${current[0]?.toFixed(2) ?? 'N/A'} ${unit} | - | - | ⚪ New |\n`;
      continue;
    }

    const bMean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const cMean = current.reduce((a, b) => a + b, 0) / current.length;
    const pct = bMean === 0 ? 0 : ((cMean - bMean) / bMean) * 100;
    const { p } = mannWhitneyU(current, baseline);
    const regressed = p < 0.05 && pct > 5;
    if (regressed) hasRegression = true;

    const status = regressed ? '🔴 Regressed' : pct < -5 && p < 0.05 ? '🟢 Improved' : '✅ Stable';
    const sign = pct >= 0 ? '+' : '';
    md += `| ${name} | ${bMean.toFixed(2)} ${unit} | ${cMean.toFixed(2)} ${unit} | ${sign}${pct.toFixed(1)}% | ${p.toFixed(4)} | ${status} |\n`;
  }

  if (hasRegression) {
    md += `\n> ❌ **Performance regression detected!**\n`;
  } else {
    md += `\n> ✅ No significant regressions.\n`;
  }

  console.log(md);
}
