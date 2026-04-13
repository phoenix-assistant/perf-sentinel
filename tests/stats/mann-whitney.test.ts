import { describe, it, expect } from 'vitest';
import { mannWhitneyU } from '../../src/stats/mann-whitney.js';

function makeNormal(n: number, mean: number, std: number, seed = 1): number[] {
  // Box-Muller
  const out: number[] = [];
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  while (out.length < n) {
    const u1 = rng(), u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    out.push(mean + z * std);
  }
  return out;
}

describe('Mann-Whitney U test', () => {
  it('returns p ≈ 0.5 for identical distributions', () => {
    const x = makeNormal(50, 100, 10, 1);
    const y = makeNormal(50, 100, 10, 2);
    const { p } = mannWhitneyU(x, y);
    // p should not be significant (no real difference)
    expect(p).toBeGreaterThan(0.05);
  });

  it('returns p < 0.05 for clearly different distributions', () => {
    const x = makeNormal(50, 200, 10, 3); // mean 200
    const y = makeNormal(50, 100, 10, 4); // mean 100
    const { p } = mannWhitneyU(x, y);
    expect(p).toBeLessThan(0.05);
  });

  it('handles small samples (n=5)', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 20, 30, 40, 50];
    const { p } = mannWhitneyU(x, y);
    expect(p).toBeLessThan(0.05);
  });

  it('returns p=1 for empty arrays', () => {
    const { p } = mannWhitneyU([], [1, 2, 3]);
    expect(p).toBe(1);
  });

  it('U statistic is within expected range', () => {
    const x = [1, 2, 3];
    const y = [4, 5, 6];
    const { u } = mannWhitneyU(x, y);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThanOrEqual(9); // max U = n1*n2 = 9
  });
});
