import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { checkCommand } from './commands/check.js';
import { bisectCommand } from './commands/bisect.js';
import { reportCommand } from './commands/report.js';
import { baselineSet, baselineShow, baselineImport } from './commands/baseline.js';
import { ciRunAndCheck, ciComment } from './commands/ci.js';

const program = new Command();

program
  .name('perf-sentinel')
  .description('Performance regression CI gate with statistical testing and auto-bisect')
  .version('0.1.0');

// run command
program
  .command('run <command...>')
  .description('Run benchmarks and store results')
  .option('-n, --iterations <n>', 'Number of iterations for statistical significance', '1')
  .option('--parser <type>', 'Parser type: auto|pytest|criterion|jmh|go|json|regex', 'auto')
  .option('--pattern <regex>', 'Regex pattern for custom parser (3 groups: name, value, unit)')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (cmdParts: string[], opts) => {
    const command = cmdParts.join(' ');
    await runCommand(command, {
      iterations: parseInt(opts.iterations, 10),
      parser: opts.parser,
      pattern: opts.pattern,
      dbDir: opts.dbDir,
    });
  });

// check command
program
  .command('check')
  .description('Compare current results against baseline')
  .option('--threshold <pct>', 'Min % change to flag as regression', '5')
  .option('--significance <p>', 'P-value cutoff (default 0.05)', '0.05')
  .option('--baseline-runs <n>', 'Number of baseline runs to compare against', '10')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (opts) => {
    await checkCommand({
      threshold: parseFloat(opts.threshold),
      significance: parseFloat(opts.significance),
      baselineRuns: parseInt(opts.baselineRuns, 10),
      dbDir: opts.dbDir,
    });
  });

// bisect command
program
  .command('bisect <benchmark-name>')
  .description('Find the commit that caused a regression')
  .option('--good <commit>', 'Known good commit SHA')
  .option('--bad <commit>', 'Known bad commit SHA (default: HEAD)', 'HEAD')
  .option('--command <cmd>', 'Override benchmark command')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (benchmarkName: string, opts) => {
    await bisectCommand(benchmarkName, {
      good: opts.good,
      bad: opts.bad,
      command: opts.command,
      dbDir: opts.dbDir,
    });
  });

// report command
program
  .command('report')
  .description('Generate performance report')
  .option('--format <fmt>', 'Output format: table|markdown|json|svg', 'table')
  .option('--benchmark <name>', 'Filter by benchmark name')
  .option('--last <n>', 'Show last N runs')
  .option('--output <file>', 'Output file (for markdown/json/svg)')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (opts) => {
    await reportCommand({
      format: opts.format as 'table' | 'markdown' | 'json' | 'svg',
      benchmark: opts.benchmark,
      last: opts.last ? parseInt(opts.last, 10) : undefined,
      output: opts.output,
      dbDir: opts.dbDir,
    });
  });

// baseline command
const baseline = program.command('baseline').description('Set/update baseline');

baseline
  .command('set')
  .description('Mark the most recent run as baseline')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (opts) => { await baselineSet(opts.dbDir); });

baseline
  .command('show')
  .description('Display current baseline values')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (opts) => { await baselineShow(opts.dbDir); });

baseline
  .command('import <file>')
  .description('Import baseline from JSON file')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (file: string, opts) => { await baselineImport(file, opts.dbDir); });

// ci command
const ci = program.command('ci').description('CI-optimized commands');

ci
  .command('run-and-check <command...>')
  .description('Run benchmarks and check for regressions in one step')
  .option('--threshold <pct>', 'Min % change to flag', '5')
  .option('--significance <p>', 'P-value cutoff', '0.05')
  .option('--baseline-runs <n>', 'Number of baseline runs', '10')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (cmdParts: string[], opts) => {
    await ciRunAndCheck(cmdParts.join(' '), {
      threshold: parseFloat(opts.threshold),
      significance: parseFloat(opts.significance),
      baselineRuns: parseInt(opts.baselineRuns, 10),
      dbDir: opts.dbDir,
    });
  });

ci
  .command('comment')
  .description('Output GitHub PR comment with performance results')
  .option('--db-dir <dir>', 'Database directory', '.perf-sentinel')
  .action(async (opts) => { await ciComment(opts.dbDir); });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(2);
});
