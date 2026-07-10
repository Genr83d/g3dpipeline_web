import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOB_CATEGORY,
  JOB_CATEGORY_OPTIONS,
  jobCategoryLabel,
  parseJobCategory,
} from '../lib/jobCategories';
import type { JobCategory } from '../types';

const categories: ReadonlyArray<[JobCategory, string]> = [
  ['manufacturing', 'Manufacturing'],
  ['repair', 'Repair'],
  ['design', 'Design'],
  ['softwareDevelopment', 'Software development'],
  ['miscellaneous', 'Miscellaneous'],
];

describe('job categories', () => {
  it('provides all five exact stored values and user-facing labels', () => {
    expect(JOB_CATEGORY_OPTIONS.map(({ value, label }) => [value, label])).toEqual(categories);
    for (const [value, label] of categories) {
      expect(parseJobCategory(value)).toBe(value);
      expect(jobCategoryLabel(value)).toBe(label);
    }
  });

  it('defaults new jobs to Manufacturing and legacy values to Miscellaneous', () => {
    expect(DEFAULT_JOB_CATEGORY).toBe('manufacturing');
    expect(parseJobCategory(undefined)).toBe('miscellaneous');
    expect(parseJobCategory('legacy-category')).toBe('miscellaneous');
  });
});
