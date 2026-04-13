import { readFileSync } from 'fs';
import { getDb, setBaseline, getLatestRun, getBaselineResults, getAllBenchmarkNames } from '../db/index.js';
import { insertRun, insertResult } from '../db/index.js';
import { getCurrentCommit, getCurrentBranch } from '../utils/git.js';
import { parseGenericJson } from '../parsers/json.js';

export async function baselineSet(dbDir?: string): Promise<void> {
  const db = getDb(dbDir);
  const run = getLatestRun(db);
  if (!run) {
    console.error('❌ No runs found. Run benchmarks first.');
    process.exit(2);
  }
  setBaseline(db);
  console.log(`✅ Run #${run.id} set as baseline (commit ${run.commit_sha.slice(0, 8)}).`);
}

export async function baselineShow(dbDir?: string): Promise<void> {
  const db = getDb(dbDir);
  const names = getAllBenchmarkNames(db);

  if (names.length === 0) {
    console.log('No benchmarks found.');
    return;
  }

  console.log('\n📊 Baseline Values\n');
  console.log('Benchmark'.padEnd(40) + 'Values'.padEnd(10) + 'Mean');
  console.log('-'.repeat(70));

  for (const name of names) {
    const rows = getBaselineResults(db, name, 20);
    if (rows.length === 0) continue;
    const vals = rows.map((r) => r.value);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const unit = rows[0].unit;
    console.log(`${name.padEnd(40)}${rows.length.toString().padEnd(10)}${m.toFixed(3)} ${unit}`);
  }
}

export async function baselineImport(file: string, dbDir?: string): Promise<void> {
  const db = getDb(dbDir);
  const content = readFileSync(file, 'utf8');
  const json = JSON.parse(content);
  const results = parseGenericJson(json);

  if (results.length === 0) {
    console.error('❌ No benchmarks found in file.');
    process.exit(2);
  }

  const commitSha = getCurrentCommit();
  const branch = getCurrentBranch();
  const runId = insertRun(db, `import:${file}`, commitSha, branch);
  for (const r of results) {
    insertResult(db, runId, r.name, r.value, r.unit, commitSha, branch);
  }
  setBaseline(db, runId);

  console.log(`✅ Imported ${results.length} benchmark(s) as baseline from ${file}.`);
}
