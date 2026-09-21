import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom implements no scrolling at all, so Element.scrollIntoView is simply
// absent. The onboarding tour calls it from a timer once it finds a step's
// target: under a loaded run that timer fires mid-test and throws, which
// surfaces as an unhandled error from whichever suite happened to be running.
// A no-op keeps the behaviour under test (finding and measuring the target)
// and drops only the part jsdom cannot do.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

afterEach(() => cleanup());
