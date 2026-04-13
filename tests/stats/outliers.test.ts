import { describe, it, expect } from 'vitest';
import { removeOutliers } from '../../src/stats/outliers.js';

describe('IQR outlier removal', () => {
  it('removes extreme outliers', () => {
    const data = [10, 11, 10, 12, 9, 11, 1000, 10, 9, 11];
    const clean = removeOutliers(data);
    expect(clean).not.toContain(1000);
  });

  it('keeps normal data intact', () => {
    const data = [10, 11, 10, 12, 9, 11, 10, 9, 11, 10];
    const clean = removeOutliers(data);
    expect(clean.length).toBe(data.length);
  });

  it('handles arrays shorter than 4 elements', () => {
    const data = [1, 2, 3];
    expect(removeOutliers(data)).toEqual(data);
  });
});
