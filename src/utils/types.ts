export interface BenchmarkResult {
  name: string;
  value: number;
  unit: string;
  iterations?: number;
}

export interface StoredResult {
  id: number;
  run_id: number;
  benchmark_name: string;
  value: number;
  unit: string;
  commit_sha: string;
  branch: string;
  timestamp: number;
}

export interface Run {
  id: number;
  command: string;
  timestamp: number;
  commit_sha: string;
  branch: string;
  is_baseline: number;
}

export interface StatResult {
  u: number;
  p: number;
}

export interface BootstrapCI {
  lower: number;
  upper: number;
  median: number;
}

export interface PettittResult {
  changePoint: number;
  p: number;
  significant: boolean;
}

export interface CheckResult {
  benchmark: string;
  baselineValues: number[];
  currentValues: number[];
  baselineMean: number;
  currentMean: number;
  percentChange: number;
  u: number;
  p: number;
  ci: BootstrapCI;
  regressed: boolean;
  unit: string;
}
