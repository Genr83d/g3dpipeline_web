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

/** Centralized quantity behavior per job category. All quantity UI and
 *  validation must read from this config — never branch on category directly. */
export interface JobCategoryQuantityConfig {
  usesQuantity: boolean;
  quantityLabel: string;
  quantityRequired: boolean;
  minimumQuantity: number;
  maximumQuantity: number;
}

const PHYSICAL_QUANTITY_CONFIG: JobCategoryQuantityConfig = {
  usesQuantity: true,
  quantityLabel: 'Quantity',
  quantityRequired: true,
  minimumQuantity: 1,
  // Physical batches (e.g. pin orders) routinely run 100+ units.
  maximumQuantity: 999,
};

export const JOB_CATEGORY_QUANTITY_CONFIG: Readonly<
  Record<JobCategory, JobCategoryQuantityConfig>
> = {
  manufacturing: PHYSICAL_QUANTITY_CONFIG,
  repair: PHYSICAL_QUANTITY_CONFIG,
  miscellaneous: PHYSICAL_QUANTITY_CONFIG,
  design: {
    usesQuantity: true,
    quantityLabel: 'Number of deliverables',
    quantityRequired: true,
    minimumQuantity: 1,
    maximumQuantity: 99,
  },
  softwareDevelopment: {
    usesQuantity: false,
    quantityLabel: 'Quantity',
    quantityRequired: false,
    minimumQuantity: 1,
    maximumQuantity: 1,
  },
};

export function jobQuantityConfig(category: JobCategory): JobCategoryQuantityConfig {
  return JOB_CATEGORY_QUANTITY_CONFIG[category];
}

/** Categories that don't use quantity always persist 1. */
export const NORMALIZED_QUANTITY = 1;

export function normalizeJobQuantity(category: JobCategory, quantity: number): number {
  return jobQuantityConfig(category).usesQuantity ? quantity : NORMALIZED_QUANTITY;
}

/** Validates raw quantity input for a category. Returns an error message, or
 *  null when valid. Never coerces invalid input into a valid number. */
export function validateJobQuantity(
  category: JobCategory,
  raw: string | number,
): string | null {
  const config = jobQuantityConfig(category);
  if (!config.usesQuantity) {
    // Hidden field — the normalized value 1 is always valid; anything else
    // (a manually crafted request) is rejected.
    return raw === NORMALIZED_QUANTITY || raw === String(NORMALIZED_QUANTITY)
      ? null
      : `${config.quantityLabel} must be 1 for this job type.`;
  }
  const label = config.quantityLabel;
  const text = typeof raw === 'string' ? raw.trim() : String(raw);
  if (text.length === 0) return `${label} is required.`;
  const value = typeof raw === 'number' ? raw : Number(text);
  if (!Number.isFinite(value)) return `${label} must be a whole number.`;
  if (!Number.isInteger(value)) return `${label} must be a whole number.`;
  if (value < config.minimumQuantity) {
    return `${label} must be at least ${config.minimumQuantity}.`;
  }
  if (value > config.maximumQuantity) {
    return `${label} cannot exceed ${config.maximumQuantity}.`;
  }
  return null;
}

/** Clamp a stepper increment/decrement so rapid repeats can't escape the
 *  configured range. Non-numeric current values step from the minimum. */
export function clampJobQuantity(category: JobCategory, value: number): number {
  const config = jobQuantityConfig(category);
  if (!Number.isFinite(value)) return config.minimumQuantity;
  return Math.min(config.maximumQuantity, Math.max(config.minimumQuantity, Math.trunc(value)));
}

export function filterJobsByCategory(
  jobs: readonly Job[],
  category: JobCategoryFilter,
): Job[] {
  return category === 'all' ? [...jobs] : jobs.filter((job) => job.category === category);
}
