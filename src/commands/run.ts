import { execSync } from 'child_process';
import { getDb, insertRun, insertResult } from '../db/index.js';
import { parseOutput, findAndParseFiles } from '../parsers/index.js';
import type { ParserType } from '../parsers/index.js';
import { getCurrentCommit, getCurrentBranch } from '../utils/git.js';

export interface RunOptions {
  iterations: number;
  parser: ParserType;
  pattern?: string;
  dbDir?: string;
}

export async function runCommand(command: string, opts: RunOptions): Promise<void> {
  const db = getDb(opts.dbDir);
  const commitSha = getCurrentCommit();
  const branch = getCurrentBranch();

  const runId = insertRun(db, command, commitSha, branch);

  console.log(`🏃 Running: ${command}`);
  console.log(`   Iterations: ${opts.iterations}, Parser: ${opts.parser}`);

  for (let i = 0; i < opts.iterations; i++) {
    if (opts.iterations > 1) {
      process.stdout.write(`   Iteration ${i + 1}/${opts.iterations}...\r`);
    }

    let output = '';
    try {
      output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err: unknown) {
      // Command may exit non-zero; capture output anyway
      const execErr = err as { stdout?: string; stderr?: string };
      output = (execErr.stdout ?? '') + (execErr.stderr ?? '');
      if (!output.trim()) {
        throw new Error(`Benchmark command failed with no output: ${command}`);
      }
    }

    // Try to parse from output, then from generated files
    let results = null;
    try {
      results = parseOutput({ parser: opts.parser, output, pattern: opts.pattern });
    } catch {
      results = findAndParseFiles(opts.parser);
      if (!results) throw new Error('Could not parse benchmark output. Use --parser to specify format.');
    }

    if (results.length === 0) {
      console.warn('⚠️  No benchmarks found in output');
      continue;
    }

    for (const r of results) {
      insertResult(db, runId, r.name, r.value, r.unit, commitSha, branch);
    }

    if (i === 0 || opts.iterations === 1) {
      if (opts.iterations > 1) process.stdout.write('\n');
      console.log(`\n✅ Parsed ${results.length} benchmark(s):`);
      for (const r of results) {
        console.log(`   ${r.name}: ${r.value.toFixed(3)} ${r.unit}`);
      }
    }
  }

  if (opts.iterations > 1) {
    process.stdout.write('\n');
    console.log(`\n✅ Stored ${opts.iterations} iteration(s) in run #${runId}`);
  } else {
    console.log(`\n   Run ID: ${runId} | Commit: ${commitSha.slice(0, 8)} | Branch: ${branch}`);
  }
}
