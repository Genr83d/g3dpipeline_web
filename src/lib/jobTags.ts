import type { JobTag } from '../types';

/** Job tags are explicit, selectable classifications stored on the job
 *  document. They exist because stock deduction used to key off a regex over
 *  the job *name*: a job called "Pinbacks" or "100pins" completed cleanly and
 *  moved no stock at all, with no error anywhere. A tag is chosen from a
 *  closed list, so the behaviour it drives cannot be lost to a typo, a rename,
 *  or a shop that words its jobs differently this month.
 *
 *  Adding a tag means adding it to {@link JobTag}, to JOB_TAG_OPTIONS, and —
 *  when it consumes stock — to TAG_MATERIAL_RULES. Nothing else in the app
 *  branches on a tag value. */
export const JOB_TAG_OPTIONS: ReadonlyArray<{
  value: JobTag;
  label: string;
  /** Shown beside the control, so the stock consequence is visible at the
   *  moment someone ticks the box rather than at completion. */
  description: string;
}> = [
  {
    value: 'pins',
    label: 'Pins',
    description:
      'Completing this job deducts one Pin Back per unit, plus one Lamina sheet each time the shop total crosses 50 pins.',
  },
];

const KNOWN_TAGS: readonly JobTag[] = JOB_TAG_OPTIONS.map((option) => option.value);

const JOB_TAG_LABELS: Readonly<Record<JobTag, string>> = Object.fromEntries(
  JOB_TAG_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<JobTag, string>;

export function jobTagLabel(tag: JobTag): string {
  return JOB_TAG_LABELS[tag];
}

/** How completing a tagged job consumes stock.
 *
 *  `perUnit` takes `factor` units of the material for every unit of the job's
 *  quantity. `perBatch` takes one unit each time the shop's running completed
 *  total for that tag crosses a multiple of `factor` — 58 pins take one Lamina
 *  sheet, a later 42 take the next one. */
export interface MaterialRule {
  /** The inventory document's name. Matched trimmed and case-insensitively,
   *  and quoted verbatim in the error when no such material exists. */
  material: string;
  basis: 'perUnit' | 'perBatch';
  factor: number;
}

export const TAG_MATERIAL_RULES: Readonly<Record<JobTag, readonly MaterialRule[]>> = {
  pins: [
    { material: 'Pin Backs', basis: 'perUnit', factor: 1 },
    { material: 'Lamina', basis: 'perBatch', factor: 50 },
  ],
};

export interface MaterialDemand {
  material: string;
  units: number;
}

/** Whole `size` boundaries that adding `quantity` pushes the running total
 *  across. Zero when the batch fits inside the current boundary. */
export function batchesCrossed(previousTotal: number, quantity: number, size: number): number {
  if (size <= 0 || quantity <= 0) return 0;
  return Math.floor((previousTotal + quantity) / size) - Math.floor(previousTotal / size);
}

/** What completing one job takes out of inventory, aggregated per material so
 *  two tags naming the same material produce a single deduction.
 *
 *  `previousCompleted` supplies the shop's running completed total for a tag,
 *  and is only consulted by `perBatch` rules. */
export function materialsConsumed(
  tags: readonly JobTag[],
  quantity: number,
  previousCompleted: (tag: JobTag) => number,
): MaterialDemand[] {
  // A job with nothing in it consumes nothing, and asks nothing of the caller
  // — `previousCompleted` reads the whole completed collection, so it is not
  // worth running for a job that cannot possibly deduct.
  if (quantity <= 0) return [];
  const totals = new Map<string, number>();
  for (const tag of tags) {
    for (const rule of TAG_MATERIAL_RULES[tag] ?? []) {
      const units =
        rule.basis === 'perUnit'
          ? quantity * rule.factor
          : batchesCrossed(previousCompleted(tag), quantity, rule.factor);
      if (units > 0) totals.set(rule.material, (totals.get(rule.material) ?? 0) + units);
    }
  }
  return [...totals].map(([material, units]) => ({ material, units }));
}

/** Keeps only tags this app understands, deduped and in JOB_TAG_OPTIONS order.
 *
 *  A tag another client writes that this app has never heard of is dropped
 *  rather than carried, so it can never reach a rule table that has no entry
 *  for it. The trade-off is stated plainly: this app rewrites `tags` on save,
 *  so saving a job here drops tags only the other client knows. */
export function parseJobTags(value: unknown): JobTag[] {
  if (!Array.isArray(value)) return [];
  const chosen = new Set(value.filter((entry): entry is string => typeof entry === 'string'));
  return KNOWN_TAGS.filter((tag) => chosen.has(tag));
}

/** The pre-tag trigger: a standalone `pin`/`pins` in the job name — never
 *  `pineapple`, `pinstripe`, `spins`, or `flippin`. Retained only to read
 *  documents written before tags existed. Nothing is classified this way on
 *  save any more. */
export function legacyPinNameMatch(name: string): boolean {
  return /\bpins?\b/i.test(name);
}

/** The tags a stored job document acts under.
 *
 *  A document carrying a `tags` array is taken at its word, including an empty
 *  one — that is someone saying "no tags", and it has to be able to turn a
 *  deduction off. Only a document with no `tags` field at all (written before
 *  this feature, or by a client that has not adopted it yet) falls back to the
 *  old name match, so completions there keep behaving exactly as they did. */
export function resolveJobTags(data: { tags?: unknown; name?: unknown }): JobTag[] {
  if (Array.isArray(data.tags)) return parseJobTags(data.tags);
  return typeof data.name === 'string' && legacyPinNameMatch(data.name) ? ['pins'] : [];
}
