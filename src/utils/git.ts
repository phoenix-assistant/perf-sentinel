import { execSync } from 'child_process';

export function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getCommitAuthor(sha: string): string {
  try {
    return execSync(`git log -1 --format="%an" ${sha}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getCommitDate(sha: string): string {
  try {
    return execSync(`git log -1 --format="%ad" --date=short ${sha}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getCommitMessage(sha: string): string {
  try {
    return execSync(`git log -1 --format="%s" ${sha}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function getCommitLog(good: string, bad: string): string[] {
  try {
    const out = execSync(`git log --format="%H" ${good}..${bad}`, { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function checkoutCommit(sha: string): void {
  execSync(`git checkout ${sha}`, { stdio: 'inherit' });
}

export function restoreHead(): void {
  try {
    execSync('git checkout -', { stdio: 'inherit' });
  } catch {
    // ignore
  }
}
