import { describe, expect, it } from 'vitest';
import {
  batchesCrossed,
  JOB_TAG_OPTIONS,
  jobTagLabel,
  legacyPinNameMatch,
  materialsConsumed,
  parseJobTags,
  resolveJobTags,
  TAG_MATERIAL_RULES,
} from '../lib/jobTags';

const never = () => {
  throw new Error('per-unit rules must not ask for the running completed total');
};

describe('job tag vocabulary', () => {
  it('exposes every option with a label, a description, and a rule table entry', () => {
    expect(JOB_TAG_OPTIONS.length).toBeGreaterThan(0);
    for (const option of JOB_TAG_OPTIONS) {
      expect(jobTagLabel(option.value)).toBe(option.label);
      expect(option.description.trim().length).toBeGreaterThan(0);
      expect(TAG_MATERIAL_RULES[option.value]).toBeDefined();
    }
  });

  it('keeps only known tags, deduped and in option order', () => {
    expect(parseJobTags(['pins', 'pins'])).toEqual(['pins']);
    expect(parseJobTags(['sublimation', 'pins'])).toEqual(['pins']);
    expect(parseJobTags([])).toEqual([]);
    expect(parseJobTags(['PINS'])).toEqual([]);
  });

  it('treats a missing or malformed tags field as no tags', () => {
    expect(parseJobTags(undefined)).toEqual([]);
    expect(parseJobTags(null)).toEqual([]);
    expect(parseJobTags('pins')).toEqual([]);
    expect(parseJobTags([1, true, { value: 'pins' }])).toEqual([]);
  });
});

describe('reading the tags a stored job acts under', () => {
  it('takes a stored tags array at its word, empty included', () => {
    // The bug this feature exists to kill: the job name said "pin", the tag
    // list said no, and the name used to win.
    expect(resolveJobTags({ tags: [], name: 'Pin order' })).toEqual([]);
    expect(resolveJobTags({ tags: ['pins'], name: 'Enamel widgets' })).toEqual(['pins']);
  });

  it('falls back to the old name match only when the field is absent', () => {
    expect(resolveJobTags({ name: 'Pin order' })).toEqual(['pins']);
    expect(resolveJobTags({ name: '100 pins' })).toEqual(['pins']);
    expect(resolveJobTags({ name: 'Bracket set' })).toEqual([]);
    expect(resolveJobTags({})).toEqual([]);
  });

  it('reproduces the names the old trigger silently missed', () => {
    // Each of these completed cleanly and moved no stock at all. They are the
    // reason the trigger moved off the name; a tag fixes them at the source.
    for (const missed of ['Pinbacks', 'Pinback order', '100pins', 'Enamel badges']) {
      expect(legacyPinNameMatch(missed)).toBe(false);
      expect(resolveJobTags({ name: missed })).toEqual([]);
      expect(resolveJobTags({ tags: ['pins'], name: missed })).toEqual(['pins']);
    }
  });

  it('still refuses the words the old trigger was careful about', () => {
    for (const notAPin of ['Pineapple crate', 'Pinstripe panel', 'Spins rig', 'Flippin sign']) {
      expect(legacyPinNameMatch(notAPin)).toBe(false);
    }
  });
});

describe('batch boundaries', () => {
  it('counts whole boundaries the running total crosses', () => {
    expect(batchesCrossed(0, 58, 50)).toBe(1);
    expect(batchesCrossed(58, 42, 50)).toBe(1);
    expect(batchesCrossed(0, 49, 50)).toBe(0);
    expect(batchesCrossed(0, 100, 50)).toBe(2);
    expect(batchesCrossed(49, 1, 50)).toBe(1);
  });

  it('never returns a negative or undefined count', () => {
    expect(batchesCrossed(0, 0, 50)).toBe(0);
    expect(batchesCrossed(10, -5, 50)).toBe(0);
    expect(batchesCrossed(10, 20, 0)).toBe(0);
  });
});

describe('what completing a tagged job consumes', () => {
  it('takes one Pin Back per pin and no Lamina inside a batch', () => {
    expect(materialsConsumed(['pins'], 12, () => 0)).toEqual([
      { material: 'Pin Backs', units: 12 },
    ]);
  });

  it('adds a Lamina sheet for each 50-pin boundary the shop crosses', () => {
    expect(materialsConsumed(['pins'], 58, () => 0)).toEqual([
      { material: 'Pin Backs', units: 58 },
      { material: 'Lamina', units: 1 },
    ]);
    expect(materialsConsumed(['pins'], 42, () => 58)).toEqual([
      { material: 'Pin Backs', units: 42 },
      { material: 'Lamina', units: 1 },
    ]);
  });

  it('consumes nothing without a tag, or without a quantity', () => {
    expect(materialsConsumed([], 100, () => 0)).toEqual([]);
    expect(materialsConsumed(['pins'], 0, () => 0)).toEqual([]);
    expect(materialsConsumed(['pins'], -3, never)).toEqual([]);
  });
});
