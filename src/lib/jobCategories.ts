import type { Job, JobCategory } from '../types';

export const DEFAULT_JOB_CATEGORY: JobCategory = 'manufacturing';
export const LEGACY_JOB_CATEGORY: JobCategory = 'miscellaneous';

export const JOB_CATEGORY_OPTIONS: ReadonlyArray<{
  value: JobCategory;
  label: string;
}> = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'repair', label: 'Repair' },
  { value: 'design', label: 'Design' },
  { value: 'softwareDevelopment', label: 'Software development' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const JOB_CATEGORY_LABELS: Readonly<Record<JobCategory, string>> =
  Object.fromEntries(JOB_CATEGORY_OPTIONS.map(({ value, label }) => [value, label])) as Record<
    JobCategory,
    string
  >;

export type JobCategoryFilter = JobCategory | 'all';

export function parseJobCategory(value: unknown): JobCategory {
  switch (value) {
    case 'manufacturing':
    case 'repair':
    case 'design':
    case 'softwareDevelopment':
    case 'miscellaneous':
      return value;
    default:
      return LEGACY_JOB_CATEGORY;
  }
}

export function jobCategoryLabel(category: JobCategory): string {
  return JOB_CATEGORY_LABELS[category];
}

export function filterJobsByCategory(
  jobs: readonly Job[],
  category: JobCategoryFilter,
): Job[] {
  return category === 'all' ? [...jobs] : jobs.filter((job) => job.category === category);
}
