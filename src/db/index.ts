import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type { StoredResult, Run } from '../utils/types.js';

let _db: Database.Database | null = null;

export function getDb(dir = '.perf-sentinel'): Database.Database {
  if (_db) return _db;
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, 'results.db');
  _db = new Database(dbPath);
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      commit_sha TEXT NOT NULL,
      branch TEXT NOT NULL,
      is_baseline INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      benchmark_name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'ms',
      commit_sha TEXT NOT NULL,
      branch TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_results_name ON results(benchmark_name);
    CREATE INDEX IF NOT EXISTS idx_results_run_id ON results(run_id);
    CREATE INDEX IF NOT EXISTS idx_runs_baseline ON runs(is_baseline);
  `);
}

export function insertRun(
  db: Database.Database,
  command: string,
  commitSha: string,
  branch: string
): number {
  const stmt = db.prepare(
    'INSERT INTO runs (command, timestamp, commit_sha, branch, is_baseline) VALUES (?, ?, ?, ?, 0)'
  );
  const info = stmt.run(command, Date.now(), commitSha, branch);
  return info.lastInsertRowid as number;
}

export function insertResult(
  db: Database.Database,
  runId: number,
  name: string,
  value: number,
  unit: string,
  commitSha: string,
  branch: string
): void {
  const stmt = db.prepare(
    'INSERT INTO results (run_id, benchmark_name, value, unit, commit_sha, branch, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(runId, name, value, unit, commitSha, branch, Date.now());
}

export function getLatestRunResults(db: Database.Database): StoredResult[] {
  return db
    .prepare(
      `SELECT r.* FROM results r
       JOIN runs ru ON r.run_id = ru.id
       WHERE ru.id = (SELECT MAX(id) FROM runs)
       ORDER BY r.benchmark_name`
    )
    .all() as StoredResult[];
}

export function getBaselineResults(
  db: Database.Database,
  benchmarkName: string,
  limit = 10
): StoredResult[] {
  // Try explicit baseline first
  const baselineRuns = db
    .prepare('SELECT id FROM runs WHERE is_baseline = 1 ORDER BY id DESC LIMIT ?')
    .all(limit) as { id: number }[];

  if (baselineRuns.length > 0) {
    const ids = baselineRuns.map((r) => r.id);
    return db
      .prepare(
        `SELECT * FROM results WHERE run_id IN (${ids.map(() => '?').join(',')}) AND benchmark_name = ?`
      )
      .all(...ids, benchmarkName) as StoredResult[];
  }

  // Fall back to last N runs on main/master
  const mainRuns = db
    .prepare(
      "SELECT id FROM runs WHERE branch IN ('main', 'master') ORDER BY id DESC LIMIT ?"
    )
    .all(limit) as { id: number }[];

  if (mainRuns.length > 0) {
    const ids = mainRuns.map((r) => r.id);
    return db
      .prepare(
        `SELECT * FROM results WHERE run_id IN (${ids.map(() => '?').join(',')}) AND benchmark_name = ?`
      )
      .all(...ids, benchmarkName) as StoredResult[];
  }

  // Fall back to all results for that benchmark
  return db
    .prepare(
      'SELECT * FROM results WHERE benchmark_name = ? ORDER BY timestamp DESC LIMIT ?'
    )
    .all(benchmarkName, limit * 5) as StoredResult[];
}

export function getAllBenchmarkNames(db: Database.Database): string[] {
  return (db.prepare('SELECT DISTINCT benchmark_name FROM results').all() as { benchmark_name: string }[]).map(
    (r) => r.benchmark_name
  );
}

export function getBenchmarkHistory(
  db: Database.Database,
  name: string,
  limit?: number
): StoredResult[] {
  const q = limit
    ? 'SELECT * FROM results WHERE benchmark_name = ? ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM results WHERE benchmark_name = ? ORDER BY timestamp ASC';
  const rows = limit
    ? (db.prepare(q).all(name, limit) as StoredResult[])
    : (db.prepare(q).all(name) as StoredResult[]);
  if (limit) rows.reverse();
  return rows;
}

export function setBaseline(db: Database.Database, runId?: number): void {
  db.prepare('UPDATE runs SET is_baseline = 0').run();
  if (runId !== undefined) {
    db.prepare('UPDATE runs SET is_baseline = 1 WHERE id = ?').run(runId);
  } else {
    db.prepare('UPDATE runs SET is_baseline = 1 WHERE id = (SELECT MAX(id) FROM runs)').run();
  }
}

export function getLatestRun(db: Database.Database): Run | undefined {
  return db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get() as Run | undefined;
}

export function getRunCommand(db: Database.Database): string | undefined {
  const run = db
    .prepare('SELECT command FROM runs WHERE command != "" ORDER BY id DESC LIMIT 1')
    .get() as { command: string } | undefined;
  return run?.command;
}
