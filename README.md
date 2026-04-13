# perf-sentinel

[![CI](https://github.com/phoenix-assistant/perf-sentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/phoenix-assistant/perf-sentinel/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@phoenixaihub%2Fperf-sentinel.svg)](https://badge.fury.io/js/@phoenixaihub%2Fperf-sentinel)

> A performance regression CI gate with statistical testing and auto-bisect.

**perf-sentinel** wraps your existing benchmarks, stores results in SQLite, and uses **non-parametric statistics** (Mann-Whitney U, Pettitt change-point) to detect regressions with confidence — not just percentage thresholds.

## Features

- 📊 **Statistical rigor**: Mann-Whitney U test + bootstrap confidence intervals
- 🔍 **Auto-bisect**: Binary search through git history to find the exact regression commit  
- 📈 **Trend detection**: Pettitt change-point test for gradual degradations
- 🔌 **Universal parsers**: pytest-benchmark, criterion.rs, JMH, Go testing.B, generic JSON, custom regex
- 🚀 **CI-first**: Exit code 1 on regression, GitHub PR comment output
- 💾 **Zero config**: SQLite database, no external services

## Install

```bash
npm install -g @phoenixaihub/perf-sentinel
# or
npx @phoenixaihub/perf-sentinel run "..."
```

## Quick Start

```bash
# 1. Run your benchmark and store results
perf-sentinel run "pytest benchmarks/ --benchmark-json output.json"

# 2. Mark current results as baseline (on main branch)
perf-sentinel baseline set

# 3. On your feature branch, run again and check for regressions
perf-sentinel run "pytest benchmarks/ --benchmark-json output.json"
perf-sentinel check

# Output:
# ⚠️  endpoint_latency regressed +23.4% (p=0.003) [95% CI: 15.2% to 31.7%]
# ❌ Performance regression(s) detected!
# (exit code 1)
```

## Commands

### `perf-sentinel run <command>`

Run benchmarks and store results in `.perf-sentinel/results.db`.

```bash
# Auto-detect format
perf-sentinel run "pytest benchmarks/"

# Specific parsers
perf-sentinel run --parser go "go test -bench=. ./..."
perf-sentinel run --parser jmh "java -jar benchmarks.jar"
perf-sentinel run --parser criterion "cargo bench"

# Run multiple iterations for statistical significance
perf-sentinel run --iterations 10 "node bench.js"

# Custom regex parser
perf-sentinel run --parser regex --pattern "(\w+): ([\d.]+) (ms|ns|us)" "node bench.js"
```

**Supported formats:**
| Format | Flag | Detection |
|--------|------|-----------|
| pytest-benchmark | `--parser pytest` | `{ benchmarks: [...] }` JSON |
| criterion.rs | `--parser criterion` | `{ mean: { point_estimate } }` JSON |
| JMH | `--parser jmh` | `[{ benchmark, primaryMetric }]` JSON |
| Go testing.B | `--parser go` | `BenchmarkFoo-8   100000   1234 ns/op` |
| Generic JSON | `--parser json` | `{ name, value, unit }` |
| Custom regex | `--parser regex` | 3 capture groups: name, value, unit |

### `perf-sentinel check`

Compare current results against baseline using Mann-Whitney U test.

```bash
perf-sentinel check
perf-sentinel check --threshold 10 --significance 0.01
```

**Sample output:**
```
📊 Performance Check Results

⚠️  endpoint_latency regressed +23.4% (p=0.003) [95% CI: 15.2% to 31.7%]
✅  db_query: no significant change (+1.2%, p=0.432)
✨  cache_hit improved 8.3% (p=0.021)

❌ Performance regression(s) detected!
```

**Flags:**
- `--threshold <pct>` — Minimum % change to flag (default: 5)
- `--significance <p>` — P-value cutoff (default: 0.05)
- `--baseline-runs <n>` — Number of baseline runs to compare against (default: 10)

### `perf-sentinel bisect <benchmark-name>`

Find the commit that caused a regression via binary search.

```bash
perf-sentinel bisect endpoint_latency
perf-sentinel bisect endpoint_latency --good v1.0.0 --bad HEAD
perf-sentinel bisect endpoint_latency --command "node bench.js"
```

**Sample output:**
```
🔍 Bisecting "endpoint_latency" across 32 commits...
   Baseline mean: 12.450

   Checking commit a1b2c3d4 (index 16)...
   18.230 (+46.4%, p=0.003)
   Checking commit e5f6a7b8 (index 8)...
   12.890 (+3.5%, p=0.421)
   ...

📍 Bisect Results:
   Regression introduced in commit a1b2c3d4 by Jane Doe (2024-01-15)
```

### `perf-sentinel report`

Generate performance reports with trend charts.

```bash
perf-sentinel report
perf-sentinel report --format markdown --output report.md
perf-sentinel report --format json --output results.json
perf-sentinel report --format svg --benchmark endpoint_latency
perf-sentinel report --last 20
```

**Sample terminal output:**
```
📊 Performance Report

Benchmark                               Mean        p50         p95         p99         Unit    Samples
----------------------------------------------------------------------------------------------------
endpoint_latency                        12.45       12.10       15.20       18.90       ms      47
db_query                                8.23        7.90        11.50       14.20       ms      47

📈 endpoint_latency over time:
┌────────────────────────────────────────────────────────────┐
│       █  █                                                 │  max: 18.90
│    █  █  █  █                                              │
│ █  █  ██ █  ██                                             │
│ ████████████████                                           │
└────────────────────────────────────────────────────────────┘
   min: 11.20
```

### `perf-sentinel baseline`

Manage baselines.

```bash
perf-sentinel baseline set          # mark latest run as baseline
perf-sentinel baseline show         # display current baseline values
perf-sentinel baseline import baseline.json  # import from file
```

**Import file format:**
```json
[
  { "name": "endpoint_latency", "value": 12.5, "unit": "ms" },
  { "name": "db_query", "value": 8.2, "unit": "ms" }
]
```

### `perf-sentinel ci`

CI-optimized commands.

```bash
# Run benchmarks and check in one step
perf-sentinel ci run-and-check "pytest benchmarks/"

# Generate GitHub PR comment (pipe to gh or save to file)
perf-sentinel ci comment
```

## CI Integration

### GitHub Actions

```yaml
name: Performance Check

on:
  pull_request:
    branches: [main]

jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for bisect

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Restore baseline DB
        uses: actions/cache@v4
        with:
          path: .perf-sentinel/
          key: perf-sentinel-baseline-${{ github.base_ref }}
          restore-keys: perf-sentinel-baseline-

      - name: Install perf-sentinel
        run: npm install -g @phoenixaihub/perf-sentinel

      - name: Run benchmarks on base branch (set baseline)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          perf-sentinel run "npm run bench"
          perf-sentinel baseline set

      - name: Check for regressions
        if: github.event_name == 'pull_request'
        run: |
          perf-sentinel run "npm run bench"
          perf-sentinel check

      - name: Post PR comment
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const { execSync } = require('child_process');
            const body = execSync('perf-sentinel ci comment').toString();
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

## How It Works

### Mann-Whitney U Test

Rather than comparing means (which assumes normal distributions), perf-sentinel uses the **Mann-Whitney U test** — a non-parametric test that compares the full distribution of values. This is more robust to outliers and non-normal distributions typical in benchmark data.

- **U statistic**: Counts pairs where current > baseline, with ties counting 0.5
- **p-value**: Normal approximation (for n > 20) or exact enumeration (for small samples)
- **Two-tailed**: Reports significance in either direction

### Bootstrap Confidence Intervals

To report *how much* a benchmark changed, perf-sentinel uses **bootstrap resampling** (10,000 iterations):
- Randomly resample both baseline and current distributions
- Compute percent difference for each resample
- Report 2.5th–97.5th percentile as 95% CI

This gives you: *"latency increased 15–28% (95% CI)"* instead of just a single number.

### Pettitt Change-Point Test

For detecting **gradual degradations** over many commits, the Pettitt test finds a single change point in a time series without assuming any particular distribution.

### IQR Outlier Removal

Before any statistical test, values outside `[Q1 - 1.5×IQR, Q3 + 1.5×IQR]` are removed. This handles common benchmark noise from GC pauses and OS scheduling jitter.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT © PhoenixAI Hub
