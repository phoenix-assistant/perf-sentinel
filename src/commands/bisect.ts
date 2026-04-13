import { execSync } from 'child_process';
import { getDb, getRunCommand, getBaselineResults, insertRun, insertResult } from '../db/index.js';
import { parseOutput } from '../parsers/index.js';
import { mannWhitneyU } from '../stats/mann-whitney.js';
import { removeOutliers } from '../stats/outliers.js';
import { getCommitLog, getCommitAuthor, getCommitDate, checkoutCommit } from '../utils/git.js';
import { getCurrentCommit, getCurrentBranch } from '../utils/git.js';

export interface BisectOptions {
  good?: string;
  bad: string;
  command?: string;
  dbDir?: string;
}

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function bisectCommand(benchmarkName: string, opts: BisectOptions): Promise<void> {
  const db = getDb(opts.dbDir);

  const storedCommand = opts.command ?? getRunCommand(db);
  if (!storedCommand) {
    console.error('❌ No benchmark command found. Pass --command or run benchmarks first.');
    process.exit(2);
  }

  const baselineRaw = getBaselineResults(db, benchmarkName, 10);
  if (baselineRaw.length < 3) {
    console.error(`❌ Insufficient baseline data for "${benchmarkName}". Run benchmarks on a good commit first.`);
    process.exit(2);
  }
  const baseline = removeOutliers(baselineRaw.map((r) => r.value));
  const baselineMean = mean(baseline);

  const goodCommit = opts.good;
  const badCommit = opts.bad;

  let commits: string[];
  if (goodCommit) {
    commits = getCommitLog(goodCommit, badCommit);
    commits.unshift(badCommit);
  } else {
    // Get last 20 commits
    const log = execSync('git log --format="%H" -20', { encoding: 'utf8' });
    commits = log.trim().split('\n').filter(Boolean);
  }

  if (commits.length < 2) {
    console.error('❌ Not enough commits to bisect.');
    process.exit(2);
  }

  console.log(`🔍 Bisecting "${benchmarkName}" across ${commits.length} commits...`);
  console.log(`   Baseline mean: ${baselineMean.toFixed(3)}`);

  const originalBranch = getCurrentBranch();
  let lo = 0;
  let hi = commits.length - 1;
  let regressionCommit: string | null = null;

  try {
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sha = commits[mid];
      console.log(`\n   Checking commit ${sha.slice(0, 8)} (index ${mid})...`);

      checkoutCommit(sha);

      let output = '';
      try {
        output = execSync(storedCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string };
        output = (e.stdout ?? '') + (e.stderr ?? '');
      }

      const results = parseOutput({ parser: 'auto', output });
      const match = results.find((r) => r.name === benchmarkName);
      if (!match) {
        console.warn(`   ⚠️  Benchmark "${benchmarkName}" not found at this commit, skipping.`);
        hi = mid - 1;
        continue;
      }

      const runId = insertRun(db, storedCommand, sha, 'bisect');
      insertResult(db, runId, match.name, match.value, match.unit, sha, 'bisect');

      const current = [match.value];
      const { p } = mannWhitneyU(current, baseline);
      const pctChange = ((match.value - baselineMean) / baselineMean) * 100;

      console.log(`   ${match.value.toFixed(3)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%, p=${p.toFixed(4)})`);

      // If regressed (worse), go earlier (lower index = more recent in typical git log)
      if (pctChange > 5 && p < 0.05) {
        regressionCommit = sha;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
  } finally {
    // Restore original branch
    try {
      checkoutCommit(originalBranch);
    } catch {
      // ignore
    }
  }

  console.log('\n📍 Bisect Results:');
  if (regressionCommit) {
    const author = getCommitAuthor(regressionCommit);
    const date = getCommitDate(regressionCommit);
    console.log(`   Regression introduced in commit ${regressionCommit.slice(0, 8)} by ${author} (${date})`);
  } else {
    console.log('   Could not pinpoint regression commit.');
  }
}
