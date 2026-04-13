import { describe, it, expect } from 'vitest';
import { pettittTest } from '../../src/stats/pettitt.js';

describe('Pettitt change-point test', () => {
  it('returns non-significant p for uniform series', () => {
    const series = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const result = pettittTest(series);
    expect(result.significant).toBe(false);
  });

  it('detects change point at midpoint', () => {
    // First 10 values: ~10, last 10 values: ~100
    const series = [
      10, 11, 10, 12, 9, 11, 10, 9, 11, 10,
      100, 101, 99, 100, 102, 100, 99, 101, 100, 100
    ];
    const result = pettittTest(series);
    expect(result.significant).toBe(true);
    // Change point should be around index 10
    expect(result.changePoint).toBeGreaterThanOrEqual(8);
    expect(result.changePoint).toBeLessThanOrEqual(12);
  });

  it('returns non-significant for short series', () => {
    const result = pettittTest([1, 2, 3]);
    expect(result.significant).toBe(false);
    expect(result.p).toBe(1);
  });

  it('returns a p value between 0 and 1', () => {
    const series = Array.from({ length: 20 }, (_, i) => i < 10 ? 5 : 50);
    const result = pettittTest(series);
    expect(result.p).toBeGreaterThanOrEqual(0);
    expect(result.p).toBeLessThanOrEqual(1);
  });
});
