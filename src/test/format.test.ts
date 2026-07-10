import { describe, expect, it } from 'vitest';
import { errorMessage } from '../lib/format';

describe('errorMessage', () => {
  it('keeps concise domain errors that are safe to show', () => {
    expect(errorMessage(new Error('This job is assigned to someone else.'))).toBe(
      'This job is assigned to someone else.',
    );
  });

  it('never exposes Firebase exception details or index URLs', () => {
    const raw = Object.assign(
      new Error(
        'FirebaseError: The query requires an index. Create it at https://console.firebase.google.com/raw-index',
      ),
      { code: 'failed-precondition' },
    );

    const message = errorMessage(raw);
    expect(message).toBe('This action is temporarily unavailable. Please try again shortly.');
    expect(message).not.toMatch(/Firebase|https?:\/\/|raw-index/i);
  });
});
