import { describe, it, expect } from 'vitest';
import { bootstrapCI } from '../../src/stats/bootstrap.js';

describe('Bootstrap CI', () => {
  it('CI contains 0% for identical distributions', () => {
    const baseline = [100, 101, 99, 100, 102, 100, 99, 101, 100, 100];
    const current = [100, 101, 99, 100, 102, 100, 99, 101, 100, 100];
    const { lower, upper } = bootstrapCI(baseline, current, 1000);
    expect(lower).toBeLessThan(5);
    expect(upper).toBeGreaterThan(-5);
  });

  it('CI shows positive range for regressed benchmark', () => {
    const baseline = Array(20).fill(100);
    const current = Array(20).fill(150); // 50% slower
    const { lower, upper, median } = bootstrapCI(baseline, current, 1000);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeGreaterThan(0);
    expect(median).toBeCloseTo(50, 0);
  });

  it('handles empty arrays', () => {
    const { lower, upper, median } = bootstrapCI([], [1, 2, 3], 100);
    expect(lower).toBe(0);
    expect(upper).toBe(0);
    expect(median).toBe(0);
  });
});
